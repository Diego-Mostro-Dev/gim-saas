from datetime import date, time, timedelta
from decimal import Decimal
from unittest import mock

from django.utils import timezone

from core.testing import BaseAPITest, WEEKDAY_NAMES
from profiles.models import UserProfile

from activities.models import (
    Activity,
    ActivitySchedule,
    ActivitySessionRecord,
    Enrollment,
)
from attendance.models import Attendance, AttendanceSchedule, ScheduleSlot
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


class SessionRecoveryIdorTests(BaseAPITest):
    """El staff no puede recuperar sesiones referenciando actividades o
    clases de otro gimnasio."""

    def setUp(self):
        self.gym_a = self.create_gym("Gym A")
        self.gym_a.features["activities"] = True
        self.gym_a.allow_session_recovery = True
        self.gym_a.save()
        self.staff_a = self.create_user(
            self.gym_a, username="staff-a", role=UserProfile.ROLE_STAFF
        )
        self.member_a = self.create_member(self.gym_a, first_name="Ana", last_name="A")

        self.gym_b = self.create_gym("Gym B")
        self.activity_b = Activity.objects.create(
            service=Service.get_default_for_gym(self.gym_b),
            name="Yoga",
            billing_mode="sessions",
        )
        self.schedule_b = ActivitySchedule.objects.create(
            activity=self.activity_b,
            day=self.weekday_name(),
            start_time=time(9, 0),
            end_time=time(10, 0),
            capacity=10,
        )

        self.client.force_authenticate(user=self.staff_a)

    def test_recovery_rejects_activity_of_other_gym(self):
        resp = self.client.post(
            "/api/attendance/recoveries/",
            {
                "member": self.member_a.id,
                "kind": "activity",
                "activity": self.activity_b.id,
                "schedule_id": self.schedule_b.id,
                "date": (timezone.localdate() + timedelta(days=1)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.data["detail"], "Actividad no encontrada.")

    def test_recovery_rejects_schedule_of_other_gym(self):
        activity_a = Activity.objects.create(
            service=Service.get_default_for_gym(self.gym_a),
            name="Kinesio",
            billing_mode="sessions",
        )
        resp = self.client.post(
            "/api/attendance/recoveries/",
            {
                "member": self.member_a.id,
                "kind": "activity",
                "activity": activity_a.id,
                "schedule_id": self.schedule_b.id,
                "date": (timezone.localdate() + timedelta(days=1)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.data["detail"], "Clase no encontrada.")


class ScheduleRequestIdorTests(BaseAPITest):
    """IDOR cross-tenant: las solicitudes staff de cambio/intercambio no pueden
    referenciar socios u horarios de otro gimnasio, ni al crear ni en PATCH."""

    def setUp(self):
        self.gym_a = self.create_gym("Gym A")
        self.gym_a.schedule_change_notice_hours = 0
        self.gym_a.max_schedule_changes_per_month = 100
        self.gym_a.save(
            update_fields=["schedule_change_notice_hours", "max_schedule_changes_per_month"]
        )
        self.staff_a = self.create_user(
            self.gym_a, username="staff-a", role=UserProfile.ROLE_STAFF
        )
        self.member_a = self.create_member(self.gym_a, first_name="Ana", last_name="A")
        self.member_a2 = self.create_member(self.gym_a, first_name="Ali", last_name="A")
        self.slot_a = self.create_today_slot(self.gym_a)
        self.other_slot_a = ScheduleSlot.objects.create(
            gym=self.gym_a,
            day=self.weekday_name(),
            hour=time(11, 0),
        )
        self.schedule_a = self.create_attendance_schedule(
            self.member_a, self.gym_a, self.slot_a
        )

        self.gym_b = self.create_gym("Gym B")
        self.member_b = self.create_member(self.gym_b, first_name="Bea", last_name="B")
        self.slot_b = self.create_today_slot(self.gym_b)
        self.schedule_b = self.create_attendance_schedule(
            self.member_b, self.gym_b, self.slot_b
        )

        self.client.force_authenticate(user=self.staff_a)

    def _swap_destination(self):
        """Horario de destino mañana; día y fecha coherentes para el swap."""
        tomorrow = timezone.localdate() + timedelta(days=1)
        day = WEEKDAY_NAMES[tomorrow.weekday()]
        slot = ScheduleSlot.objects.create(
            gym=self.gym_a,
            day=day,
            hour=time(12, 0),
        )
        return slot, tomorrow

    def test_change_valid_create(self):
        resp = self.client.post(
            "/api/attendance/schedule-change-requests/",
            {
                "member": self.member_a.id,
                "current_schedule": self.schedule_a.id,
                "requested_slot": self.other_slot_a.id,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)

    def test_change_create_rejects_requested_slot_of_other_gym(self):
        resp = self.client.post(
            "/api/attendance/schedule-change-requests/",
            {
                "member": self.member_a.id,
                "current_schedule": self.schedule_a.id,
                "requested_slot": self.slot_b.id,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("requested_slot", resp.data)

    def test_change_create_rejects_member_of_other_gym(self):
        resp = self.client.post(
            "/api/attendance/schedule-change-requests/",
            {
                "member": self.member_b.id,
                "current_schedule": self.schedule_a.id,
                "requested_slot": self.other_slot_a.id,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("member", resp.data)

    def test_change_create_rejects_member_not_matching_schedule(self):
        resp = self.client.post(
            "/api/attendance/schedule-change-requests/",
            {
                "member": self.member_a2.id,
                "current_schedule": self.schedule_a.id,
                "requested_slot": self.other_slot_a.id,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_change_partial_patch_cannot_switch_slot_to_other_gym(self):
        valid = self.client.post(
            "/api/attendance/schedule-change-requests/",
            {
                "member": self.member_a.id,
                "current_schedule": self.schedule_a.id,
                "requested_slot": self.other_slot_a.id,
            },
            format="json",
        )
        self.assertEqual(valid.status_code, 201)

        resp = self.client.patch(
            f"/api/attendance/schedule-change-requests/{valid.data['id']}/",
            {"requested_slot": self.slot_b.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("requested_slot", resp.data)

    def test_swap_valid_create(self):
        destination, swap_date = self._swap_destination()
        resp = self.client.post(
            "/api/attendance/schedule-swap-requests/",
            {
                "member": self.member_a.id,
                "origin_schedule": self.schedule_a.id,
                "destination_slot": destination.id,
                "swap_date": swap_date,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)

    def test_swap_create_rejects_destination_slot_of_other_gym(self):
        resp = self.client.post(
            "/api/attendance/schedule-swap-requests/",
            {
                "member": self.member_a.id,
                "origin_schedule": self.schedule_a.id,
                "destination_slot": self.slot_b.id,
                "swap_date": timezone.localdate() + timedelta(days=1),
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("destination_slot", resp.data)

    def test_swap_partial_patch_cannot_switch_destination_to_other_gym(self):
        destination, swap_date = self._swap_destination()
        valid = self.client.post(
            "/api/attendance/schedule-swap-requests/",
            {
                "member": self.member_a.id,
                "origin_schedule": self.schedule_a.id,
                "destination_slot": destination.id,
                "swap_date": swap_date,
            },
            format="json",
        )
        self.assertEqual(valid.status_code, 201)

        resp = self.client.patch(
            f"/api/attendance/schedule-swap-requests/{valid.data['id']}/",
            {"destination_slot": self.slot_b.id},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("destination_slot", resp.data)
