from datetime import date

from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from rest_framework import status

from gyms.models import Gym
from subscriptions.models import MembershipPlan, Subscription
from subscriptions.services import get_last_day_of_month

from .models import Member


class MemberCreateWithPlanTest(TestCase):
    """Subscription is auto-created when plan_id is provided at member creation."""

    def setUp(self):
        self.gym = Gym.objects.create(
            name="Test Gym",
            slug="test-gym",
            phone="123456789",
            email="gym@test.com",
        )
        self.plan = MembershipPlan.objects.create(
            gym=self.gym,
            name="Basico",
            price=10000,
            duration_days=30,
            weekly_visits=3,
        )
        staff_user = User.objects.create_user(
            username="staff_member_create",
            password="testpass123",
        )
        staff_user.profile.gym = self.gym
        staff_user.profile.save(update_fields=["gym"])
        self.client = APIClient()
        self.client.force_authenticate(user=staff_user)

    def _create_member(self, plan_id=None, expect_errors=False):
        data = {
            "first_name": "Ernestina",
            "last_name": "Rodriguez",
            "phone": "123456789",
            "email": "ernestina@test.com",
        }
        if plan_id is not None:
            data["plan_id"] = plan_id

        return self.client.post(
            "/api/members/",
            data,
            format="json",
        )

    def test_creates_subscription_when_plan_selected(self):
        response = self._create_member(plan_id=self.plan.id)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        member = Member.objects.get(phone="123456789")
        subs = Subscription.objects.filter(member=member)
        self.assertEqual(subs.count(), 1)

        sub = subs.first()
        self.assertEqual(sub.plan, self.plan)
        self.assertFalse(sub.paid)
        self.assertTrue(sub.auto_renew)
        self.assertEqual(sub.start_date, date.today())
        self.assertEqual(sub.end_date, get_last_day_of_month(date.today()))

    def test_no_subscription_without_plan(self):
        response = self._create_member(plan_id=None)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        member = Member.objects.get(phone="123456789")
        self.assertEqual(Subscription.objects.filter(member=member).count(), 0)

    def test_subscription_is_initial_pending(self):
        response = self._create_member(plan_id=self.plan.id)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        member = Member.objects.get(phone="123456789")
        sub = Subscription.objects.get(member=member)

        from subscriptions.services import get_subscription_payment_status
        status_label = get_subscription_payment_status(sub)
        self.assertEqual(status_label, "initial_pending")

    def test_invalid_plan_rejected_atomically(self):
        response = self._create_member(plan_id=99999)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Member.objects.filter(phone="123456789").exists())
