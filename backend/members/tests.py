import json
from datetime import date

from rest_framework.authtoken.models import Token

from core.testing import BaseAPITest

from gyms.models import Discount
from members.models import Member
from members.serializers import MemberSerializer
from subscriptions.models import Subscription
from subscriptions.services import get_first_day_of_next_month, get_last_day_of_month


class MemberCreateTests(BaseAPITest):

    def setUp(self):
        self.gym = self.create_gym()
        self.user = self.create_user(self.gym)
        self.slot = self.create_today_slot(self.gym)

    def test_staff_creates_member_with_plan_and_schedule(self):
        plan = self.create_plan(self.gym)
        self.client.force_authenticate(user=self.user)

        resp = self.client.post(
            "/api/members/",
            {
                "first_name": "Ana",
                "last_name": "Gomez",
                "phone": "112233",
                "services": json.dumps(["gym"]),
                "schedules": json.dumps(
                    [{"day": self.slot.day, "hour": "10:00"}]
                ),
                "plan_id": plan.id,
            },
            format="multipart",
        )

        self.assertEqual(resp.status_code, 201)

        member = Member.objects.get(phone="112233")
        self.assertTrue(member.active)
        self.assertTrue(member.access_token)

        sub = Subscription.objects.get(member=member)
        self.assertEqual(sub.plan, plan)
        self.assertIsNotNone(sub.items.filter(item_type="plan").first())

    def test_staff_creates_member_without_schedules_rejected(self):
        self.client.force_authenticate(user=self.user)

        resp = self.client.post(
            "/api/members/",
            {
                "first_name": "Bob",
                "last_name": "Loblaw",
                "phone": "223344",
                "services": json.dumps(["gym"]),
            },
            format="multipart",
        )

        self.assertEqual(resp.status_code, 400)

    def test_member_list_excludes_access_token(self):
        self.create_member(self.gym)
        self.client.force_authenticate(user=self.user)

        resp = self.client.get("/api/members/")

        self.assertEqual(resp.status_code, 200)
        self.assertNotIn("access_token", resp.data[0])


class IsRecoverableTests(BaseAPITest):

    def test_limbo_member_is_recoverable(self):
        """active=True, expired sub, no debt -> recoverable (the fix)."""
        gym = self.create_gym()
        member = self.create_member(gym)
        plan = self.create_plan(gym)

        prev_start, prev_end = self.last_month_period()
        sub = self.open_month_subscription(
            member, plan,
            start_date=prev_start,
            end_date=prev_end,
            origin="onboarding",
        )
        self.settle_subscription(sub)

        self.assertTrue(member.active)

        serializer = MemberSerializer(member, context={"gym": gym})
        self.assertTrue(serializer.data["is_recoverable"])

    def test_healthy_member_is_not_recoverable(self):
        gym = self.create_gym()
        member = self.create_member(gym)
        plan = self.create_plan(gym)
        sub = self.open_month_subscription(member, plan)
        self.settle_subscription(sub)

        serializer = MemberSerializer(member, context={"gym": gym})
        self.assertFalse(serializer.data["is_recoverable"])

    def test_limbo_member_with_debt_is_not_recoverable(self):
        gym = self.create_gym()
        member = self.create_member(gym)
        plan = self.create_plan(gym)

        prev_start, prev_end = self.last_month_period()
        self.open_month_subscription(
            member, plan,
            start_date=prev_start,
            end_date=prev_end,
            origin="onboarding",
        )

        serializer = MemberSerializer(member, context={"gym": gym})
        self.assertFalse(serializer.data["is_recoverable"])

    def test_inactive_member_without_subscription_not_recoverable(self):
        gym = self.create_gym()
        member = self.create_member(gym)
        member.active = False
        member.save(update_fields=["active"])

        serializer = MemberSerializer(member, context={"gym": gym})
        self.assertFalse(serializer.data["is_recoverable"])


