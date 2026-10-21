"""Fase K2 — add-ons: solapes, renovaciones y bajas.

Cubre ``ADD-28`` (lado salidas): el ítem de suscripción es **por oferta**,
no por horario. Darse de baja de un horario cancelaba el único ítem de la
oferta, así que el socio seguía inscripto en el otro horario de la misma
salida pero dejaba de pagarla. PT ya tenía el guard ``other_active``;
actividades y salidas no.

También ``ADD-16`` (choque de horarios en las salidas) y ``ADD-14``
(renovar un paquete con saldo impago).

Corre contra Postgres real, nunca SQLite ni la base de desarrollo.
"""

from datetime import time
from decimal import Decimal

from activities.models import Activity, ActivitySchedule, Enrollment
from core.testing import BaseAPITest
from outings.enrollment_request_service import (
    OutingEnrollmentRequestError,
    OutingEnrollmentRequestService,
)
from outings.enrollment_service import (
    OutingEnrollmentError,
    OutingEnrollmentService,
)
from outings.models import (
    Outing,
    OutingEnrollment,
    OutingEnrollmentRequest,
    OutingSchedule,
)
from outings.session_service import SessionError as OutingSessionError
from outings.session_service import SessionService as OutingSessionService
from personal_training.models import (
    PersonalTrainingAssignment,
    PersonalTrainingService,
)
from plans.models import Service
from subscriptions.models import SubscriptionItem


class Add28OutingItemTests(BaseAPITest):
    """ADD-28 (salidas): el ítem se cancela sólo con la última baja."""

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.gym.features = {**self.gym.features, "salidas": True}
        self.gym.save(update_fields=["features"])
        self.member = self.create_member(self.gym)
        self.outing = Outing.objects.create(
            gym=self.gym,
            service=Service.get_default_for_gym(self.gym),
            name="Trekking",
            billing_mode="monthly",
            monthly_price=Decimal("4000.00"),
        )
        self.saturday = OutingSchedule.objects.create(
            outing=self.outing,
            day="saturday",
            start_time=time(8, 0),
            end_time=time(10, 0),
            capacity=10,
        )
        self.sunday = OutingSchedule.objects.create(
            outing=self.outing,
            day="sunday",
            start_time=time(8, 0),
            end_time=time(10, 0),
            capacity=10,
        )
        self.plan = self.create_plan(self.gym, price=Decimal("10000.00"))
        self.subscription = self.open_month_subscription(self.member, self.plan)
        self.settle_subscription(self.subscription)

    def _enroll(self, schedule):
        return OutingEnrollmentService.enroll_member(
            self.member, schedule, skip_eligibility_check=True
        )

    def _item(self):
        return SubscriptionItem.objects.get(
            subscription=self.subscription, outing=self.outing
        )

    def test_unenroll_keeps_the_item_while_another_schedule_is_active(self):
        self._enroll(self.saturday)
        self._enroll(self.sunday)
        item = self._item()
        self.assertEqual(item.status, "active")

        OutingEnrollmentService.unenroll_member(self.member, self.saturday)

        item.refresh_from_db()
        self.assertEqual(
            item.status,
            "active",
            "El socio sigue inscripto el domingo: cancelar el ítem lo dejaba "
            "de cobrar sin dejar de usar la oferta.",
        )

    def test_unenroll_of_the_last_schedule_cancels_the_item(self):
        self._enroll(self.saturday)
        self._enroll(self.sunday)

        OutingEnrollmentService.unenroll_member(self.member, self.saturday)
        OutingEnrollmentService.unenroll_member(self.member, self.sunday)

        item = self._item()
        self.assertEqual(item.status, "cancelled")

    def test_unenroll_of_a_single_schedule_cancels_the_item(self):
        self._enroll(self.saturday)

        OutingEnrollmentService.unenroll_member(self.member, self.saturday)

        item = self._item()
        self.assertEqual(item.status, "cancelled")

    def test_other_outing_does_not_keep_the_item_alive(self):
        other = Outing.objects.create(
            gym=self.gym,
            service=Service.get_default_for_gym(self.gym),
            name="Caminata",
            billing_mode="monthly",
            monthly_price=Decimal("4000.00"),
        )
        other_schedule = OutingSchedule.objects.create(
            outing=other,
            day="wednesday",
            start_time=time(8, 0),
            end_time=time(10, 0),
            capacity=10,
        )
        self._enroll(self.saturday)
        self._enroll(other_schedule)

        OutingEnrollmentService.unenroll_member(self.member, self.saturday)

        item = self._item()
        self.assertEqual(item.status, "cancelled")


