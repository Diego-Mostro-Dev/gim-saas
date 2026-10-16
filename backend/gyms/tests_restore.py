from django.test import TransactionTestCase
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
        from tempfile import NamedTemporaryFile
        import gzip, json

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
            with gzip.open(buf.name, "wt", encoding="utf-8") as f:
                import subprocess, sys, os as _os

                manage = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), "..", "manage.py")
                manage = _os.path.abspath(manage)
                res = subprocess.run(
                    [sys.executable, manage, "dumpdata", "--natural-foreign", "--natural-primary"],
                    cwd=_os.path.dirname(manage),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    env={**_os.environ, "ENVIRONMENT": "", "DB_SSLMODE": "disable"},
                )
                self.assertEqual(res.returncode, 0)
                f.write(res.stdout.decode("utf-8"))
            # verify
            v = restore.verify_fixture(buf.name)
            self.assertTrue(v["total"] > 0)

            # destroy business objects created by test by deleting via ORM? easier: just don't assume; we call restore_fixture on same DB context via loaddata
            # but loaddata will insert/update; TransactionTestCase flushes at end
            restore._disconnect_signal()
            try:
                from django.core.management import call_command

                call_command("loaddata", buf.name, verbosity=0)
            finally:
                restore._reconnect_signal()
            seqs = restore.check_sequences_report()
            self.assertIsInstance(seqs["risks"], list)
        finally:
            import os

            try:
                os.unlink(buf.name)
            except Exception:
                pass


class SignalSafetyTest(TransactionTestCase):
    def test_signal_safe_roundtrip(self):
        sync, async_ = post_save._live_receivers(sender=User)
        self.assertIn(create_user_profile, sync)
        self.assertNotIn(async_, create_user_profile)

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
