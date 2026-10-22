"""Shared helpers for the critical-flow test suites.

All critical tests (auth, member onboarding, payment->debt, check-in and
recovery) build on the same small fixture graph: a Gym with a staff user and
a MembershipPlan, plus helpers that open subscriptions and settle them.
"""

import uuid
from datetime import date, datetime, time as _time
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
        if phone is None:
            # ACC-19: el teléfono es único por gym (constraint en la base), así
            # que el default tiene que ser único por socio.
            phone = f"11-{first_name.lower()[:8]}-{uuid.uuid4().hex[:8]}"
        return Member.objects.create(
            gym=gym,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
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
        """Create a payment for the full balance so remaining == 0.

        Also derives the denormalized ``paid`` flag, because the payment is
        created straight through the ORM and so never reaches
        PaymentSerializer.create, which is what calls sync_subscription_paid
        in production. Without this a settled subscription kept ``paid=False``
        in the database, and a test that read the flag afterwards was
        asserting a state the real payment path never produces.
        """
        from subscriptions.services import (
            subscription_remaining_balance,
            sync_subscription_paid,
        )

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

        # Unconditional, not inside the ``if``: even with nothing left to pay
        # the flag may be stale, and that is exactly what it is here to fix.
        sync_subscription_paid(subscription)

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

    # --- Fase G: paquetes de sesiones -------------------------------------

    @staticmethod
    def _backdate(instance, field, when):
        """Set an auto_now_add field the ORM normally owns."""
        model = type(instance)
        model.objects.filter(pk=instance.pk).update(
            **{field: timezone.make_aware(datetime.combine(when, _time(0, 0)))}
        )
        instance.refresh_from_db()

    def create_activity_package(self, *, gym=None, member=None, total=10,
                                day="monday", session_price="2500.00",
                                start_time=_time(9, 0), end_time=_time(10, 0),
                                created_at=None):
        """Activity + ActivitySchedule + package Enrollment in one helper."""
        from activities.models import (
            Activity,
            ActivitySchedule,
            Enrollment,
        )

        gym = gym or self.gym
        member = member or self.create_member(gym)
        activity = Activity.objects.create(
            service=Service.get_default_for_gym(gym),
            name="Kinesio",
            billing_mode="sessions",
        )
        schedule = ActivitySchedule.objects.create(
            activity=activity,
            day=day,
            start_time=start_time,
            end_time=end_time,
            capacity=10,
        )
        enrollment = Enrollment.objects.create(
            gym=gym,
            member=member,
            schedule=schedule,
            modality="package",
            package_total_sessions=total,
            session_price=Decimal(session_price),
            amount_paid=Decimal(session_price) * total,
        )
        when = created_at or date(2030, 1, 1)
        self._backdate(schedule, "created_at", when)
        self._backdate(enrollment, "enrolled_at", when)
        return activity, schedule, enrollment

    def create_pt_assignment(self, *, gym=None, member=None, trainer=None,
                             total=10, day="monday", session_price="3000.00",
                             start_time=_time(9, 0), end_time=_time(10, 0),
                             created_at=None):
        """PersonalTrainingService + package Assignment in one helper."""
        from personal_training.models import (
            PersonalTrainingAssignment,
            PersonalTrainingService,
        )

        gym = gym or self.gym
        member = member or self.create_member(gym)
        if trainer is None:
            import uuid

            trainer = User.objects.create_user(
                username=f"trainer-{uuid.uuid4().hex[:8]}",
                password="pass12345",
            )
            profile = trainer.profile
            profile.gym = gym
            profile.role = "staff"
            profile.save()
        service = PersonalTrainingService.objects.create(
            gym=gym,
            service=Service.get_default_for_gym(gym),
            name="Entrenamiento personal",
            billing_mode="sessions",
        )
        assignment = PersonalTrainingAssignment.objects.create(
            gym=gym,
            member=member,
            trainer=trainer,
            service=service,
            day=day,
            start_time=start_time,
            end_time=end_time,
            modality="package",
            package_total_sessions=total,
            session_price=Decimal(session_price),
            amount_paid=Decimal(session_price) * total,
        )
        self._backdate(assignment, "created_at", created_at or date(2030, 1, 1))
        return service, assignment

    def create_outing_package(self, *, gym=None, member=None, total=10,
                              day="monday", session_price="2000.00",
                              start_time=_time(9, 0), end_time=_time(10, 0),
                              created_at=None):
        """Outing + OutingSchedule + package OutingEnrollment in one helper."""
        from outings.models import (
            Outing,
            OutingEnrollment,
            OutingSchedule,
        )

        gym = gym or self.gym
        member = member or self.create_member(gym)
        outing = Outing.objects.create(
            service=Service.get_default_for_gym(gym),
            name="Trekking",
            billing_mode="sessions",
        )
        schedule = OutingSchedule.objects.create(
            outing=outing,
            day=day,
            start_time=start_time,
            end_time=end_time,
            capacity=10,
        )
        enrollment = OutingEnrollment.objects.create(
            gym=gym,
            member=member,
            schedule=schedule,
            modality="package",
            package_total_sessions=total,
            session_price=Decimal(session_price),
            amount_paid=Decimal(session_price) * total,
        )
        self._backdate(enrollment, "enrolled_at", created_at or date(2030, 1, 1))
        return outing, schedule, enrollment

    def create_closed_date(self, day, *, gym=None):
        from gyms.models import GymClosedDate

        return GymClosedDate.objects.create(
            gym=gym or self.gym,
            date=day,
        )