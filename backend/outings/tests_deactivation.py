"""Fase D — cobro de add-ons y ciclo de baja (salidas).

Espeja los tests de actividades: desactivar una salida corta ya el cobro de sus
inscriptos y el portal no muestra inscripciones huérfanas.
"""

from datetime import date, time
from decimal import Decimal

from core.testing import BaseAPITest
from outings.enrollment_service import OutingEnrollmentService
from outings.models import Outing, OutingEnrollment, OutingSchedule
from plans.models import Service
from subscriptions.models import SubscriptionItem


class OutingDeactivationBillingTests(BaseAPITest):
    """ADD-09: desactivar la salida corta el cobro recurrente."""

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.gym.features = {**self.gym.features, "salidas": True}
        self.gym.save(update_fields=["features"])
        self.user = self.create_user(self.gym)
        self.client.force_authenticate(user=self.user)

        self.plan = self.create_plan(self.gym, price=Decimal("5000.00"))
        self.member = self.create_member(self.gym)
        self.subscription = self.open_month_subscription(
            self.member,
            self.plan,
            start_date=date(2000, 1, 1),
            end_date=date(2100, 12, 31),
        )
        self.settle_subscription(self.subscription)

        self.outing = Outing.objects.create(
            gym=self.gym,
            service=Service.get_default_for_gym(self.gym),
            name="Trail",
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
        self.enrollment = OutingEnrollmentService.enroll_member(
            self.member, self.schedule
        )

    def test_deactivating_cancels_item_enrollment_and_billing(self):
        resp = self.client.delete(
            f"/api/outings/outings/{self.outing.id}/",
            HTTP_ACCEPT="application/json",
        )
        self.assertEqual(resp.status_code, 204, resp.data)

        self.outing.refresh_from_db()
        self.enrollment.refresh_from_db()
        self.assertFalse(self.outing.active)
        self.assertFalse(self.enrollment.active)
        self.assertFalse(
            SubscriptionItem.objects.filter(
                subscription=self.subscription,
                outing=self.outing,
                status="active",
            ).exists()
        )


class OutingPortalOrphanTests(BaseAPITest):
    """ADD-10: el portal no lista inscripciones a horarios desactivados."""

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.gym.features = {**self.gym.features, "salidas": True}
        self.gym.save(update_fields=["features"])
        self.member = self.create_member(self.gym)

        self.outing = Outing.objects.create(
            gym=self.gym,
            service=Service.get_default_for_gym(self.gym),
            name="Trail",
            billing_mode="monthly",
            monthly_price=Decimal("4000.00"),
        )
        self.keep = OutingSchedule.objects.create(
            outing=self.outing,
            day="monday",
            start_time=time(9, 0),
            end_time=time(10, 0),
            capacity=10,
        )
        self.orphan = OutingSchedule.objects.create(
            outing=self.outing,
            day="tuesday",
            start_time=time(9, 0),
            end_time=time(10, 0),
            capacity=10,
        )
        OutingEnrollmentService.enroll_member(
            self.member, self.orphan, skip_eligibility_check=True
        )
        self.url = f"/api/outings/public/{self.member.access_token}/"

    def test_active_enrollment_is_listed(self):
        resp = self.client.get(self.url, HTTP_ACCEPT="application/json")

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["outings"]), 1)

    def test_enrollment_on_inactive_schedule_is_hidden(self):
        OutingSchedule.objects.filter(pk=self.orphan.pk).update(active=False)

        resp = self.client.get(self.url, HTTP_ACCEPT="application/json")

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["outings"], [])
