from datetime import date, time as _time
from decimal import Decimal

from django.utils import timezone

from activities.models import Activity, ActivitySchedule, Enrollment
from core.testing import BaseAPITest

from payments.models import Payment
from plans.models import Service
from subscriptions.services import (
    get_last_day_of_month,
    member_credit_balance,
    subscription_remaining_balance,
)


class PaymentDebtTests(BaseAPITest):

    def setUp(self):
        self.gym = self.create_gym()
        self.user = self.create_user(self.gym)
        self.plan = self.create_plan(self.gym)
        self.member = self.create_member(self.gym)

        # Período de mes completo y con fecha explícita: al abrir con la fecha
        # de hoy (después del día de vencimiento, default 10) el alta de un
        # socio nuevo se prorratea, y estos tests afirman el precio de lista.
        today = timezone.localdate()
        month_start = today.replace(day=1)
        self.sub = self.open_month_subscription(
            self.member,
            self.plan,
            start_date=month_start,
            end_date=get_last_day_of_month(month_start),
        )

        self.client.force_authenticate(user=self.user)

    def test_registered_payment_reduces_remaining(self):
        resp = self.client.post(
            "/api/payments/",
            {
                "subscription": self.sub.id,
                "amount": "2000.00",
                "payment_method": "cash",
            },
            format="json",
        )

        self.assertEqual(resp.status_code, 201)
        self.sub.refresh_from_db()

        balance = subscription_remaining_balance(self.sub)
        self.assertEqual(balance["remaining"], self.plan.price - 2000)

    def test_full_payment_marks_subscription_paid(self):
        self.client.post(
            "/api/payments/",
            {
                "subscription": self.sub.id,
                "amount": str(self.plan.price),
                "payment_method": "cash",
            },
            format="json",
        )
        self.sub.refresh_from_db()
        self.assertTrue(self.sub.paid)

    def test_overpayment_rejected(self):
        resp = self.client.post(
            "/api/payments/",
            {
                "subscription": self.sub.id,
                "amount": str(self.plan.price + 1),
                "payment_method": "cash",
            },
            format="json",
        )

        self.assertEqual(resp.status_code, 400)
        self.assertIn("no puede superar", resp.data["amount"][0])
        self.assertEqual(Payment.objects.filter(subscription=self.sub).count(), 0)

    def test_deleting_payment_restores_debt_and_flag(self):
        pay = self.client.post(
            "/api/payments/",
            {
                "subscription": self.sub.id,
                "amount": str(self.plan.price),
                "payment_method": "cash",
            },
            format="json",
        ).data

        self.sub.refresh_from_db()
        self.assertTrue(self.sub.paid)

        resp = self.client.delete(
            f"/api/payments/{pay['id']}/",
            HTTP_ACCEPT="application/json",
        )

        self.assertEqual(resp.status_code, 204)
        self.sub.refresh_from_db()
        self.assertFalse(self.sub.paid)
        balance = subscription_remaining_balance(self.sub)
        self.assertEqual(balance["remaining"], self.plan.price)


