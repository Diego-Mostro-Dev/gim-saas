"""Fase D — cobro de add-ons y ciclo de baja (actividades).

Cubre el criterio acordado: desactivar una actividad **corta ya** el cobro de
sus inscriptos (da de baja la inscripción y cancela el ítem del período en
curso y de los períodos futuros ya generados), el portal no muestra
inscripciones huérfanas, y ampliar un paquete no vuelve a cobrar el sellado.
"""

from datetime import date, time
from decimal import Decimal

from django.utils import timezone

from activities.enrollment_service import EnrollmentService
from activities.models import Activity, ActivitySchedule, Enrollment
from activities.session_service import SessionService
from core.testing import BaseAPITest
from plans.models import Service
from subscriptions.models import SubscriptionItem
from subscriptions.services import (
    member_credit_balance,
    subscription_remaining_balance,
)


class ActivityDeactivationBillingTests(BaseAPITest):
    """ADD-01: desactivar la actividad corta el cobro recurrente."""

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.gym.features = {**self.gym.features, "activities": True}
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

        self.activity = Activity.objects.create(
            service=Service.get_default_for_gym(self.gym),
            name="Yoga",
            billing_mode="monthly",
            monthly_price=Decimal("5000.00"),
        )
        self.schedule = ActivitySchedule.objects.create(
            activity=self.activity,
            day="monday",
            start_time=time(9, 0),
            end_time=time(10, 0),
            capacity=10,
        )
        self.enrollment = EnrollmentService.enroll_member(
            self.member, self.schedule
        )

    def _remaining(self):
        return subscription_remaining_balance(self.subscription)["remaining"]

    def _deactivate(self):
        return self.client.delete(
            f"/api/activities/activities/{self.activity.id}/",
            HTTP_ACCEPT="application/json",
        )

    def test_baseline_activity_is_billed(self):
        self.assertEqual(self._remaining(), Decimal("5000.00"))

    def test_deactivating_cancels_item_enrollment_and_billing(self):
        resp = self._deactivate()
        self.assertEqual(resp.status_code, 204, resp.data)

        self.activity.refresh_from_db()
        self.enrollment.refresh_from_db()
        self.assertFalse(self.activity.active)
        self.assertFalse(self.enrollment.active)
        self.assertFalse(
            SubscriptionItem.objects.filter(
                subscription=self.subscription,
                activity=self.activity,
                status="active",
            ).exists()
        )
        self.assertEqual(self._remaining(), Decimal("0.00"))

    def test_deactivating_after_full_payment_creates_credit(self):
        self.settle_subscription(self.subscription)
        self.assertEqual(self._remaining(), Decimal("0.00"))

        self._deactivate()

        self.assertEqual(
            member_credit_balance(self.member), Decimal("5000.00")
        )


class ActivityPortalOrphanTests(BaseAPITest):
    """ADD-02: el portal no lista inscripciones a horarios desactivados."""

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
        self.keep = ActivitySchedule.objects.create(
            activity=self.activity,
            day="monday",
            start_time=time(9, 0),
            end_time=time(10, 0),
            capacity=10,
        )
        self.orphan = ActivitySchedule.objects.create(
            activity=self.activity,
            day="tuesday",
            start_time=time(9, 0),
            end_time=time(10, 0),
            capacity=10,
        )
        EnrollmentService.enroll_member(
            self.member, self.orphan, skip_eligibility_check=True
        )
        self.url = f"/api/activities/public/{self.member.access_token}/"

    def test_active_enrollment_is_listed(self):
        resp = self.client.get(self.url, HTTP_ACCEPT="application/json")

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)

    def test_enrollment_on_inactive_schedule_is_hidden(self):
        ActivitySchedule.objects.filter(pk=self.orphan.pk).update(active=False)

        resp = self.client.get(self.url, HTTP_ACCEPT="application/json")

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data, [])


class ActivitySelladoRenewalTests(BaseAPITest):
    """DIN-18: ampliar un paquete no vuelve a poner el sellado pendiente."""

    def setUp(self):
        super().setUp()
        self.gym = self.create_gym()
        self.member = self.create_member(self.gym)
        activity = Activity.objects.create(
            service=Service.get_default_for_gym(self.gym),
            name="Kinesio",
            billing_mode="sessions",
        )
        schedule = ActivitySchedule.objects.create(
            activity=activity,
            day="monday",
            start_time=time(9, 0),
            end_time=time(10, 0),
            capacity=10,
        )
        self.enrollment = Enrollment.objects.create(
            gym=self.gym,
            member=self.member,
            schedule=schedule,
            modality="package",
            package_total_sessions=10,
            session_price=Decimal("2500.00"),
            amount_paid=Decimal("25000.00"),
            sellado_amount=Decimal("1000.00"),
            sellado_paid=True,
        )

    def test_renewing_package_keeps_sellado_paid(self):
        SessionService.renew_package(self.enrollment, 5)

        self.enrollment.refresh_from_db()
        self.assertTrue(self.enrollment.sellado_paid)
        self.assertEqual(self.enrollment.package_total_sessions, 15)
