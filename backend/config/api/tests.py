from unittest import mock

from django.test import override_settings
from rest_framework.test import APITestCase


class HealthCheckTests(APITestCase):
    def test_health_is_public_and_reports_db(self):
        resp = self.client.get("/api/health/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["status"], "ok")
        self.assertEqual(resp.data["database"], "connected")


@override_settings(SCHEDULED_TASKS_KEY="test-task-key")
class BackupEndpointTests(APITestCase):
    def post(self, key=None):
        headers = {"HTTP_X_TASK_KEY": key} if key is not None else {}
        return self.client.post("/api/system/backup/", **headers)

    def test_requires_task_key(self):
        resp = self.post()
        self.assertEqual(resp.status_code, 403)

        resp = self.post(key="wrong-key")
        self.assertEqual(resp.status_code, 403)

    @mock.patch("config.api.backup.run_backup")
    def test_runs_backup_with_valid_key(self, run_backup):
        run_backup.return_value = {
            "source": "dumpdata",
            "file": "backup-2026-01-01T000000.json.gz",
            "size_bytes": 1234,
            "public_id": "gim-saas/backups/backup-2026-01-01T000000.json.gz",
            "download_url": "https://res.cloudinary.com/x/private/raw/...",
            "retention_kept": 14,
            "retention_deleted": 1,
        }
        resp = self.post(key="test-task-key")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["source"], "dumpdata")
        run_backup.assert_called_once()

    @mock.patch("config.api.backup.run_backup")
    def test_backup_failure_returns_500(self, run_backup):
        run_backup.side_effect = RuntimeError("cloudinary down")
        resp = self.post(key="test-task-key")
        self.assertEqual(resp.status_code, 500)
        self.assertIn("error", resp.data)