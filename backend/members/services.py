from datetime import date

from django.db import transaction

from activities.enrollment_service import EnrollmentError, EnrollmentService
from plans.models import MembershipPlan
from plans.services import ensure_base_plan_for_gym
from subscriptions.domain import ScheduleDomain, ScheduleError, SubscriptionDomain
from subscriptions.services import get_last_day_of_month

from .models import Member


class RegistrationError(Exception):
    """Raised when a registration operation cannot be completed."""

    def __init__(self, detail, status_code=400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(str(detail))


class RegistrationService:
    """Business service for member onboarding/registration.

    Orchestrates Member creation, Subscription setup, activity enrollment,
    and attendance schedule creation in a single transaction.
    """

    @staticmethod
    def register(
        *,
        gym,
        validated_member_data,
        plan_id=None,
        activity_entries=None,
        has_gym=False,
        has_activities=False,
        raw_schedules=None,
    ):
        """Register a new member with the specified services.

        Creates Member, Subscription(s), activity enrollments, and
        attendance schedules inside a single transaction.

        Args:
            gym: The Gym instance.
            validated_member_data: Dict of validated member fields
                (from MemberSerializer.validated_data).
            plan_id: Optional plan ID for gym membership subscription.
            activity_entries: List of {"activity_id": ..., "schedule": ...} dicts.
            has_gym: Whether gym schedules were selected.
            has_activities: Whether activity schedules were selected.
            raw_schedules: List of {"day": ..., "hour": ...} dicts for gym schedules.

        Returns:
            The created Member instance.

        Raises:
            RegistrationError: When a business rule is violated during
                enrollment or schedule creation. The whole registration is
                atomic: any failure rolls back all created records.
        """
        with transaction.atomic():
            member = Member.objects.create(gym=gym, **validated_member_data)

            subscription = None

            if plan_id:
                plan = MembershipPlan.objects.get(id=plan_id, gym=gym)
                today = date.today()
                subscription = SubscriptionDomain.open_subscription(
                    member=member,
                    plan=plan,
                    start_date=today,
                    end_date=get_last_day_of_month(today),
                    origin="onboarding",
                )

            if has_activities and not has_gym:
                if gym.allow_activity_without_membership:
                    base_plan = ensure_base_plan_for_gym(gym)
                    today = date.today()
                    subscription = SubscriptionDomain.open_subscription(
                        member=member,
                        plan=base_plan,
                        start_date=today,
                        end_date=get_last_day_of_month(today),
                        auto_renew=True,
                        origin="onboarding",
                    )

            if activity_entries:
                for entry in activity_entries:
                    try:
                        EnrollmentService.enroll_member(
                            member,
                            entry["schedule"],
                            skip_eligibility_check=True,
                        )
                    except EnrollmentError as e:
                        raise RegistrationError(
                            {"activity_schedules": str(e)},
                            status_code=e.status_code,
                        ) from e

            if has_gym and raw_schedules:
                try:
                    ScheduleDomain.create_bulk(
                        member, gym, raw_schedules, subscription=subscription,
                    )
                except ScheduleError as e:
                    raise RegistrationError(
                        {"schedules": str(e)},
                    ) from e

        return member
