"""Fase K2 — add-ons: solapes, renovaciones y bajas.

Cubre ``ADD-28`` (lado salidas): el ítem de suscripción es **por oferta**,
no por horario. Darse de baja de un horario cancelaba el único ítem de la
oferta, así que el socio seguía inscripto en el otro horario de la misma
salida pero dejaba de pagarla. PT ya tenía el guard ``other_active``;
actividades y salidas no.

Corre contra Postgres real, nunca SQLite ni la base de desarrollo.
"""

from datetime import time
from decimal import Decimal

from core.testing import BaseAPITest
from outings.enrollment_service import OutingEnrollmentService
from outings.models import Outing, OutingSchedule
from plans.models import Service
from subscriptions.models import SubscriptionItem


class Add28OutingItemTests(BaseAPITest):
    """ADD-28 (salidas): el ítem se cancela sólo con la última baja."""

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.gym.features = {**self.gym.features, "outings": True}
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
