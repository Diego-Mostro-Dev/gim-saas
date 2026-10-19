"""Fase D — cobro de add-ons y ciclo de baja (entrenamiento personal).

Desactivar una oferta de PT corta ya el cobro de sus asignaciones; ampliar un
paquete no vuelve a cobrar el sellado.
"""

from datetime import date, time
from decimal import Decimal

from core.testing import BaseAPITest
from plans.models import Service
from profiles.models import UserProfile
from subscriptions.models import SubscriptionItem

from .assignment_service import AssignmentService
from .models import PersonalTrainingAssignment, PersonalTrainingService
from .session_service import SessionService


class PTServiceDeactivationBillingTests(BaseAPITest):
    """La baja de una oferta de PT corta el cobro de sus asignaciones."""

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.gym.features = {
            **self.gym.features,
            "personal_training": True,
        }
        self.gym.save(update_fields=["features"])
        self.user = self.create_user(self.gym)
        self.client.force_authenticate(user=self.user)

        self.plan = self.create_plan(self.gym, price=Decimal("5000.00"))
        self.member = self.create_member(self.gym)
        self.member.address = "Calle Falsa 123"
        self.member.save(update_fields=["address"])
        self.subscription = self.open_month_subscription(
            self.member,
            self.plan,
            start_date=date(2000, 1, 1),
            end_date=date(2100, 12, 31),
        )
        self.settle_subscription(self.subscription)

        self.trainer = self.create_user(
            self.gym, username="trainer1", role=UserProfile.ROLE_TRAINER
        )
        self.pt_service = PersonalTrainingService.objects.create(
            gym=self.gym,
            service=Service.get_default_for_gym(self.gym),
            name="PT 1:1",
            monthly_price=Decimal("3000.00"),
        )
        self.assignment = AssignmentService.assign_member(
            self.member,
            self.pt_service,
            self.trainer,
            day="monday",
            start_time=time(9, 0),
            end_time=time(10, 0),
        )

    def test_deactivating_cancels_item_assignment_and_billing(self):
        resp = self.client.delete(
            f"/api/personal-training/services/{self.pt_service.id}/",
            HTTP_ACCEPT="application/json",
        )
        self.assertEqual(resp.status_code, 204, resp.data)

        self.pt_service.refresh_from_db()
        self.assignment.refresh_from_db()
        self.assertFalse(self.pt_service.active)
        self.assertFalse(self.assignment.active)
        self.assertFalse(
            SubscriptionItem.objects.filter(
                subscription=self.subscription,
                personal_training=self.pt_service,
                status="active",
            ).exists()
        )


class PTSelladoRenewalTests(BaseAPITest):
    """DIN-18: ampliar un paquete de PT no vuelve a cobrar el sellado."""

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.member = self.create_member(self.gym)
        self.trainer = self.create_user(
            self.gym, username="trainer1", role=UserProfile.ROLE_TRAINER
        )
        self.pt_service = PersonalTrainingService.objects.create(
            gym=self.gym,
            service=Service.get_default_for_gym(self.gym),
            name="PT 1:1",
            billing_mode="sessions",
        )
        self.assignment = PersonalTrainingAssignment.objects.create(
            gym=self.gym,
            member=self.member,
            trainer=self.trainer,
            service=self.pt_service,
            day="monday",
            start_time=time(9, 0),
            end_time=time(10, 0),
            modality="package",
            package_total_sessions=10,
            session_price=Decimal("3000.00"),
            amount_paid=Decimal("30000.00"),
            sellado_amount=Decimal("1000.00"),
            sellado_paid=True,
        )

    def test_renewing_package_keeps_sellado_paid(self):
        SessionService.renew_package(self.assignment, 5)

        self.assignment.refresh_from_db()
        self.assertTrue(self.assignment.sellado_paid)
        self.assertEqual(self.assignment.package_total_sessions, 15)
