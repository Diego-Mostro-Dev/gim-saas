import gzip
import hashlib
import io
import json
import logging
import os
import tempfile
from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional, Tuple

import cloudinary
import cloudinary.api
import cloudinary.utils
from django.apps import apps
from django.conf import settings
from django.core.management import call_command
from django.db import connection, transaction
from django.db.models.signals import post_save
from django.contrib.auth.models import User

from profiles.signals import create_user_profile

logger = logging.getLogger(__name__)

BACKUP_FOLDER = "gim-saas/backups"


@dataclass
class BackupInfo:
    public_id: str
    created_at: Optional[str]
    bytes: Optional[int]
    filename: Optional[str]


class AbortRestore(Exception):
    pass


def list_backups(limit: int = 500) -> List[BackupInfo]:
    try:
        resp = cloudinary.api.resources(
            resource_type="raw",
            type="private",
            prefix=f"{BACKUP_FOLDER}/",
            max_results=limit,
        )
    except Exception as e:
        raise AbortRestore(f"Could not list backups from Cloudinary: {e}")

    items = resp.get("resources", []) or []
    out = []
    for r in items:
        pub = r.get("public_id")
        if not pub:
            continue
        fn = os.path.basename(pub) if "/" in pub else pub
        out.append(
            BackupInfo(
                public_id=pub,
                created_at=r.get("created_at"),
                bytes=r.get("bytes"),
                filename=fn,
            )
        )
    return sorted(out, key=lambda x: x.created_at or "")


def resolve_backup(public_id: Optional[str], latest: bool) -> BackupInfo:
    if bool(public_id) == bool(latest):
        raise AbortRestore("You must provide exactly one of --public-id or --latest.")
    if public_id:
        try:
            r = cloudinary.api.resource(public_id, resource_type="raw", type="private")
        except Exception as e:
            raise AbortRestore(f"Could not fetch Cloudinary resource {public_id}: {e}")
        fn = os.path.basename(r.get("public_id") or public_id) or public_id
        return BackupInfo(
            public_id=r.get("public_id") or public_id,
            created_at=r.get("created_at"),
            bytes=r.get("bytes"),
            filename=fn,
        )
    items = list_backups()
    if not items:
        raise AbortRestore("No backups found in Cloudinary.")
    return items[-1]


def _get_extension_table_names() -> set:
    from django.db import connection as conn

    ext = set()
    with conn.cursor() as c:
        c.execute(
            """
            SELECT c.relname
            FROM pg_depend d
            JOIN pg_class c ON c.oid = d.objid
            JOIN pg_extension e ON e.oid = d.refobjid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE d.refclassid = 'pg_extension'::regclass
              AND d.classid = 'pg_class'::regclass
              AND c.relkind IN ('r', 'p')
              AND c.relname NOT LIKE 'pg_%'
              AND n.nspname NOT IN ('pg_catalog', 'pg_toast')
            UNION
            SELECT c.relname
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relkind IN ('r', 'p')
              AND EXISTS (
                    SELECT 1
                    FROM pg_depend d
                    WHERE d.objid = c.oid
                      AND d.refclassid = 'pg_extension'::regclass
                  )
              AND n.nspname NOT IN ('pg_catalog', 'pg_toast')
            """
        )
        for (t,) in c.fetchall():
            ext.add(t)
    return ext


def _is_extension_table(name: str) -> bool:
    return name in _get_extension_table_names()


def verify_fixture(path: str) -> dict:
    if not os.path.exists(path):
        raise AbortRestore(f"Fixture not found: {path}")
    if path.endswith(".dump.gz"):
        raise AbortRestore("Only .json.gz fixtures (dumpdata) are supported; .dump.gz requires pg_restore.")

    with gzip.open(path, "rb") as f:
        raw = f.read()
    if len(raw) == 0:
        raise AbortRestore("Fixture is empty.")

    try:
        data = json.loads(raw.decode("utf-8"))
    except Exception as e:
        raise AbortRestore(f"Invalid JSON fixture: {e}")

    if not isinstance(data, list):
        raise AbortRestore("Fixture must be a JSON array.")

    total = len(data)
    missing = 0
    for o in data[:10]:
        if not isinstance(o, dict) or "model" not in o or "fields" not in o:
            missing += 1
    if total == 0:
        raise AbortRestore("Fixture has no objects.")

    import collections

    c = collections.Counter(o.get("model") for o in data if isinstance(o, dict))
    return {"total": total, "models": dict(sorted(c.items())), "has_model_fields": missing == 0}


