"""Fase K4 — Asistencia y horarios.

- `ACC-02`: no hay ventana horaria de check-in (ni en el path público ni en
  el de staff): se puede marcar asistencia a las 03:00.
- `ACC-03`: el path público valida `GymClosedDate` y el de staff no.
- `ACC-04`: "Ya registraste asistencia hoy" responde 200 con
  `success:false` y el front no lo distingue de un éxito.
- `ACC-14`: aprobar un cambio de horario desactiva sólo `current_schedule`:
  si el staff editó la ficha con el pedido pendiente, el socio queda con dos
  horarios activos (y puede exceder `weekly_visits`).
"""

from datetime import date, time
from unittest import mock

from django.utils import timezone

from attendance.models import (
    Attendance,
    AttendanceSchedule,
    ScheduleChangeRequest,
    ScheduleSlot,
)
from core.testing import BaseAPITest
from gyms.models import GymClosedDate
from subscriptions.domain import ScheduleDomain

# Un lunes fijo: 2030-01-07 (el 1 de enero de 2030 es martes). El check-in
# resuelve el bloque recurrente por día de la semana, así que el test no
# puede depender del día en que corre la suite.
FIXED_TODAY = date(2030, 1, 7)


class _K4CheckinCase(BaseAPITest):
    """Fixture común: socio con suscripción vigente y bloque de los lunes."""

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.plan = self.create_plan(self.gym)
        self.member = self.create_member(self.gym)
        self.sub = self.open_month_subscription(
            self.member,
            self.plan,
            start_date=date(2000, 1, 1),
            end_date=date(2100, 12, 31),
        )
        self.settle_subscription(self.sub)
        self.slot = ScheduleSlot.objects.create(
            gym=self.gym,
            day="monday",
            hour=time(10, 0),
        )
        self.schedule = self.create_attendance_schedule(
            self.member, self.gym, self.slot, subscription=self.sub,
        )

    def checkin(self, at=None):
        """Check-in público con la hora del día simulada en `at`."""
        with mock.patch("django.utils.timezone.localdate", return_value=FIXED_TODAY):
            with mock.patch("django.utils.timezone.localtime") as localtime:
                localtime.return_value = timezone.make_aware(
                    timezone.datetime.combine(FIXED_TODAY, at or time(10, 0))
                )
                return self.client.post(
                    f"/api/attendance/checkin/{self.member.access_token}/"
                )

    def staff_register(self, at=None, when=None):
        """Asistencia cargada por el staff."""
        self.user = self.create_user(self.gym)
        self.client.force_authenticate(user=self.user)
        with mock.patch("django.utils.timezone.localdate", return_value=FIXED_TODAY):
            with mock.patch("django.utils.timezone.localtime") as localtime:
                localtime.return_value = timezone.make_aware(
                    timezone.datetime.combine(FIXED_TODAY, at or time(10, 0))
                )
                return self.client.post(
                    "/api/attendance/register/",
                    {
                        "member": self.member.pk,
                        "schedule": self.schedule.pk,
                        "date": str(FIXED_TODAY),
                    },
                    format="json",
                )


class Acc03ClosedDayTests(_K4CheckinCase):
    """ACC-03: el staff no puede marcar asistencia en un día cerrado."""

    def test_staff_cannot_register_on_a_closed_day(self):
        GymClosedDate.objects.create(gym=self.gym, date=FIXED_TODAY)

        resp = self.staff_register()

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertEqual(Attendance.objects.filter(member=self.member).count(), 0)

    def test_staff_can_register_on_an_open_day(self):
        resp = self.staff_register()

        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(Attendance.objects.filter(member=self.member).count(), 1)


class Acc04DuplicateCheckinTests(_K4CheckinCase):
    """ACC-04: el check-in repetido tiene que ser un 409, no un 200."""

    def test_duplicate_checkin_returns_409(self):
        first = self.checkin()
        self.assertEqual(first.status_code, 200, first.data)
        self.assertTrue(first.data["success"])

        Attendance.objects.filter(member=self.member).update(date=FIXED_TODAY)

        second = self.checkin()

        self.assertEqual(second.status_code, 409, second.data)
        self.assertFalse(second.data["success"])
        self.assertIn("Ya registraste asistencia hoy", second.data["message"])