class RecoveryEndpointTests(BaseAPITest):

    def test_recover_limbo_member_creates_recovery_subscription(self):
        gym = self.create_gym()
        user = self.create_user(gym)
        member = self.create_member(gym)
        plan = self.create_plan(gym)

        prev_start, prev_end = self.last_month_period()
        expired = self.open_month_subscription(
            member, plan,
            start_date=prev_start,
            end_date=prev_end,
            origin="onboarding",
        )
        self.settle_subscription(expired)

        self.client.force_authenticate(user=user)
        resp = self.client.post(
            "/api/subscriptions/reopen/",
            {"member_id": member.id},
            format="json",
        )

        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["origin"], "recovery")
        member.refresh_from_db()
        self.assertTrue(member.active)

        new_sub = Subscription.objects.filter(
            member=member, origin="recovery",
        ).first()
        self.assertIsNotNone(new_sub)
        self.assertEqual(new_sub.plan, plan)

    def test_recover_member_with_debt_rejected(self):
        gym = self.create_gym()
        user = self.create_user(gym)
        member = self.create_member(gym)
        plan = self.create_plan(gym)

        prev_start, prev_end = self.last_month_period()
        self.open_month_subscription(
            member, plan,
            start_date=prev_start,
            end_date=prev_end,
            origin="onboarding",
        )

        self.client.force_authenticate(user=user)
        resp = self.client.post(
            "/api/subscriptions/reopen/",
            {"member_id": member.id},
            format="json",
        )

        self.assertEqual(resp.status_code, 400)
        self.assertIn("deuda pendiente", resp.data["detail"])

    def test_recover_member_with_future_subscription_rejected(self):
        gym = self.create_gym()
        user = self.create_user(gym)
        member = self.create_member(gym)
        plan = self.create_plan(gym)

        prev_start, prev_end = self.last_month_period()
        expired = self.open_month_subscription(
            member, plan,
            start_date=prev_start,
            end_date=prev_end,
            origin="onboarding",
        )
        self.settle_subscription(expired)

        # A genuinely-future subscription: next calendar month after today.
        this_month = date.today().replace(day=1)
        future_start = get_first_day_of_next_month(this_month)
        future_end = get_last_day_of_month(future_start)
        future = self.open_month_subscription(
            member, plan,
            start_date=future_start,
            end_date=future_end,
            origin="onboarding",
        )
        self.settle_subscription(future)

        self.client.force_authenticate(user=user)
        resp = self.client.post(
            "/api/subscriptions/reopen/",
            {"member_id": member.id},
            format="json",
        )

        self.assertEqual(resp.status_code, 400)
        self.assertIn("futura", resp.data["detail"])


class PublicRegisterSecurityTests(BaseAPITest):
    """P0-1: el registro público no puede auto-otorgarse beneficios.

    is_comp y descuentos son privilegios que solo el staff puede asignar
    después del alta; el onboarding anónimo debe ignorarlos/forzarlos.
    """

    def _register_payload(self, gym, plan_id=None, **overrides):
        payload = {
            "first_name": "Luz",
            "last_name": "Pérez",
            "phone": f"11-{self._testMethodName}",
            "services": ["gym"],
            "schedules": [{"day": self.weekday_name(), "hour": "10:00"}],
        }
        if plan_id is not None:
            payload["plan_id"] = plan_id
        payload.update(overrides)
        return payload

    def test_anonymous_cannot_grant_comp_without_plan(self):
        gym = self.create_gym()
        self.create_today_slot(gym)

        resp = self.client.post(
            f"/api/public/register/{gym.onboarding_code}/",
            self._register_payload(gym, is_comp=True),
            format="json",
        )

        self.assertEqual(resp.status_code, 400)
        self.assertIn("plan", resp.data["plan_id"])

    def test_anonymous_is_comp_forced_false_with_plan(self):
        gym = self.create_gym()
        self.create_today_slot(gym)
        plan = self.create_plan(gym)

        resp = self.client.post(
            f"/api/public/register/{gym.onboarding_code}/",
            self._register_payload(gym, plan_id=plan.id, is_comp=True),
            format="json",
        )

        self.assertEqual(resp.status_code, 201)
        self.assertFalse(resp.data["is_comp"])
        member = Member.objects.get(phone=f"11-{self._testMethodName}")
        self.assertFalse(member.is_comp)
        self.assertTrue(member.active)
        self.assertEqual(Subscription.objects.get(member=member).plan, plan)

    def test_anonymous_discount_ignored(self):
        gym = self.create_gym()
        self.create_today_slot(gym)
        plan = self.create_plan(gym)
        discount = Discount.objects.create(
            gym=gym,
            name="Amigo",
            discount_percent=50,
        )
        other_gym = self.create_gym(name="Otro Gym")
        foreign_discount = Discount.objects.create(
            gym=other_gym,
            name="Ajeno",
            discount_percent=10,
        )

        for discount_id in [discount.id, foreign_discount.id]:
            resp = self.client.post(
                f"/api/public/register/{gym.onboarding_code}/",
                self._register_payload(
                    gym, plan_id=plan.id, discount_id=discount_id,
                ),
                format="json",
            )
            self.assertEqual(resp.status_code, 201)
            member = Member.objects.get(phone=f"11-{self._testMethodName}-{discount_id}")
            self.assertIsNone(member.discount)