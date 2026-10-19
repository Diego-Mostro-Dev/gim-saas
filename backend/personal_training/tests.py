"""Tests focalizados de bugs de dinero (Fase 7 de PLAN-dinero.md, #2).

Por ahora cubren la invariante de la oferta de PT: una oferta por sesiones
no puede tener cuota mensual, porque sus dos modalidades se cobran por
caminos distintos y juntas hacen que el socio pague el paquete y además la
cuota todos los meses.

También cubren el endpoint público de solicitudes de cambio del portal del
socio, que tiraba 500 al comparar los strings que manda el front con los
``time`` del chequeo de solapamiento.
"""

from datetime import date, time
from decimal import Decimal

from django.urls import reverse

from activities.models import Activity, ActivitySchedule, Enrollment
from core.testing import BaseAPITest
from gyms.features import FEATURE_PERSONAL_TRAINING
from plans.models import Service
from profiles.models import UserProfile

from .models import (
    PersonalTrainingAssignment,
    PersonalTrainingChangeRequest,
    PersonalTrainingService,
)


class PTServicePriceInvariantTests(BaseAPITest):
    """Una oferta por sesiones se crea y se edita con monthly_price = 0."""

    URL = "/api/personal-training/services/"

    def setUp(self):
        self.gym = self.create_gym()
        self.gym.features = {FEATURE_PERSONAL_TRAINING: True}
        self.gym.save(update_fields=["features"])
        self.user = self.create_user(self.gym)
        self.client.force_authenticate(user=self.user)

    def _create(self, name, billing_mode, monthly_price):
        resp = self.client.post(
            self.URL,
            {
                "name": name,
                "billing_mode": billing_mode,
                "monthly_price": monthly_price,
            },
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        return PersonalTrainingService.objects.get(gym=self.gym, name=name)

    def test_sessions_offer_forces_monthly_price_to_zero(self):
        service = self._create("PT por sesiones", "sessions", "22000")

        self.assertEqual(service.monthly_price, Decimal("0"))

    def test_sessions_offer_without_price_stays_zero(self):
        service = self._create("PT sin precio", "sessions", "0")

        self.assertEqual(service.monthly_price, Decimal("0"))

    def test_monthly_offer_keeps_its_price(self):
        service = self._create("PT mensual", "monthly", "22000")

        self.assertEqual(service.monthly_price, Decimal("22000.00"))

    def test_monthly_offer_without_price_rejected(self):
        """CFG-09: una oferta mensual a $0 factura $0 y el gimnasio no cobra."""

        resp = self.client.post(
            self.URL,
            {
                "name": "PT sin precio",
                "billing_mode": "monthly",
                "monthly_price": "0",
            },
        )

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("monthly_price", resp.data)
        self.assertFalse(
            PersonalTrainingService.objects.filter(name="PT sin precio").exists()
        )

    def test_switching_to_sessions_zeroes_existing_price(self):
        service = self._create("PT mensual", "monthly", "22000")

        resp = self.client.patch(
            f"{self.URL}{service.id}/",
            {"billing_mode": "sessions"},
        )

        self.assertEqual(resp.status_code, 200, resp.data)
        service.refresh_from_db()
        self.assertEqual(service.monthly_price, Decimal("0"))

    def test_editing_price_of_sessions_offer_cannot_reintroduce_it(self):
        service = self._create("PT por sesiones", "sessions", "22000")

        resp = self.client.patch(
            f"{self.URL}{service.id}/",
            {"monthly_price": "22000"},
        )

        self.assertEqual(resp.status_code, 200, resp.data)
        service.refresh_from_db()
        self.assertEqual(service.monthly_price, Decimal("0"))

    def test_editing_price_of_monthly_offer_keeps_working(self):
        service = self._create("PT mensual", "monthly", "22000")

        resp = self.client.patch(
            f"{self.URL}{service.id}/",
            {"monthly_price": "25000"},
        )

        self.assertEqual(resp.status_code, 200, resp.data)
        service.refresh_from_db()
        self.assertEqual(service.monthly_price, Decimal("25000.00"))


class PublicChangeRequestTests(BaseAPITest):
    """El portal del socio crea y cancela solicitudes de cambio de horario.

    Regresión: la vista pública pasaba los strings del front ("07:00") al
    servicio sin pasar por un TimeField, y el chequeo de solapamiento
    comparaba ``datetime.time`` con ``str`` → TypeError → 500. Cualquier
    día que tuviera algo que comparar (horario fijo, actividad o PT) era
    in-solicitables.
    """

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.gym.features = {
            **self.gym.features,
            FEATURE_PERSONAL_TRAINING: True,
        }
        self.gym.save(update_fields=["features"])
        self.plan = self.create_plan(self.gym)
        self.member = self.create_member(self.gym)
        self.subscription = self.open_month_subscription(
            self.member,
            self.plan,
            start_date=date(2000, 1, 1),
            end_date=date(2100, 12, 31),
        )
        self.settle_subscription(self.subscription)
        self.trainer = self.create_user(
            self.gym,
            username="trainer1",
            role=UserProfile.ROLE_TRAINER,
        )
        self.pt_service = PersonalTrainingService.objects.create(
            gym=self.gym,
            service=Service.get_default_for_gym(self.gym),
            name="PT 1:1",
            duration_minutes=60,
        )
        self.assignment = PersonalTrainingAssignment.objects.create(
            gym=self.gym,
            member=self.member,
            trainer=self.trainer,
            service=self.pt_service,
            day="monday",
            start_time=time(7, 0),
            end_time=time(8, 0),
        )
        self.monday_slot = self.create_today_slot(
            self.gym, day="monday", hour="08:00"
        )
        self.url = reverse(
            "public-pt-change-request-create",
            kwargs={"token": self.member.access_token},
        )

    def request_change(self, **overrides):
        payload = {
            "assignment_id": self.assignment.id,
            "requested_day": "thursday",
            "requested_start_time": "09:00",
            "requested_end_time": "10:00",
        }
        payload.update(overrides)
        return self.client.post(self.url, payload, format="json")

    def add_fixed_gym_schedule(self):
        return self.create_attendance_schedule(
            self.member,
            self.gym,
            self.monday_slot,
            subscription=self.subscription,
        )

    def test_change_request_is_created_with_parsed_times(self):
        resp = self.request_change()

        self.assertEqual(resp.status_code, 201, resp.data)
        saved = PersonalTrainingChangeRequest.objects.get(
            assignment=self.assignment
        )
        self.assertEqual(saved.status, "pending")
        self.assertEqual(saved.requested_day, "thursday")
        self.assertEqual(saved.requested_start_time, time(9, 0))
        self.assertEqual(saved.requested_end_time, time(10, 0))

    def test_free_slot_on_day_with_fixed_schedule_returns_201(self):
        """El día con horario fijo era el que reventaba con 500.

        No hay solapamiento (el fijo termina 09:00 y se pide 09:00-10:00),
        así que la única diferencia con el bug es que la comparación de
        ``time`` contra ``str`` ya no lanza TypeError.
        """
        self.add_fixed_gym_schedule()

        resp = self.request_change(
            requested_day="monday",
            requested_start_time="09:00",
            requested_end_time="10:00",
        )

        self.assertEqual(resp.status_code, 201, resp.data)

    def test_slot_overlapping_fixed_schedule_returns_400(self):
        self.add_fixed_gym_schedule()

        resp = self.request_change(
            requested_day="monday",
            requested_start_time="08:00",
            requested_end_time="09:00",
        )

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertFalse(PersonalTrainingChangeRequest.objects.exists())

    def test_overlapping_activity_returns_400(self):
        activity = Activity.objects.create(
            service=Service.get_default_for_gym(self.gym),
            name="Yoga",
        )
        schedule = ActivitySchedule.objects.create(
            activity=activity,
            day="tuesday",
            start_time=time(9, 0),
            end_time=time(10, 0),
            capacity=10,
        )
        Enrollment.objects.create(
            gym=self.gym,
            member=self.member,
            schedule=schedule,
            active=True,
        )

        resp = self.request_change(
            requested_day="tuesday",
            requested_start_time="09:00",
            requested_end_time="10:00",
        )

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertFalse(PersonalTrainingChangeRequest.objects.exists())

    def test_overlapping_trainer_assignment_returns_400(self):
        PersonalTrainingAssignment.objects.create(
            gym=self.gym,
            member=self.create_member(self.gym, first_name="Otro"),
            trainer=self.trainer,
            service=self.pt_service,
            day="friday",
            start_time=time(15, 0),
            end_time=time(16, 0),
        )

        resp = self.request_change(
            requested_day="friday",
            requested_start_time="15:30",
            requested_end_time="16:30",
        )

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertFalse(PersonalTrainingChangeRequest.objects.exists())

    def test_same_schedule_returns_400(self):
        resp = self.request_change(
            requested_day="monday",
            requested_start_time="07:00",
            requested_end_time="08:00",
        )

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("mismo", str(resp.data))
        self.assertFalse(PersonalTrainingChangeRequest.objects.exists())

    def test_end_before_start_returns_400(self):
        resp = self.request_change(
            requested_start_time="10:00",
            requested_end_time="09:00",
        )

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertFalse(PersonalTrainingChangeRequest.objects.exists())

    def test_invalid_time_returns_400(self):
        resp = self.request_change(requested_start_time="25:99")

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertFalse(PersonalTrainingChangeRequest.objects.exists())

    def test_invalid_day_returns_400(self):
        resp = self.request_change(requested_day="lunes")

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertFalse(PersonalTrainingChangeRequest.objects.exists())

    def test_missing_fields_return_400(self):
        resp = self.client.post(
            self.url,
            {"assignment_id": self.assignment.id},
            format="json",
        )

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertFalse(PersonalTrainingChangeRequest.objects.exists())

    def test_second_pending_request_returns_409(self):
        first = self.request_change()
        self.assertEqual(first.status_code, 201, first.data)

        second = self.request_change(
            requested_start_time="11:00",
            requested_end_time="12:00",
        )

        self.assertEqual(second.status_code, 409, second.data)
        self.assertEqual(
            PersonalTrainingChangeRequest.objects.filter(
                assignment=self.assignment
            ).count(),
            1,
        )

    def test_cannot_create_request_for_another_members_assignment(self):
        other = PersonalTrainingAssignment.objects.create(
            gym=self.gym,
            member=self.create_member(self.gym, first_name="Otra"),
            trainer=self.trainer,
            service=self.pt_service,
            day="saturday",
            start_time=time(10, 0),
            end_time=time(11, 0),
        )

        resp = self.request_change(assignment_id=other.id, requested_day="saturday")

        self.assertEqual(resp.status_code, 404, resp.data)
        self.assertFalse(PersonalTrainingChangeRequest.objects.exists())

    def test_member_cancels_own_pending_request(self):
        created = self.request_change()
        self.assertEqual(created.status_code, 201, created.data)

        cancel_url = reverse(
            "public-pt-change-request-cancel",
            kwargs={
                "token": self.member.access_token,
                "request_id": created.data["id"],
            },
        )
        resp = self.client.delete(cancel_url)

        self.assertEqual(resp.status_code, 200, resp.data)
        saved = PersonalTrainingChangeRequest.objects.get(
            id=created.data["id"]
        )
        self.assertEqual(saved.status, "cancelled_by_member")

    def test_feature_disabled_returns_403(self):
        self.gym.features = {**self.gym.features, FEATURE_PERSONAL_TRAINING: False}
        self.gym.save(update_fields=["features"])

        resp = self.request_change()

        self.assertEqual(resp.status_code, 403, resp.data)
        self.assertEqual(resp.data.get("code"), "FEATURE_DISABLED")
