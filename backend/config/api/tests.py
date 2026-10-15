from unittest import mock

from datetime import time as _time
from decimal import Decimal

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from activities.models import Activity, ActivitySchedule, Enrollment
from core.testing import BaseAPITest
from payments.models import Payment
from plans.models import Service
from subscriptions.services import get_last_day_of_month


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
        self.assertIn("detail", resp.data)


@override_settings(SCHEDULED_TASKS_KEY="test-task-key")
class SentryTestEndpointTests(APITestCase):
    def post(self, key=None):
        # Unhandled exceptions are re-raised by default in tests; we want the
        # real 500 Response the endpoint produces.
        self.client.raise_request_exception = False
        headers = {"HTTP_X_TASK_KEY": key} if key is not None else {}
        return self.client.post("/api/system/sentry-test/", **headers)

    def test_requires_task_key(self):
        resp = self.post()
        self.assertEqual(resp.status_code, 403)

        resp = self.post(key="wrong-key")
        self.assertEqual(resp.status_code, 403)

    def test_valid_key_raises(self):
        resp = self.post(key="test-task-key")
        self.assertEqual(resp.status_code, 500)


class DashboardSerializationTests(BaseAPITest):
    """P26 — el dashboard serializa importes como string, no float.

    El endpoint construía el payload con ``float()`` sobre los ``Decimal`` de
    los servicios. ``float`` pierde exactitud en importes grandes y además
    rompe la consistencia con ``/outstanding``, que ya devuelve strings. El
    frontend consume estos campos con ``Number(...)``, así que el string es
    seguro.
    """

    REVENUE = Decimal("5000.00")
    SESSION_PRICE = Decimal("2500.00")
    SESSIONS = 10

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.user = self.create_user(self.gym)
        self.client.force_authenticate(user=self.user)
        self.plan = self.create_plan(self.gym)

        today = timezone.localdate()
        month_start = today.replace(day=1)

        debtor = self.create_member(
            self.gym, first_name="Ana", last_name="Deudor", phone="11-deudor"
        )
        self.open_month_subscription(
            debtor,
            self.plan,
            start_date=month_start,
            end_date=get_last_day_of_month(month_start),
            paid=False,
        )

        payer = self.create_member(
            self.gym, first_name="Pago", last_name="AlDia", phone="11-pago"
        )
        Payment.objects.create(
            gym=self.gym,
            member=payer,
            amount=self.REVENUE,
            payment_method="cash",
            member_name="Pago AlDia",
            plan_name=self.plan.name,
        )

        packaged = self.create_member(
            self.gym, first_name="Paquete", last_name="Actividad", phone="11-pkg"
        )
        activity = Activity.objects.create(
            service=Service.get_default_for_gym(self.gym),
            name="Kinesio",
            billing_mode="sessions",
        )
        schedule = ActivitySchedule.objects.create(
            activity=activity,
            day="monday",
            start_time=_time(9, 0),
            end_time=_time(10, 0),
            capacity=10,
        )
        Enrollment.objects.create(
            gym=self.gym,
            member=packaged,
            schedule=schedule,
            modality="package",
            package_total_sessions=self.SESSIONS,
            session_price=self.SESSION_PRICE,
            amount_paid=Decimal("0"),
        )

    def _dashboard(self):
        resp = self.client.get("/api/dashboard/")
        self.assertEqual(resp.status_code, 200)
        return resp.data

    def test_money_fields_are_strings(self):
        data = self._dashboard()

        self.assertIsInstance(data["currentMonthRevenue"], str)
        self.assertIsInstance(data["previousMonthRevenue"], str)
        self.assertTrue(data["pendingPayments"])
        for row in data["pendingPayments"]:
            self.assertIsInstance(row["remaining"], str)
            self.assertNotEqual(row["remaining"], "")

    def test_revenue_values_are_decimal_strings(self):
        data = self._dashboard()

        self.assertEqual(data["currentMonthRevenue"], "5000.00")
        self.assertEqual(data["previousMonthRevenue"], "0.00")

    def test_recent_activity_amount_is_formatted_string(self):
        data = self._dashboard()

        descriptions = [item["description"] for item in data["recentActivity"]]
        self.assertIn("Pago registrado — Pago AlDia — $5,000.00", descriptions)