class Acc02CheckinWindowTests(_K4CheckinCase):
    """ACC-02: la ventana horaria de check-in la define cada gimnasio."""

    def test_checkin_outside_the_window_is_rejected(self):
        self.gym.checkin_window_minutes = 30
        self.gym.save(update_fields=["checkin_window_minutes"])

        resp = self.checkin(at=time(3, 0))

        self.assertEqual(resp.status_code, 403, resp.data)
        self.assertFalse(resp.data["success"])
        self.assertEqual(Attendance.objects.filter(member=self.member).count(), 0)

    def test_checkin_inside_the_window_is_accepted(self):
        self.gym.checkin_window_minutes = 30
        self.gym.save(update_fields=["checkin_window_minutes"])

        resp = self.checkin(at=time(9, 45))

        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertTrue(resp.data["success"])
        self.assertEqual(Attendance.objects.filter(member=self.member).count(), 1)

    def test_without_window_nothing_changes(self):
        # default 0 = sin ventana: el check-in sigue aceptándose a cualquier
        # hora (no rompe los gimnasios ya instalados).
        resp = self.checkin(at=time(3, 0))

        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertTrue(resp.data["success"])

    def test_staff_registration_outside_the_window_is_rejected(self):
        self.gym.checkin_window_minutes = 30
        self.gym.save(update_fields=["checkin_window_minutes"])

        resp = self.staff_register(at=time(3, 0))

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertEqual(Attendance.objects.filter(member=self.member).count(), 0)

    def test_staff_registration_inside_the_window_is_accepted(self):
        self.gym.checkin_window_minutes = 30
        self.gym.save(update_fields=["checkin_window_minutes"])

        resp = self.staff_register(at=time(9, 45))

        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(Attendance.objects.filter(member=self.member).count(), 1)


class Cfg04StaffChangeLimitsTests(_K4CheckinCase):
    """CFG-04: el staff no puede saltear los límites de cambio de horario.

    El path público (el del socio) valida el cooldown y el máximo mensual;
    el del staff no, así que un pedido creado por API desde el panel del
    gym se saltaba los dos límites.
    """

    def setUp(self):
        super().setUp()
        self.user = self.create_user(self.gym)
        self.client.force_authenticate(user=self.user)
        self.gym.schedule_change_notice_hours = 0
        self.gym.save(update_fields=["schedule_change_notice_hours"])
        self.other_slot = ScheduleSlot.objects.create(
            gym=self.gym, day="wednesday", hour=time(18, 0),
        )

    def create_request(self):
        return self.client.post(
            "/api/attendance/schedule-change-requests/",
            {
                "member": self.member.pk,
                "current_schedule": self.schedule.pk,
                "requested_slot": self.other_slot.pk,
            },
            format="json",
        )

    def test_staff_change_respects_the_monthly_limit(self):
        self.gym.schedule_change_cooldown_hours = 0
        self.gym.max_schedule_changes_per_month = 1
        self.gym.save(update_fields=[
            "schedule_change_cooldown_hours",
            "max_schedule_changes_per_month",
        ])
        # Un cambio ya ejecutado cuenta para el límite del mes, pero no
        # choca con el unique de pedido pendiente.
        ScheduleChangeRequest.objects.create(
            gym=self.gym,
            member=self.member,
            current_schedule=self.schedule,
            requested_slot=self.other_slot,
            status="executed",
        )

        resp = self.create_request()

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("límite", str(resp.data).lower())
        self.assertEqual(ScheduleChangeRequest.objects.count(), 1)

    def test_staff_change_respects_the_cooldown(self):
        self.gym.schedule_change_cooldown_hours = 168
        self.gym.max_schedule_changes_per_month = 100
        self.gym.save(update_fields=[
            "schedule_change_cooldown_hours",
            "max_schedule_changes_per_month",
        ])
        ScheduleChangeRequest.objects.create(
            gym=self.gym,
            member=self.member,
            current_schedule=self.schedule,
            requested_slot=self.other_slot,
            status="executed",
        )

        resp = self.create_request()

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("cooldown", str(resp.data).lower())
        self.assertEqual(ScheduleChangeRequest.objects.count(), 1)

    def test_staff_change_within_the_limits_is_accepted(self):
        self.gym.schedule_change_cooldown_hours = 0
        self.gym.max_schedule_changes_per_month = 4
        self.gym.save(update_fields=[
            "schedule_change_cooldown_hours",
            "max_schedule_changes_per_month",
        ])

        resp = self.create_request()

        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertEqual(ScheduleChangeRequest.objects.count(), 1)