def _assert_signal_safe():
    FO = create_user_profile
    assert FO.__module__ == "profiles.signals" and FO.__name__ == "create_user_profile", "expected FO"
    sync_before, async_before = post_save._live_receivers(sender=User)
    for r in async_before:
        raise AbortRestore("Unexpected async receiver for User.post_save")
    unexpected = [r for r in sync_before if r is not FO]
    if FO not in sync_before or unexpected:
        raise AbortRestore("User.post_save has unexpected or missing receivers")


def _disconnect_signal():
    _assert_signal_safe()
    removed = post_save.disconnect(create_user_profile, sender=User)
    assert removed
    assert not post_save.has_listeners(User)


def _reconnect_signal():
    post_save.connect(create_user_profile, sender=User)
    sync, async_ = post_save._live_receivers(sender=User)
    assert FO_in(sync), "reconnect failed"
    assert not async_


def FO_in(sync_list):
    FO = create_user_profile
    return FO in sync_list and all(r is FO for r in sync_list)


def ensure_empty_database():
    from django.db import connections
    from django.db.utils import ProgrammingError, OperationalError

    conn = connections[connection.alias]
    with conn.cursor() as c:
        try:
            tables = conn.introspection.get_table_list(c)
        except (ProgrammingError, OperationalError, Exception) as e:
            raise AbortRestore(f"Cannot introspect tables: {e}")
    present = {t.name for t in tables}
    app_models = apps.get_models(include_auto_created=False, include_swapped=False)
    app_tables = {m._meta.db_table for m in app_models if m._meta.db_table}
    ext_tables = _get_extension_table_names()

    present_app = present & app_tables
    for t in present_app:
        with conn.cursor() as c:
            try:
                c.execute(f"SELECT COUNT(*) FROM {conn.ops.quote_name(t)}")
                n = c.fetchone()[0]
                if n != 0:
                    raise AbortRestore(f"Business data found in app table: {t} ({n} rows)")
                raise AbortRestore(f"App schema table exists: {t}; v1 requires empty database")
            except AbortRestore:
                raise
            except Exception as e:
                raise AbortRestore(f"Cannot inspect app table {t}: {e}")

    present_other = present - app_tables - ext_tables
    if present_other:
        raise AbortRestore(f"Unknown tables present; cannot safely proceed: {sorted(present_other)[:10]}")

    try:
        with conn.cursor() as c:
            c.execute("SELECT COUNT(*) FROM django_migrations")
            nm = c.fetchone()[0]
            if nm != 0:
                raise AbortRestore(f"django_migrations has {nm} rows; v1 requires empty database")
    except AbortRestore:
        raise
    except Exception:
        pass


def compare_counts_fixture_vs_db(path: str, using=None):
    pass


def check_orphans():
    pass


def check_unique():
    pass


def check_sequences_report():
    from django.apps import apps
    with connection.cursor() as cur:
        res = []
        checked = 0
        for model in apps.get_models():
            pk = model._meta.pk
            if pk is None or pk.get_internal_type() not in (
                "AutoField",
                "BigAutoField",
                "SmallAutoField",
            ):
                continue
            table, col = model._meta.db_table, pk.column
            cur.execute("SELECT pg_get_serial_sequence(%s,%s)", [table, col])
            row = cur.fetchone()
            seq = row[0] if row else None
            if not seq:
                continue
            checked += 1
            cur.execute(f'SELECT last_value, is_called FROM {seq}')
            lv, called = cur.fetchone()
            cur.execute(f'SELECT COALESCE(MAX("{col}"),0) FROM "{table}"')
            mx = cur.fetchone()[0]
            if mx > (lv if lv else 0) or (not called and mx > 0):
                res.append((table, col, lv, called, mx))
        return {"checked": checked, "risks": res}


def restore_fixture(path: str, using=None):
    _disconnect_signal()
    try:
        call_command("migrate", "--noinput", verbosity=1)
        call_command("loaddata", path, verbosity=1)
    except Exception:
        raise
    finally:
        _reconnect_signal()
