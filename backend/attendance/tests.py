from datetime import date, time, timedelta
from decimal import Decimal
from unittest import mock

from core.testing import BaseAPITest

from activities.models import (
    Activity,
    ActivitySchedule,
    ActivitySessionRecord,
    Enrollment,
)
from attendance.models import Attendance
from attendance.recovery_service import grant_scheduled
from plans.models import Service

# A fixed Monday: 2030-01-07 (Jan 1 2030 is a Tuesday). Check-in resolves the
# member's recurring slot by weekday, so the test must not depend on the day
# the suite actually runs (Sunday has no slot in DAY_CHOICES).
FIXED_TODAY = date(2030, 1, 7)


class _CheckinTestCase(BaseAPITest):
    """Patches timezone.localdate so slot matching is deterministic (a Monday).

    Eligibility (can_operate) resolves the current subscription with the real
    date.today(), so the fixture subscription spans a wide range that covers
    both the real run date and the frozen Monday.
    """

    def setUp(self):
        self.gym = self.create_gym()
        self.plan = self.create_plan(self.gym)
        self.member = self.create_member(self.gym)
        self.sub = self.open_month_subscription(
            self.member, self.plan,
            start_date=date(2000, 1, 1),
            end_date=date(2100, 12, 31),
        )
        self.settle_subscription(self.sub)
        self.slot = self.create_today_slot(self.gym, day="monday")

    def checkin(self, token=None):
        with mock.patch(
            "django.utils.timezone.localdate", return_value=FIXED_TODAY
        ):
            return self.client.post(
                f"/api/attendance/checkin/{token or self.member.access_token}/"
            )


class PublicCheckinTests(_CheckinTestCase):

    def test_checkin_success(self):
        self.create_attendance_schedule(
            self.member, self.gym, self.slot, subscription=self.sub,
        )

        resp = self.checkin()

        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["success"])
        self.assertEqual(Attendance.objects.filter(member=self.member).count(), 1)

    def test_checkin_without_schedule_rejected(self):
        resp = self.checkin()

        self.assertEqual(resp.status_code, 403)
        self.assertIn("horario reservado", resp.data["message"])
        self.assertEqual(Attendance.objects.count(), 0)

    def test_duplicate_checkin_detected(self):
        schedule = self.create_attendance_schedule(
            self.member, self.gym, self.slot, subscription=self.sub,
        )

        first = self.checkin()
        self.assertTrue(first.data["success"])

        # Align the recorded attendance's date with the frozen today so the
        # daily-duplicate guard fires (auto_now_add would otherwise stamp the
        # real run date).
        Attendance.objects.filter(member=self.member).update(date=FIXED_TODAY)

        second = self.checkin()

        self.assertFalse(second.data["success"])
        self.assertIn("Ya registraste asistencia hoy", second.data["message"])


class PublicCheckinAccessTests(BaseAPITest):

    def test_unknown_token_returns_404(self):
        resp = self.client.post("/api/attendance/checkin/token-inexistente/")
        self.assertEqual(resp.status_code, 404)

    def test_suspended_member_without_subscription_rejected(self):
        self.gym = self.create_gym()
        member = self.create_member(self.gym)
        member.active = True
        member.save(update_fields=["active"])

        with mock.patch(
            "django.utils.timezone.localdate", return_value=FIXED_TODAY
        ), mock.patch("subscriptions.domain.date", wraps=date):
            resp = self.client.post(
                f"/api/attendance/checkin/{member.access_token}/"
            )

        self.assertEqual(resp.status_code, 403)
        self.assertIn("Acceso suspendido", resp.data["message"])


class RecoveryCancelsNoShowTests(BaseAPITest):

    def setUp(self):
        self.gym = self.create_gym()
        self.gym.allow_session_recovery = True
        self.gym.save(update_fields=["allow_session_recovery"])
        self.plan = self.create_plan(self.gym)
        self.member = self.create_member(self.gym)
        self.sub = self.open_month_subscription(
            self.member, self.plan,
            start_date=date(2000, 1, 1),
            end_date=date(2100, 12, 31),
        )
        self.settle_subscription(self.sub)

        self.target_date = date.today() + timedelta(days=1)
        self.activity = Activity.objects.create(
            service=Service.get_default_for_gym(self.gym),
            name="Kinesio",
            billing_mode="sessions",
        )
        self.schedule = ActivitySchedule.objects.create(
            activity=self.activity,
            day=self.weekday_name(self.target_date),
            start_time=time(9, 0),
            end_time=time(10, 0),
            capacity=10,
        )
        self.enrollment = Enrollment.objects.create(
            gym=self.gym,
            member=self.member,
            schedule=self.schedule,
            modality="package",
            package_total_sessions=10,
            session_price=Decimal("2500.00"),
            amount_paid=Decimal("25000.00"),
        )

    def test_grant_activity_recovery_cancels_pending_no_show(self):
        ActivitySessionRecord.objects.create(
            gym=self.gym,
            member=self.member,
            enrollment=self.enrollment,
            schedule=self.schedule,
            date=date.today() - timedelta(days=7),
            source="no_show",
        )

        grant_scheduled(
            self.gym,
            self.member,
            kind="activity",
            activity=self.activity,
            target_date=self.target_date,
            schedule=self.schedule,
        )

        self.assertEqual(
            ActivitySessionRecord.objects.filter(source="no_show").count(), 0
        )
        self.assertEqual(self.enrollment.session_records.count(), 0)
