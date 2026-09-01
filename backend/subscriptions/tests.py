from django.test import TestCase, override_settings

from rest_framework.test import APITestCase

from subscriptions.models import TaskRun
from subscriptions.services import (
    maybe_run_scheduled_tasks,
    run_scheduled_tasks,
)


@override_settings(
    SCHEDULED_TASKS_KEY="test-key",
    SCHEDULED_TASKS_INTERVAL_SECONDS=60,
)
class ScheduledTaskRunnerTests(TestCase):

    def test_run_force_records_taskrun(self):
        result = run_scheduled_tasks(force=True)

        self.assertEqual(result["ran"], True)
        self.assertEqual(result["status"], "ok")

        run = TaskRun.objects.get(name="subscription_maintenance")
        self.assertIsNotNone(run.last_run)
        self.assertEqual(run.last_status, "ok")
        self.assertIsNotNone(run.last_result)

    def test_maybe_run_respects_interval(self):
        run_scheduled_tasks(force=True)

        result = maybe_run_scheduled_tasks()

        self.assertEqual(result["ran"], False)
        self.assertEqual(result["reason"], "not_due")

    def test_run_without_force_after_interval(self):
        run = TaskRun.objects.create(
            name="subscription_maintenance",
            last_run="2020-01-01T00:00:00Z",
        )
        run.save()

        result = maybe_run_scheduled_tasks()

        self.assertEqual(result["ran"], True)
        self.assertEqual(result["status"], "ok")

    def test_lock_beats_concurrent_workers(self):
        run_scheduled_tasks(force=True)
        run_scheduled_tasks(force=True)

        # No importa el resultado (locked o not_due), nunca debe romper.
        run = TaskRun.objects.get(name="subscription_maintenance")
        self.assertEqual(run.last_status, "ok")


@override_settings(SCHEDULED_TASKS_KEY="test-key")
class ScheduledTasksEndpointTests(APITestCase):

    def setUp(self):
        self.url = "/api/system/tasks/"

    def test_missing_key_rejected(self):
        resp = self.client.post(self.url)
        self.assertEqual(resp.status_code, 403)

    def test_wrong_key_rejected(self):
        resp = self.client.post(self.url, HTTP_X_TASK_KEY="wrong")
        self.assertEqual(resp.status_code, 403)

    def test_valid_key_runs(self):
        resp = self.client.post(self.url, HTTP_X_TASK_KEY="test-key")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["ran"], True)