class PaymentConceptIntegrityTests(BaseAPITest):
    """P19/P20 — ``concept`` y ``applied_to`` no deben escribirse por la API.

    Un ``Payment`` con ``concept="credit"`` es un artefacto contable
    interno: lo acuña ``ensure_overpayment_credit`` y lo parte
    ``consume_member_credit``. Permitir que el cliente lo escriba, o que
    re-tipe un crédito, invierte el signo del que dependen
    ``member_credit_balance``, ``credit_recorded_for`` y ``credit_realized_for``.
    """

    PLAN_PRICE = Decimal("50000.00")

    def setUp(self):
        self.gym = self.create_gym()
        self.user = self.create_user(self.gym)
        self.client.force_authenticate(user=self.user)

        self.plan = self.create_plan(self.gym, price=self.PLAN_PRICE)
        self.member = self.create_member(self.gym)

        today = timezone.localdate()
        month_start = today.replace(day=1)
        self.sub = self.open_month_subscription(
            self.member,
            self.plan,
            start_date=month_start,
            end_date=get_last_day_of_month(month_start),
        )

    def _open_credit(self, member, subscription, amount):
        return Payment.objects.create(
            gym=self.gym,
            member=member,
            subscription=subscription,
            concept="credit",
            amount=amount,
            member_name=str(member),
            plan_name="Saldo a favor",
        )

    def _activity_enrollment(self, member):
        activity = Activity.objects.create(
            service=Service.get_default_for_gym(self.gym),
            name="Kinesio",
            billing_mode="sessions",
        )
        schedule = ActivitySchedule.objects.create(
            activity=activity,
            day="monday",
            start_time=_time(9, 0),
            end_time=_time(10, 0),
            capacity=10,
        )
        return Enrollment.objects.create(
            gym=self.gym,
            member=member,
            schedule=schedule,
            modality="package",
            package_total_sessions=10,
            session_price=Decimal("2500.00"),
            amount_paid=Decimal("6000.00"),
        )

    # 1. Escritura directa de un crédito por la API.
    def test_posted_credit_is_rejected(self):
        resp = self.client.post(
            "/api/payments/",
            {
                "subscription": self.sub.id,
                "concept": "credit",
                "amount": str(self.PLAN_PRICE),
            },
            format="json",
        )

        self.assertEqual(resp.status_code, 400)
        self.assertFalse(
            Payment.objects.filter(concept="credit", subscription=self.sub).exists()
        )

    # 2. La amplificadora: con un sobrepago real en la mano, el POST falsificado
    #    ya no crea un crédito. Hoy corrompe el saldo a favor del socio.
    def test_forged_credit_does_not_corrupt_the_member_balance(self):
        self._open_credit(self.member, self.sub, Decimal("-30000.00"))
        self.assertEqual(member_credit_balance(self.member), Decimal("30000.00"))

        resp = self.client.post(
            "/api/payments/",
            {
                "subscription": self.sub.id,
                "concept": "credit",
                "amount": str(self.PLAN_PRICE),
            },
            format="json",
        )

        self.assertEqual(resp.status_code, 400)
        self.assertEqual(member_credit_balance(self.member), Decimal("30000.00"))
        self.assertEqual(
            Payment.objects.filter(
                member=self.member, concept="credit"
            ).count(),
            1,
        )

    # 3. ``applied_to`` falsificado: apuntar un crédito abierto a otro período no
    #    debe borrarle la deuda a ese período ni consumir el saldo del socio.
    def test_forged_applied_to_does_not_move_credit(self):
        other_member = self.create_member(self.gym, first_name="Beto")
        today = timezone.localdate()
        month_start = today.replace(day=1)
        other_sub = self.open_month_subscription(
            other_member,
            self.plan,
            start_date=month_start,
            end_date=get_last_day_of_month(month_start),
        )

        credit = self._open_credit(self.member, self.sub, Decimal("-30000.00"))

        resp = self.client.patch(
            f"/api/payments/{credit.id}/",
            {"applied_to": other_sub.id},
            format="json",
        )

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(member_credit_balance(self.member), Decimal("30000.00"))
        self.assertEqual(
            subscription_remaining_balance(other_sub)["remaining"],
            self.PLAN_PRICE,
        )

    # 4. Re-tipado: un crédito no puede convertirse en pago de suscripción.
    def test_credit_cannot_be_retyped_as_subscription(self):
        credit = self._open_credit(self.member, self.sub, Decimal("-30000.00"))

        resp = self.client.patch(
            f"/api/payments/{credit.id}/",
            {"concept": "subscription"},
            format="json",
        )

        self.assertEqual(resp.status_code, 400)
        credit.refresh_from_db()
        self.assertEqual(credit.concept, "credit")

    # 5. Monto negativo sobre un paquete sin rama de validación: borra la deuda.
    def test_negative_amount_on_enrollment_is_rejected(self):
        enrollment = self._activity_enrollment(self.member)

        resp = self.client.post(
            "/api/payments/",
            {
                "enrollment": enrollment.id,
                "concept": "credit",
                "amount": "-999999.00",
            },
            format="json",
        )

        self.assertEqual(resp.status_code, 400)
        enrollment.refresh_from_db()
        self.assertEqual(enrollment.amount_paid, Decimal("6000.00"))
