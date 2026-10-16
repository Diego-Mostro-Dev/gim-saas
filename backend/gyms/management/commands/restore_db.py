from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, connections
from config.api import restore


class Command(BaseCommand):
    help = "Restore a Cloudinary backup into an EMPTY local/temporary database. Read-only checks allowed."

    def add_arguments(self, parser):
        grp = parser.add_mutually_exclusive_group(required=False)
        grp.add_argument("--public-id", dest="public_id", help="Cloudinary public_id")
        grp.add_argument("--latest", action="store_true", help="Use latest backup")
        parser.add_argument("--download-only", action="store_true")
        parser.add_argument("--check", action="store_true")
        parser.add_argument("--check-db", action="store_true")
        parser.add_argument("--restore", action="store_true")
        parser.add_argument("--confirm-db", dest="confirm_db", help="Confirm DB name (required for --restore)")
        parser.add_argument("--allow-production", action="store_true")
        parser.add_argument("--keep-temp", action="store_true")
        parser.add_argument("--no-reset-sequences", action="store_true")
        parser.add_argument("--temp-dir", dest="temp_dir", help="Temp dir (optional)")

    def handle(self, *args, **opts):
        if opts["check"] and opts["check_db"]:
            raise CommandError("--check and --check-db are mutually exclusive")
        if sum([opts["check"], opts["check_db"], opts["download_only"], opts["restore"]]) > 1:
            raise CommandError("Choose exactly one mode: --check | --check-db | --download-only | --restore")

        from config.neon import neon_endpoint_role

        db = connections[connection.alias]
        with db.cursor() as c:
            try:
                c.execute("SELECT current_database()")
                cur_db = c.fetchone()[0]
            except Exception as e:
                raise CommandError(f"Cannot get current_database: {e}")
        host = connection.settings_dict.get("HOST", "") or settings.DATABASES.get("default", {}).get("HOST", "")

        if opts["restore"]:
            if not opts["confirm_db"] or opts["confirm_db"] != cur_db:
                raise CommandError(f"--confirm-db must exactly match current_database(): {cur_db}")
            hrole = neon_endpoint_role(host)
            if hrole == "production" and not opts["allow-production"]:
                raise CommandError("Production destination requires --allow-production and explicit confirmation")
            restore.ensure_empty_database()
            info = restore.resolve_backup(opts["public_id"], opts["latest"])
            import tempfile as _tmp

            d = opts["temp_dir"] or _tmp.mkdtemp(prefix="gym_saas_restore_")
            try:
                path = download_to(info, d)
            except Exception as e:
                raise CommandError(f"Download failed: {e}")
            restore.verify_fixture(path)
            try:
                restore.restore_fixture(path, using=None)
            finally:
                if not opts["keep_temp"]:
                    import shutil

                    try:
                        shutil.rmtree(d, ignore_errors=True)
                    except Exception:
                        pass
            seqs = restore.check_sequences_report()
            self.stdout.write(self.style.SUCCESS(f"Restored from {info.public_id} into {cur_db}. sequences_risks={len(seqs['risks'])}"))
            return

        if opts["check"]:
            info = restore.resolve_backup(opts["public_id"], opts["latest"])
            d = _tmp_or_empty(opts, "check")
            try:
                path = download_to(info, d)
                res = restore.verify_fixture(path)
                self.stdout.write(self.style.SUCCESS(f"CHECK OK: total={res['total']} models={len(res['models'])}"))
            finally:
                cleanup(d, opts)
            return

        if opts["check_db"]:
            if not opts["confirm_db"] or opts["confirm_db"] != cur_db:
                raise CommandError(f"--confirm-db required and must match current_database(): {cur_db}")
            info = restore.resolve_backup(opts["public_id"], opts["latest"])
            d = _tmp_or_empty(opts, "checkdb")
            try:
                path = download_to(info, d)
                restore.verify_fixture(path)
                seqs = restore.check_sequences_report()
                self.stdout.write(self.style.SUCCESS(f"CHECK-DB OK: risks={len(seqs['risks'])}"))
            finally:
                cleanup(d, opts)
            return

        if opts["download_only"]:
            info = restore.resolve_backup(opts["public_id"], opts["latest"])
            d = _tmp_or_empty(opts, "dlonly")
            try:
                path = download_to(info, d)
                restore.verify_fixture(path)
                self.stdout.write(self.style.SUCCESS(f"Downloaded + verified: {path}"))
                if not opts["keep_temp"]:
                    self.stdout.write("Remove --keep-temp to keep; otherwise temp will be cleaned? --keep-temp affects behavior")
            finally:
                if not opts["keep_temp"]:
                    cleanup(d, opts)
            return

        raise CommandError("Specify a mode")


def _tmp_or_empty(opts, prefix):
    import tempfile as _tmp

    if opts["keep_temp"]:
        d = opts["temp_dir"] or _tmp.mkdtemp(prefix=f"gym_saas_{prefix}_")
        return d
    import tempfile as _tmp2

    return _tmp2.mkdtemp(prefix=f"gym_saas_{prefix}_")


def download_to(info, d):
    import os, urllib.request, cloudinary.utils

    path = os.path.join(d, info.filename or "backup.json.gz")
    url = cloudinary.utils.private_download_url(info.public_id, "", resource_type="raw", type="private")
    req = urllib.request.Request(url, headers={"User-Agent": "gym-restore-cli"})
    with urllib.request.urlopen(req, timeout=120) as resp, open(path, "wb") as out:
        out.write(resp.read())
    return path


def cleanup(d, opts):
    if opts["keep_temp"]:
        return
    import shutil

    try:
        shutil.rmtree(d, ignore_errors=True)
    except Exception:
        pass