class Add16OutingOverlapTests(BaseAPITest):
    """ADD-16: las salidas validan el choque con la agenda del socio.

    Antes el socio quedaba anotado en dos cosas a la misma hora: las
    salidas no tenían ninguna validación de solape (ni con el horario fijo
    del gimnasio, ni con actividades, ni con PT, ni con otra salida).
    """

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.gym.features = {
            **self.gym.features,
            "activities": True,
            "salidas": True,
        }
        self.gym.save(update_fields=["features"])
        self.member = self.create_member(self.gym)
        self.plan = self.create_plan(self.gym, price=Decimal("10000.00"))
        self.subscription = self.open_month_subscription(self.member, self.plan)
        self.settle_subscription(self.subscription)
        self.outing = Outing.objects.create(
            gym=self.gym,
            service=Service.get_default_for_gym(self.gym),
            name="Trekking",
            billing_mode="monthly",
            monthly_price=Decimal("4000.00"),
        )
        self.schedule = OutingSchedule.objects.create(
            outing=self.outing,
            day="monday",
            start_time=time(9, 0),
            end_time=time(10, 0),
            capacity=10,
        )

    def _enroll(self, schedule=None):
        return OutingEnrollmentService.enroll_member(
            self.member, schedule or self.schedule, skip_eligibility_check=True
        )

    def _add_fixed_gym_schedule(self):
        slot = self.create_today_slot(self.gym, day="monday", hour="09:00")
        return self.create_attendance_schedule(self.member, self.gym, slot)

    def _add_activity(self, day="monday"):
        activity = Activity.objects.create(
            service=Service.get_default_for_gym(self.gym),
            name="Yoga",
            monthly_price=Decimal("5000.00"),
        )
        schedule = ActivitySchedule.objects.create(
            activity=activity,
            day=day,
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
        return activity

    def _add_pt_assignment(self, day="monday"):
        service = PersonalTrainingService.objects.create(
            gym=self.gym,
            service=Service.get_default_for_gym(self.gym),
            name="Entrenamiento personal",
            billing_mode="sessions",
        )
        trainer = self.create_user(self.gym, username="trainer", role="staff")
        return PersonalTrainingAssignment.objects.create(
            gym=self.gym,
            member=self.member,
            trainer=trainer,
            service=service,
            day=day,
            start_time=time(9, 0),
            end_time=time(10, 0),
        )

    def test_enroll_without_conflicts_is_allowed(self):
        enrollment = self._enroll()

        self.assertTrue(enrollment.active)

    def test_enroll_conflicting_with_the_gym_schedule_is_rejected(self):
        self._add_fixed_gym_schedule()

        with self.assertRaises(OutingEnrollmentError) as ctx:
            self._enroll()

        self.assertIn("horario fijo", str(ctx.exception))

    def test_enroll_conflicting_with_an_activity_is_rejected(self):
        self._add_activity()

        with self.assertRaises(OutingEnrollmentError) as ctx:
            self._enroll()

        self.assertIn("actividad", str(ctx.exception))

    def test_enroll_conflicting_with_a_pt_assignment_is_rejected(self):
        self._add_pt_assignment()

        with self.assertRaises(OutingEnrollmentError) as ctx:
            self._enroll()

        self.assertIn("entrenamiento personal", str(ctx.exception))

    def test_enroll_conflicting_with_another_outing_is_rejected(self):
        other = Outing.objects.create(
            gym=self.gym,
            service=Service.get_default_for_gym(self.gym),
            name="Caminata",
            billing_mode="monthly",
            monthly_price=Decimal("4000.00"),
        )
        other_schedule = OutingSchedule.objects.create(
            outing=other,
            day="monday",
            start_time=time(9, 30),
            end_time=time(10, 30),
            capacity=10,
        )
        self._enroll(other_schedule)

        with self.assertRaises(OutingEnrollmentError) as ctx:
            self._enroll()

        self.assertIn("salida", str(ctx.exception))

    def test_enroll_on_another_day_is_allowed(self):
        self._add_fixed_gym_schedule()
        self._add_activity()
        self._add_pt_assignment()

        tuesday = OutingSchedule.objects.create(
            outing=self.outing,
            day="tuesday",
            start_time=time(9, 0),
            end_time=time(10, 0),
            capacity=10,
        )

        enrollment = self._enroll(tuesday)

        self.assertTrue(enrollment.active)

    def test_enroll_at_a_different_time_of_the_same_day_is_allowed(self):
        self._add_activity()

        later = OutingSchedule.objects.create(
            outing=self.outing,
            day="monday",
            start_time=time(18, 0),
            end_time=time(19, 0),
            capacity=10,
        )

        enrollment = self._enroll(later)

        self.assertTrue(enrollment.active)

    def test_api_enroll_returns_400_on_conflict(self):
        self._add_activity()
        self.create_user(self.gym, username="staff", role="staff")
        self.client.force_authenticate(user=self.create_user(self.gym, "staff2"))

        resp = self.client.post(
            f"/api/outings/schedules/{self.schedule.id}/enroll/",
            {"member_id": self.member.id, "modality": "monthly"},
            format="json",
        )

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("superpone", str(resp.data))


class Add16OutingRequestTests(BaseAPITest):
    """ADD-16: la solicitud de inscripción a una salida también valida.

    Sin esto el socio pedía el horario en conflicto, el staff lo aprobaba
    y el error le salía recién al aprobar.
    """

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.gym.features = {**self.gym.features, "salidas": True}
        self.gym.save(update_fields=["features"])
        self.member = self.create_member(self.gym)
        self.plan = self.create_plan(self.gym, price=Decimal("10000.00"))
        self.subscription = self.open_month_subscription(self.member, self.plan)
        self.settle_subscription(self.subscription)
        self.outing = Outing.objects.create(
            gym=self.gym,
            service=Service.get_default_for_gym(self.gym),
            name="Trekking",
            billing_mode="monthly",
            monthly_price=Decimal("4000.00"),
        )
        self.schedule = OutingSchedule.objects.create(
            outing=self.outing,
            day="monday",
            start_time=time(9, 0),
            end_time=time(10, 0),
            capacity=10,
        )

    def _request(self):
        return OutingEnrollmentRequestService.create_enroll_request(
            self.member, self.schedule
        )

    def test_request_without_conflicts_is_created(self):
        request = self._request()

        self.assertEqual(request.status, "pending")

    def test_request_conflicting_with_an_activity_is_rejected(self):
        activity = Activity.objects.create(
            service=Service.get_default_for_gym(self.gym),
            name="Yoga",
            monthly_price=Decimal("5000.00"),
        )
        activity_schedule = ActivitySchedule.objects.create(
            activity=activity,
            day="monday",
            start_time=time(9, 0),
            end_time=time(10, 0),
            capacity=10,
        )
        Enrollment.objects.create(
            gym=self.gym,
            member=self.member,
            schedule=activity_schedule,
            active=True,
        )

        with self.assertRaises(OutingEnrollmentRequestError) as ctx:
            self._request()

        self.assertIn("actividad", str(ctx.exception))
        self.assertFalse(OutingEnrollmentRequest.objects.exists())


def _package_outing(gym, member, session_price="2000.00", total=10):
    outing = Outing.objects.create(
        gym=gym,
        service=Service.get_default_for_gym(gym),
        name="Trekking",
        billing_mode="sessions",
    )
    schedule = OutingSchedule.objects.create(
        outing=outing,
        day="saturday",
        start_time=time(8, 0),
        end_time=time(10, 0),
        capacity=10,
    )
    enrollment = OutingEnrollment.objects.create(
        gym=gym,
        member=member,
        schedule=schedule,
        modality="package",
        package_total_sessions=total,
        session_price=Decimal(session_price),
        amount_paid=Decimal("0"),
    )
    return outing, schedule, enrollment


def _package_pt(gym, member, trainer, session_price="3000.00", total=10):
    service = PersonalTrainingService.objects.create(
        gym=gym,
        service=Service.get_default_for_gym(gym),
        name="Entrenamiento personal",
        billing_mode="sessions",
    )
    assignment = PersonalTrainingAssignment.objects.create(
        gym=gym,
        member=member,
        trainer=trainer,
        service=service,
        day="monday",
        start_time=time(9, 0),
        end_time=time(10, 0),
        modality="package",
        package_total_sessions=total,
        session_price=Decimal(session_price),
        amount_paid=Decimal("0"),
    )
    return service, assignment

class Add14OutingRenewTests(BaseAPITest):
    """ADD-14: renovar un paquete de salida con saldo impago."""

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.gym.features = {**self.gym.features, "salidas": True}
        self.gym.save(update_fields=["features"])
        self.member = self.create_member(self.gym)
        self.outing, self.schedule, self.enrollment = _package_outing(
            self.gym, self.member
        )

    def test_renew_with_unpaid_balance_is_rejected_by_default(self):
        with self.assertRaises(OutingSessionError) as ctx:
            OutingSessionService.renew_package(self.enrollment, 5)

        self.assertIn("sin cobrar", str(ctx.exception))
        self.enrollment.refresh_from_db()
        self.assertEqual(self.enrollment.package_total_sessions, 10)

    def test_renew_with_allow_unpaid_succeeds(self):
        enrollment = OutingSessionService.renew_package(
            self.enrollment, 5, allow_unpaid=True
        )

        self.assertEqual(enrollment.package_total_sessions, 15)

    def test_renew_without_unpaid_balance_is_allowed(self):
        self.enrollment.amount_paid = self.enrollment.total_amount
        self.enrollment.save(update_fields=["amount_paid"])

        enrollment = OutingSessionService.renew_package(self.enrollment, 5)

        self.assertEqual(enrollment.package_total_sessions, 15)

    def test_api_renew_returns_400_without_the_override(self):
        self.client.force_authenticate(
            user=self.create_user(self.gym, username="staff", role="staff")
        )

        resp = self.client.post(
            f"/api/outings/enrollments/{self.enrollment.id}/renew/",
            {"additional_sessions": 5},
            format="json",
        )

        self.assertEqual(resp.status_code, 400, resp.data)
        self.assertIn("sin cobrar", str(resp.data))

    def test_api_renew_succeeds_with_the_override(self):
        self.client.force_authenticate(
            user=self.create_user(self.gym, username="staff", role="staff")
        )

        resp = self.client.post(
            f"/api/outings/enrollments/{self.enrollment.id}/renew/",
            {"additional_sessions": 5, "allow_unpaid": True},
            format="json",
        )

        self.assertEqual(resp.status_code, 200, resp.data)
        self.enrollment.refresh_from_db()
        self.assertEqual(self.enrollment.package_total_sessions, 15)
