"""Fase K2 — add-ons: solapes, renovaciones y bajas.

Cubre ``ADD-28``: el ítem de suscripción es **por oferta**, no por horario.
Darse de baja de un horario cancelaba el único ítem de la oferta, así que
el socio seguía inscripto en el otro horario de la misma actividad pero
dejaba de pagarla. PT ya tenía el guard ``other_active``; actividades y
salidas no.

Corre contra Postgres real, nunca SQLite ni la base de desarrollo.
"""

from datetime import time
from decimal import Decimal

from activities.enrollment_service import EnrollmentService
from activities.models import Activity, ActivitySchedule, Enrollment
from core.testing import BaseAPITest
from plans.models import Service
from subscriptions.models import SubscriptionItem


class Add28ActivityItemTests(BaseAPITest):
    """ADD-28 (actividades): el ítem se cancela sólo con la última baja."""

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.gym.features = {**self.gym.features, "activities": True}
        self.gym.save(update_fields=["features"])
        self.member = self.create_member(self.gym)
        self.activity = Activity.objects.create(
            service=Service.get_default_for_gym(self.gym),
            name="Yoga",
            billing_mode="monthly",
            monthly_price=Decimal("5000.00"),
        )
        self.monday = ActivitySchedule.objects.create(
            activity=self.activity,
            day="monday",
            start_time=time(9, 0),
            end_time=time(10, 0),
            capacity=10,
        )
        self.wednesday = ActivitySchedule.objects.create(
            activity=self.activity,
            day="wednesday",
            start_time=time(9, 0),
            end_time=time(10, 0),
            capacity=10,
        )
        self.plan = self.create_plan(self.gym, price=Decimal("10000.00"))
        self.subscription = self.open_month_subscription(self.member, self.plan)
        self.settle_subscription(self.subscription)

    def _enroll(self, schedule):
        return EnrollmentService.enroll_member(
            self.member, schedule, skip_eligibility_check=True
        )

    def _item(self):
        return SubscriptionItem.objects.get(
            subscription=self.subscription, activity=self.activity
        )

    def test_item_is_created_once_for_two_schedules_of_the_same_activity(self):
        self._enroll(self.monday)
        self._enroll(self.wednesday)

        self.assertEqual(
            SubscriptionItem.objects.filter(
                subscription=self.subscription, activity=self.activity
            ).count(),
            1,
        )

    def test_unenroll_keeps_the_item_while_another_schedule_is_active(self):
        """El socio sigue inscripto el miércoles: el ítem no se cancela."""
        self._enroll(self.monday)
        self._enroll(self.wednesday)
        item = self._item()
        self.assertEqual(item.status, "active")

        EnrollmentService.unenroll_member(self.member, self.monday)

        item.refresh_from_db()
        self.assertEqual(
            item.status,
            "active",
            "El socio sigue inscripto en el horario del miércoles: "
            "cancelar el ítem lo dejaba de cobrar sin dejar de usar la oferta.",
        )

    def test_unenroll_of_the_last_schedule_cancels_the_item(self):
        self._enroll(self.monday)
        self._enroll(self.wednesday)

        EnrollmentService.unenroll_member(self.member, self.monday)
        EnrollmentService.unenroll_member(self.member, self.wednesday)

        item = self._item()
        self.assertEqual(item.status, "cancelled")

    def test_unenroll_of_a_single_schedule_cancels_the_item(self):
        self._enroll(self.monday)

        EnrollmentService.unenroll_member(self.member, self.monday)

        item = self._item()
        self.assertEqual(item.status, "cancelled")

    def test_other_activity_does_not_keep_the_item_alive(self):
        """El guard es por oferta: otra actividad no lo mantiene vivo."""
        other = Activity.objects.create(
            service=Service.get_default_for_gym(self.gym),
            name="Pilates",
            billing_mode="monthly",
            monthly_price=Decimal("5000.00"),
        )
        other_schedule = ActivitySchedule.objects.create(
            activity=other,
            day="tuesday",
            start_time=time(9, 0),
            end_time=time(10, 0),
            capacity=10,
        )
        self._enroll(self.monday)
        self._enroll(other_schedule)

        EnrollmentService.unenroll_member(self.member, self.monday)

        item = self._item()
        self.assertEqual(item.status, "cancelled")

    def test_inactive_enrollment_does_not_keep_the_item_alive(self):
        """Una inscripción dada de baja antes no cuenta como activa."""
        enrollment = self._enroll(self.wednesday)
        enrollment.active = False
        enrollment.save(update_fields=["active"])

        self._enroll(self.monday)
        EnrollmentService.unenroll_member(self.member, self.monday)

        item = self._item()
        self.assertEqual(item.status, "cancelled")

    def test_package_enrollment_of_the_same_activity_keeps_the_item_alive(self):
        """Un paquete de la misma oferta mantiene la cuota viva."""
        package_schedule = ActivitySchedule.objects.create(
            activity=self.activity,
            day="friday",
            start_time=time(9, 0),
            end_time=time(10, 0),
            capacity=10,
        )
        self._enroll(self.monday)
        Enrollment.objects.create(
            gym=self.gym,
            member=self.member,
            schedule=package_schedule,
            modality="package",
            package_total_sessions=5,
            session_price=Decimal("2500.00"),
        )

        EnrollmentService.unenroll_member(self.member, self.monday)

        item = self._item()
        self.assertEqual(item.status, "active")
