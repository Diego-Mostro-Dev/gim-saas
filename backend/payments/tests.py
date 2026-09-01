from core.testing import BaseAPITest

from payments.models import Payment
from subscriptions.services import subscription_remaining_balance


class PaymentDebtTests(BaseAPITest):

    def setUp(self):
        self.gym = self.create_gym()
        self.user = self.create_user(self.gym)
        self.plan = self.create_plan(self.gym)
        self.member = self.create_member(self.gym)
        self.sub = self.open_month_subscription(self.member, self.plan)

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

        resp = self.client.delete(f"/api/payments/{pay['id']}/")

        self.assertEqual(resp.status_code, 204)
        self.sub.refresh_from_db()
        self.assertFalse(self.sub.paid)
        balance = subscription_remaining_balance(self.sub)
        self.assertEqual(balance["remaining"], self.plan.price)