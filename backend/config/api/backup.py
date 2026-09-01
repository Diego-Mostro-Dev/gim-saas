import gzip
import hmac
import logging
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime
from zoneinfo import ZoneInfo

import cloudinary
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
)
from rest_framework.response import Response

logger = logging.getLogger(__name__)

BACKUP_FOLDER = "gim-saas/backups"
BACKUP_RETENTION = int(os.getenv("BACKUP_RETENTION", "14"))


def _tz():
    return ZoneInfo(settings.TIME_ZONE)


def _is_postgres():
    engine = settings.DATABASES["default"].get("ENGINE", "")
    return engine.endswith("postgres")


def _dump_pg_dump(tmp_path):
    """Dump PostgreSQL completo (formato custom, comprimido) vía pg_dump.

    Devuelve False si el binario o el engine no están disponibles, para que el
    caller decida el fallback a dumpdata.
    """
    pg_dump = shutil.which("pg_dump")
    database_url = os.getenv("DATABASE_URL")

    if not pg_dump or not database_url or not _is_postgres():
        return False

    cmd = [
        pg_dump,
        "--no-owner",
        "--no-privileges",
        "--format=custom",
        "-f",
        "-",
        database_url,
    ]
    proc = subprocess.run(
        cmd,
        stdout=open(tmp_path, "wb"),
        stderr=subprocess.PIPE,
    )
    if proc.returncode != 0:
        logger.error(
            "pg_dump failed rc=%s: %s",
            proc.returncode,
            proc.stderr.decode("utf-8", "replace")[-500:],
        )
        raise RuntimeError("pg_dump failed")
    return True


def _dump_dumpdata(tmp_path):
    """Fallback multiplataforma: dump JSON con serialización natural."""
    manage_py = str(settings.BASE_DIR / "manage.py")
    cmd = [
        sys.executable,
        manage_py,
        "dumpdata",
        "--natural-foreign",
        "--natural-primary",
        "-o",
        tmp_path,
    ]
    proc = subprocess.run(cmd, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        logger.error(
            "dumpdata failed rc=%s: %s",
            proc.returncode,
            proc.stderr.decode("utf-8", "replace")[-500:],
        )
        raise RuntimeError("dumpdata failed")
    return True


def _gzip_into(tmp_path, raw_path):
    with open(raw_path, "rb") as src, gzip.open(tmp_path, "wb") as dst:
        shutil.copyfileobj(src, dst)


def _upload_private(name, file_path):
    result = cloudinary.uploader.upload(
        file=file_path,
        resource_type="raw",
        type="private",
        folder=BACKUP_FOLDER,
        public_id=name,
        overwrite=False,
    )
    return result


def _prune(keep):
    try:
        resp = cloudinary.api.resources(
            resource_type="raw",
            type="private",
            prefix=f"{BACKUP_FOLDER}/",
            max_results=500,
        )
    except Exception:
        logger.exception("Could not list backups for pruning")
        return 0, None

    items = sorted(
        resp.get("resources", []),
        key=lambda r: r.get("created_at", ""),
    )

    if len(items) <= keep:
        return len(items), []

    to_delete = [r["public_id"] for r in items[:-keep]]
    cloudinary.api.delete_resources(
        to_delete,
        resource_type="raw",
        type="private",
    )
    return keep, len(to_delete)


def run_backup():
    """Produce un dump de la DB y lo sube como recurso privado a Cloudinary.

    Retorna metadata para reportar al caller (endpoint / management command).
    """
    ts = datetime.now(_tz()).strftime("%Y-%m-%dT%H%M%S")

    with tempfile.TemporaryDirectory() as tmpdir:
        raw_path = os.path.join(tmpdir, "backup.raw")
        gz_path = os.path.join(tmpdir, "backup.gz")

        if _dump_pg_dump(raw_path):
            source = "pg_dump"
        else:
            _dump_dumpdata(raw_path)
            source = "dumpdata"

        _gzip_into(gz_path, raw_path)

        ext = ".dump.gz" if source == "pg_dump" else ".json.gz"
        name = f"backup-{ts}{ext}"

        upload = _upload_private(name, gz_path)
        size_bytes = os.path.getsize(gz_path)

    kept, deleted = _prune(BACKUP_RETENTION)

    downloadable = cloudinary.utils.cloudinary_url(
        upload["public_id"],
        resource_type="raw",
        type="private",
        secure=True,
        sign_url=True,
    )[0]

    return {
        "source": source,
        "file": name,
        "size_bytes": size_bytes,
        "public_id": upload["public_id"],
        "download_url": downloadable,
        "retention_kept": kept,
        "retention_deleted": deleted,
    }


@api_view(["POST"])
@authentication_classes([])
@permission_classes([])
def backup_endpoint(request):
    """Dispara un backup bajo demanda (cron o manual) -> Cloudinary privado.

    Protegido con la misma API key compartida que /api/system/tasks/.
    """
    expected = getattr(settings, "SCHEDULED_TASKS_KEY", None)
    provided = request.headers.get("X-Task-Key", "")

    if not expected or not provided or not hmac.compare_digest(expected, provided):
        return Response(
            {"detail": "Invalid or missing task key"},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        result = run_backup()
    except Exception as exc:
        logger.exception("Backup failed")
        return Response(
            {"detail": "Backup failed", "error": str(exc)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    return Response(result, status=status.HTTP_200_OK)