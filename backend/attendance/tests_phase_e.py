"""Fase E — regresiones de acceso/portal.

Un test por fix cerrado en la Fase E. El resto de los tests de asistencia
viven en ``attendance/tests.py``; este archivo existe para que cada bug
cerrado en la fase tenga su repro explícito citando el ID.
"""

from datetime import date
from unittest import mock

from django.utils import timezone
from rest_framework.exceptions import ValidationError

from core.testing import BaseAPITest
from members.models import Member

from attendance.models import Attendance

from attendance.models import Attendance, AttendanceSchedule, ScheduleSlot
from attendance.serializers import AttendanceSerializer

FIXED_TODAY = date(2030, 1, 7)  # un lunes


class CheckinCapacityTests(BaseAPITest):
    """ACC-01: el cupo no debe contar al propio socio que entra."""

    def setUp(self):
        super().setUp()
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
        self.slot.capacity = 1
        self.slot.save(update_fields=["capacity"])
        self.create_attendance_schedule(
            self.member, self.gym, self.slot, subscription=self.sub,
        )

    def test_checkin_not_blocked_by_own_schedule(self):
        with mock.patch(
            "django.utils.timezone.localdate", return_value=FIXED_TODAY
        ):
            resp = self.client.post(
                f"/api/attendance/checkin/{self.member.access_token}/"
            )

        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["success"])
        self.assertEqual(Attendance.objects.filter(member=self.member).count(), 1)


class StaffAttendanceDuplicateTests(BaseAPITest):
    """ACC-05: doble registro de staff → 400, nunca 500 (pre-check).

    El caso de carrera determinista (check-then-create bajo lock) está en
    ``AttendanceRaceTests``.
    """

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.owner = self.create_user(self.gym)
        self.plan = self.create_plan(self.gym)
        self.member = self.create_member(self.gym)
        self.sub = self.open_month_subscription(
            self.member, self.plan,
            start_date=date(2000, 1, 1),
            end_date=date(2100, 12, 31),
        )
        self.settle_subscription(self.sub)
        self.slot = self.create_today_slot(self.gym, day="monday")
        self.schedule = self.create_attendance_schedule(
            self.member, self.gym, self.slot, subscription=self.sub,
        )
        self.client.force_authenticate(user=self.owner)

    def test_second_staff_registration_is_400(self):
        payload = {"schedule": self.schedule.id}

        first = self.client.post("/api/attendance/register/", payload, format="json")
        self.assertEqual(first.status_code, 201)

        # El pre-check lee timezone.localdate(), que en el test es la fecha
        # real; alineamos la fila para que el guard dispare.
        Attendance.objects.filter(member=self.member).update(
            date=timezone.localdate()
        )

        second = self.client.post("/api/attendance/register/", payload, format="json")
        self.assertEqual(second.status_code, 400)
        self.assertIn("ya fue registrada", str(second.data))
        self.assertEqual(Attendance.objects.filter(member=self.member).count(), 1)


class AttendanceRaceTests(BaseAPITest):
    """ACC-05: dos creates concurrentes no pueden devolver 500.

    El pre-check del serializer es check-then-create sin lock, así que la
    segunda escritura choca contra el constraint (gym, schedule, date). El
    serializer debe traducir el IntegrityError a ValidationError, no dejarlo
    escalar como 500. Se simula la carrera determinísticamente: se valida el
    serializer, se inserta la fila conflictiva por fuera y recién ahí se
    guarda.
    """

    def setUp(self):
        self.gym = self.create_gym()
        self.owner = self.create_user(self.gym)
        self.plan = self.create_plan(self.gym)
        self.member = self.create_member(self.gym)
        sub = self.open_month_subscription(
            self.member, self.plan,
            start_date=date(2000, 1, 1),
            end_date=date(2100, 12, 31),
        )
        self.settle_subscription(sub)
        self.slot = self.create_today_slot(self.gym, day="monday")
        self.schedule = self.create_attendance_schedule(
            self.member, self.gym, self.slot, subscription=sub,
        )
        self.today = timezone.localdate()

    def test_concurrent_create_translates_integrity_error(self):
        class _Request:
            user = self.owner

        serializer = AttendanceSerializer(
            data={"schedule": self.schedule.id},
            context={"request": _Request()},
        )
        serializer.is_valid(raise_exception=True)

        # El "otro request" gana la carrera justo después del validate.
        Attendance.objects.create(
            gym=self.gym,
            member=self.member,
            schedule=self.schedule,
            slot=self.slot,
        )

        with self.assertRaises(ValidationError):
            serializer.save()

        self.assertEqual(
            Attendance.objects.filter(member=self.member, schedule=self.schedule).count(),
            1,
        )


class ScheduleChangeCooldownTests(BaseAPITest):
    """ACC-11: el cooldown no debe contar las solicitudes rechazadas."""

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.gym.schedule_change_cooldown_hours = 168
        self.gym.save(update_fields=["schedule_change_cooldown_hours"])
        self.plan = self.create_plan(self.gym)
        self.member = self.create_member(self.gym)
        self.sub = self.open_month_subscription(
            self.member, self.plan,
            start_date=date(2000, 1, 1),
            end_date=date(2100, 12, 31),
        )
        self.settle_subscription(self.sub)
        self.current_slot = self.create_today_slot(self.gym, day="monday", hour="10:00")
        self.requested_slot = self.create_today_slot(self.gym, day="tuesday", hour="11:00")
        self.schedule = self.create_attendance_schedule(
            self.member, self.gym, self.current_slot, subscription=self.sub,
        )

        from attendance.models import ScheduleChangeRequest

        ScheduleChangeRequest.objects.create(
            gym=self.gym,
            member=self.member,
            current_schedule=self.schedule,
            requested_slot=self.requested_slot,
            status="rejected",
        )

    def test_rejected_request_does_not_start_cooldown(self):
        resp = self.client.post(
            f"/api/attendance/public/schedule-change-requests/{self.member.access_token}/",
            {"current_schedule": self.schedule.id, "requested_slot": self.requested_slot.id},
            format="json",
        )

        self.assertEqual(resp.status_code, 201)


