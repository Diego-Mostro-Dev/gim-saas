from django.test import TestCase, TransactionTestCase
from django.contrib.auth.models import User
from django.db import connection, transaction
from django.apps import apps
from django.db.models.signals import post_save

from config.api import restore
from profiles.signals import create_user_profile
from core.testing import BaseAPITest


class RestoreRoundTripTest(TransactionTestCase):
    reset_sequences = True

    def test_roundtrip_dump_and_restore_synthetic(self):
        import gzip
        import os
        from io import StringIO
        from tempfile import NamedTemporaryFile
        from django.core.management import call_command

        api = BaseAPITest()
        api.setUp()
        g = api.create_gym(name="RTest Gym")
        u = api.create_user(g, username="owner_rt")
        p = api.create_plan(g, name="Plan RT")
        m = api.create_member(g, first_name="Ana")
        api.open_month_subscription(m, p)

        buf = NamedTemporaryFile(delete=False, suffix=".json.gz")
        buf.close()
        try:
            out = StringIO()
            # In-process: dumpdata lee la DB de test (test_*). Antes corría en
            # subproceso y se conectaba a la DB configurada (vacía en CI).
            call_command(
                "dumpdata",
                "--natural-foreign",
                "--natural-primary",
                stdout=out,
            )
            with gzip.open(buf.name, "wt", encoding="utf-8") as f:
                f.write(out.getvalue())
            # verify
            v = restore.verify_fixture(buf.name)
            self.assertTrue(v["total"] > 0)

            # destroy business objects created by test by deleting via ORM? easier: just don't assume; we call restore_fixture on same DB context via loaddata
            # but loaddata will insert/update; TransactionTestCase flushes at end
            restore._disconnect_signal()
            try:
                call_command("loaddata", buf.name, verbosity=0)
            finally:
                restore._reconnect_signal()
            seqs = restore.check_sequences_report()
            self.assertIsInstance(seqs["risks"], list)
        finally:
            try:
                os.unlink(buf.name)
            except Exception:
                pass


class SignalSafetyTest(TransactionTestCase):
    def test_signal_safe_roundtrip(self):
        sync, async_ = post_save._live_receivers(sender=User)
        self.assertIn(create_user_profile, sync)
        self.assertNotIn(create_user_profile, async_)

        class Dummy:
            pass

        def dummy(*a, **kw):
            pass

        dummy_ = dummy
        try:
            post_save.connect(dummy_, sender=User)
            self.assertRaises(restore.AbortRestore, restore._assert_signal_safe)
            self.assertRaises(restore.AbortRestore, restore.restore_fixture, "/tmp/nonexistent.json.gz")
        finally:
            try:
                post_save.disconnect(dummy_, sender=User)
            except Exception:
                pass
        sync2, async2 = post_save._live_receivers(sender=User)
        self.assertIn(create_user_profile, sync2)
        self.assertTrue(all(r is create_user_profile for r in sync2))
        self.assertFalse(async2)

    def test_reconnect_on_exception(self):
        import tempfile, gzip

        f = tempfile.NamedTemporaryFile(delete=False, suffix=".json.gz")
        f.close()
        try:
            gzip.open(f.name, "wb").close()
            self.assertRaises(Exception, restore.restore_fixture, f.name)
            sync, async_ = post_save._live_receivers(sender=User)
            self.assertIn(create_user_profile, sync)
            self.assertFalse(async_)
        finally:
            import os

            try:
                os.unlink(f.name)
            except Exception:
                pass


class RestoreCommandTest(TestCase):
    """Cubre el comando `restore_db --restore` con la descarga simulada.

    Regresión: la rama `--restore` se limitó a reusar el código inline de
    `download_to()` sin importar `cloudinary`, por lo que siempre moría con
    NameError y jamás llamaba al helper. Aquí todo lo que toca la red y la
    DB se parchea, y lo que se valida es que el camino sea el correcto.
    """

    def test_restore_db_restore_mode_uses_download_to(self):
        from io import StringIO
        from types import SimpleNamespace
        from unittest import mock

        from django.core.management import call_command

        from gyms.management.commands import restore_db as cmd_mod

        with connection.cursor() as c:
            c.execute("SELECT current_database()")
            cur_db = c.fetchone()[0]

        info = SimpleNamespace(public_id="gym_saas_backups/latest", filename="backup.json.gz")
        out = StringIO()

        with mock.patch.object(restore, "ensure_empty_database") as empty, \
                mock.patch.object(restore, "resolve_backup", return_value=info) as resolve, \
                mock.patch.object(cmd_mod, "download_to", return_value="/tmp/fake.json.gz") as dl, \
                mock.patch.object(restore, "verify_fixture") as verify, \
                mock.patch.object(restore, "restore_fixture") as do_restore, \
                mock.patch.object(restore, "check_sequences_report", return_value={"risks": []}):
            call_command(
                "restore_db",
                "--restore",
                "--latest",
                "--confirm-db",
                cur_db,
                "--allow-production",
                stdout=out,
                no_color=True,
            )

        # La rama --restore pasa por download_to(): nada de descarga inline.
        dl.assert_called_once()
        self.assertEqual(dl.call_args.args[0], info)
        empty.assert_called_once()
        resolve.assert_called_once_with(None, True)
        verify.assert_called_once_with("/tmp/fake.json.gz")
        do_restore.assert_called_once_with("/tmp/fake.json.gz", using=None)
        self.assertIn("Restored from gym_saas_backups/latest", out.getvalue())
        self.assertIn(cur_db, out.getvalue())
