from datetime import date
from unittest import mock

from core.testing import BaseAPITest

from attendance.models import Attendance

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