class ScheduleChangeConflictTests(BaseAPITest):
    """ACC-12: doble pedido de cambio de horario → 409, nunca 500."""

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.gym.schedule_change_cooldown_hours = 0
        self.gym.max_schedule_changes_per_month = 30
        self.gym.save(update_fields=[
            "schedule_change_cooldown_hours",
            "max_schedule_changes_per_month",
        ])
        self.plan = self.create_plan(self.gym)
        self.member = self.create_member(self.gym)
        self.sub = self.open_month_subscription(
            self.member, self.plan,
            start_date=date(2000, 1, 1),
            end_date=date(2100, 12, 31),
        )
        self.settle_subscription(self.sub)
        self.current_slot = self.create_today_slot(self.gym, day="monday", hour="10:00")
        self.requested_slot = self.create_today_slot(self.gym, day="tuesday", hour="11:00")
        self.schedule = self.create_attendance_schedule(
            self.member, self.gym, self.current_slot, subscription=self.sub,
        )
        self.url = (
            f"/api/attendance/public/schedule-change-requests/"
            f"{self.member.access_token}/"
        )

    def test_pending_duplicate_is_409_not_500(self):
        payload = {
            "current_schedule": self.schedule.id,
            "requested_slot": self.requested_slot.id,
        }

        first = self.client.post(self.url, payload, format="json")
        self.assertEqual(first.status_code, 201)

        # El cooldown está en 0, así que el segundo POST pasa el guard y choca
        # contra unique_pending_change_request.
        second = self.client.post(self.url, payload, format="json")
        self.assertEqual(second.status_code, 409)


class PublicDiscountIgnoredTests(BaseAPITest):
    """ACC-17: el alta pública descarta descuentos (privilegio de staff)."""

    def test_public_registration_warns_and_ignores_discount(self):
        from gyms.models import Discount

        gym = self.create_gym()
        self.create_today_slot(gym)
        plan = self.create_plan(gym)
        discount = Discount.objects.create(
            gym=gym, name="Amigo", discount_percent=50, active=True,
        )

        with self.assertLogs("members.public_views", level="WARNING") as logs:
            resp = self.client.post(
                f"/api/public/register/{gym.onboarding_code}/",
                {
                    "first_name": "Ana",
                    "last_name": "Gomez",
                    "phone": "11-5551234",
                    "document_number": "30111222",
                    "date_of_birth": "1990-05-04",
                    "services": ["gym"],
                    "schedules": [{"day": self.weekday_name(), "hour": "10:00"}],
                    "plan_id": plan.id,
                    "discount_id": discount.id,
                },
                format="json",
            )

        self.assertEqual(resp.status_code, 201)
        member = Member.objects.get(phone="11-5551234")
        self.assertIsNone(member.discount)
        self.assertTrue(any("privilegios" in line for line in logs.output))


class PortalTokenGraceTests(BaseAPITest):
    """ACC-18: los endpoints del portal aceptan el token de la generación
    anterior (una sola), y rechazan el de dos rotaciones atrás."""

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.plan = self.create_plan(self.gym)
        self.member = self.create_member(self.gym)
        self.sub = self.open_month_subscription(
            self.member, self.plan,
            start_date=date(2000, 1, 1),
            end_date=date(2100, 12, 31),
        )
        self.settle_subscription(self.sub)
        self.gen1 = self.member.access_token
        self.member.rotate_access_token()
        self.gen2 = self.member.access_token
        self.member.rotate_access_token()
        self.gen3 = self.member.access_token

    def test_previous_generation_token_still_works(self):
        resp = self.client.get(f"/api/attendance/public/slots/{self.gen2}/")
        self.assertEqual(resp.status_code, 200)

    def test_two_generations_back_is_rejected(self):
        resp = self.client.get(f"/api/attendance/public/slots/{self.gen1}/")
        self.assertEqual(resp.status_code, 404)

    def test_checkin_accepts_previous_generation_token(self):
        with mock.patch(
            "django.utils.timezone.localdate", return_value=FIXED_TODAY
        ):
            resp = self.client.post(f"/api/attendance/checkin/{self.gen2}/")
        # 403 (sin horario reservado para hoy) prueba que el token resolvió;
        # un token inválido sería 404.
        self.assertNotEqual(resp.status_code, 404)


class PortalThrottleSharedWifiTests(BaseAPITest):
    """ACC-06: el portal ya no limita por IP (un WiFi compartido agotaba el
    cupo y el socio nº 31 recibía 429).

    Se usa el manifiesto PWA del socio, que resuelve por token de portal y es
    barato: 35 requests desde la misma IP deben pasar. Con el throttle por IP
    de 30/h el request 31 habría dado 429.
    """

    def test_more_than_30_requests_from_same_ip_succeed(self):
        gym = self.create_gym()
        plan = self.create_plan(gym)
        member = self.create_member(gym)
        sub = self.open_month_subscription(
            member, plan,
            start_date=date(2000, 1, 1),
            end_date=date(2100, 12, 31),
        )
        self.settle_subscription(sub)
        member.active = True
        member.save(update_fields=["active"])

        url = f"/api/gyms/pwa/member/{member.access_token}/"
        for _ in range(35):
            resp = self.client.get(url)
            self.assertEqual(resp.status_code, 200)
