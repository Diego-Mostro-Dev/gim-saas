"""Shared helpers for the critical-flow test suites.

All critical tests (auth, member onboarding, payment->debt, check-in and
recovery) build on the same small fixture graph: a Gym with a staff user and
a MembershipPlan, plus helpers that open subscriptions and settle them.
"""

from datetime import date, time as _time
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.cache import cache
from django.utils import timezone

from rest_framework.test import APITestCase

from attendance.models import AttendanceSchedule, ScheduleSlot
from gyms.models import Gym
from members.models import Member
from payments.models import Payment
from plans.models import MembershipPlan, Service
from subscriptions.domain import SubscriptionDomain
from subscriptions.services import get_last_day_of_month


WEEKDAY_NAMES = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


class BaseAPITest(APITestCase):

    def setUp(self):
        super().setUp()
        # AnonRateThrottle scopes share the default cache across test methods;
        # clear it so login/onboarding counters never bleed between tests.
        cache.clear()

    def create_gym(self, name="Test Gym"):
        gym = Gym.objects.create(
            name=name,
            slug=name.lower().replace(" ", "-"),
        )
        Service.get_default_for_gym(gym)
        return gym

    def create_user(self, gym, username="owner", role=None):
        from profiles.models import UserProfile

        user = User.objects.create_user(
            username=username,
            password="pass12345",
        )
        profile = user.profile
        profile.gym = gym
        profile.role = role or UserProfile.ROLE_OWNER
        profile.save()
        return user

    def create_plan(self, gym, name="Plan Premium", price=None, weekly_visits=None):
        # Decimal (not str) so the returned instance attribute is already a
        # Decimal: Django leaves kwargs as-is on the unsaved instance.
        return MembershipPlan.objects.create(
            gym=gym,
            service=Service.get_default_for_gym(gym),
            name=name,
            price=price if price is not None else Decimal("5000.00"),
            duration_days=30,
            weekly_visits=weekly_visits,
            is_base=False,
        )

    def create_member(self, gym, first_name="Ana", last_name="Gomez", phone=None):
        return Member.objects.create(
            gym=gym,
            first_name=first_name,
            last_name=last_name,
            phone=phone or f"11-{first_name.lower()}",
        )

    @staticmethod
    def open_month_subscription(member, plan, *, start_date=None, end_date=None,
                                paid=False, auto_renew=True, origin="onboarding"):
        """Open a subscription through the canonical domain entry point."""
        if start_date is None:
            start_date = timezone.localdate()
        if end_date is None:
            end_date = get_last_day_of_month(start_date)
        return SubscriptionDomain.open_subscription(
            member=member,
            plan=plan,
            start_date=start_date,
            end_date=end_date,
            paid=paid,
            auto_renew=auto_renew,
            origin=origin,
        )

    def settle_subscription(self, subscription):
        """Create a payment for the full balance so remaining == 0."""
        from subscriptions.services import subscription_remaining_balance

        remaining = subscription_remaining_balance(subscription)["remaining"]
        if remaining > 0:
            Payment.objects.create(
                gym=subscription.gym,
                member=subscription.member,
                subscription=subscription,
                amount=remaining,
                payment_method="cash",
                member_name=str(subscription.member),
                plan_name=subscription.plan.name,
            )

    @staticmethod
    def last_month_period():
        """Return (start, end) of the expired previous calendar month."""
        today = timezone.localdate()
        prev_end = today.replace(day=1) - timezone.timedelta(days=1)
        prev_start = prev_end.replace(day=1)
        return prev_start, prev_end

    @staticmethod
    def weekday_name(date_value=None):
        return WEEKDAY_NAMES[(date_value or timezone.localdate()).weekday()]

    def create_today_slot(self, gym, day=None, hour="10:00"):
        slot, _ = ScheduleSlot.objects.get_or_create(
            gym=gym,
            day=day or self.weekday_name(),
            hour=_time.fromisoformat(hour),
        )
        return slot

    def create_attendance_schedule(self, member, gym, slot, subscription=None):
        return AttendanceSchedule.objects.create(
            member=member,
            gym=gym,
            slot=slot,
            subscription=subscription,
            active=True,
        )