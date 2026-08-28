from datetime import date

from django.db import transaction

from activities.enrollment_service import EnrollmentError, EnrollmentService
from activities.models import Activity, ActivitySchedule, Enrollment
from activities.overlap import validate_schedule_batch
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


def validate_activity_schedules(gym, raw_schedules):
    """Validate and resolve activity schedule selections for registration.

    Each item in raw_schedules must be a dict with activity_id and schedule_id.
    Returns a list of {"activity_id": ..., "schedule": ActivitySchedule} dicts
    ready for RegistrationService.register().

    Raises ValueError on any validation failure.
    """
    seen = set()
    result = []

    for item in raw_schedules:
        if not isinstance(item, dict):
            raise ValueError(
                "Cada elemento debe ser un objeto con "
                "activity_id y schedule_id."
            )

        activity_id = item.get("activity_id")
        schedule_id = item.get("schedule_id")

        if not activity_id or not schedule_id:
            raise ValueError(
                "Cada selección debe incluir "
                "activity_id y schedule_id."
            )

        if not Activity.objects.filter(
            id=activity_id, service__gym=gym, active=True
        ).exists():
            raise ValueError(
                f"La actividad {activity_id} no existe "
                f"o no está activa."
            )

        schedule = ActivitySchedule.objects.filter(
            id=schedule_id, activity__id=activity_id
        ).first()

        if not schedule:
            raise ValueError(
                f"El horario {schedule_id} no pertenece "
                f"a la actividad {activity_id}."
            )

        if schedule_id in seen:
            raise ValueError(
                f"El horario {schedule_id} está duplicado."
            )
        seen.add(schedule_id)

        enrolled_count = Enrollment.objects.filter(
            schedule=schedule, active=True
        ).count()
        if enrolled_count >= schedule.capacity:
            raise ValueError(
                f"El horario {schedule_id} está completo."
            )

        result.append(
            {"activity_id": activity_id, "schedule": schedule}
        )

    selected_schedules = [entry["schedule"] for entry in result]
    validate_schedule_batch(selected_schedules)

    return result


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