class Acc14ApproveScheduleChangeTests(BaseAPITest):

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.plan = self.create_plan(self.gym, weekly_visits=1)
        self.member = self.create_member(self.gym)
        self.sub = self.open_month_subscription(
            self.member,
            self.plan,
            start_date=date(2000, 1, 1),
            end_date=date(2100, 12, 31),
        )
        self.settle_subscription(self.sub)

        self.slot_a = ScheduleSlot.objects.create(
            gym=self.gym, day="monday", hour=time(10, 0),
        )
        self.slot_b = ScheduleSlot.objects.create(
            gym=self.gym, day="wednesday", hour=time(18, 0),
        )
        self.slot_c = ScheduleSlot.objects.create(
            gym=self.gym, day="friday", hour=time(20, 0),
        )
        self.schedule_a = self.create_attendance_schedule(
            self.member, self.gym, self.slot_a, subscription=self.sub,
        )
        self.request = ScheduleChangeRequest.objects.create(
            gym=self.gym,
            member=self.member,
            current_schedule=self.schedule_a,
            requested_slot=self.slot_b,
            status="pending",
        )

        self.user = self.create_user(self.gym)
        self.client.force_authenticate(user=self.user)

    def approve(self):
        return self.client.post(
            f"/api/attendance/schedule-change-requests/{self.request.pk}/approve/",
            {},
            format="json",
        )

    def test_approve_after_the_staff_edited_the_card_leaves_one_schedule(self):
        # El staff edita la ficha mientras el pedido está pendiente: A se
        # apaga y entra C.
        self.schedule_a.active = False
        self.schedule_a.save(update_fields=["active"])
        self.create_attendance_schedule(
            self.member, self.gym, self.slot_c, subscription=self.sub,
        )

        resp = self.approve()

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertEqual(
            AttendanceSchedule.objects.filter(
                member=self.member, active=True
            ).count(),
            1,
            "aprobar no puede dejar al socio con dos horarios activos",
        )

    def test_approve_cannot_exceed_the_weekly_visits_of_the_plan(self):
        # El plan baja a 1 visita semanal pero la ficha del socio quedó con 2
        # horarios activos: aprobar no puede dejar el exceso.
        self.create_attendance_schedule(
            self.member, self.gym, self.slot_c, subscription=self.sub,
        )

        resp = self.approve()

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("visita", str(resp.data).lower())
        self.assertEqual(
            AttendanceSchedule.objects.filter(
                member=self.member, active=True
            ).count(),
            2,
            "un pedido rechazado no puede tocar la ficha del socio",
        )

    def test_normal_approval_keeps_exactly_one_active_schedule(self):
        resp = self.approve()

        self.assertEqual(resp.status_code, 200, resp.data)
        active = AttendanceSchedule.objects.filter(member=self.member, active=True)
        self.assertEqual(active.count(), 1)
        self.assertEqual(active.first().slot, self.slot_b)
        self.assertFalse(
            AttendanceSchedule.objects.get(pk=self.schedule_a.pk).active
        )
        # El plan de 1 visita semanal se respeta: el socio sigue con 1.
        self.assertEqual(ScheduleDomain.get_active_schedule_count(self.member), 1)
