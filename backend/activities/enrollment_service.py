from datetime import date

from django.db import transaction

from members.eligibility import MemberEligibility
from subscriptions.domain import SubscriptionDomain
from subscriptions.models import Subscription, SubscriptionItem
from subscriptions.services import sync_subscription_paid

from .models import Enrollment
from .overlap import validate_enrollment


class EnrollmentError(ValueError):
    def __init__(self, message, status_code=400):
        self.status_code = status_code
        super().__init__(message)


class EnrollmentService:
    @staticmethod
    def enroll_member(member, schedule, skip_eligibility_check=False):
        if not skip_eligibility_check:
            if not MemberEligibility.can_operate(member):
                raise EnrollmentError("El miembro no puede operar.")

            if not MemberEligibility.has_active_subscription_for_service(member, schedule.activity.service):
                raise EnrollmentError(
                    "El miembro no tiene una suscripción activa "
                    "para el servicio de esta actividad."
                )

        gym = SubscriptionDomain.resolve_gym(member)

        active_count = Enrollment.objects.filter(
            gym=gym, schedule=schedule, active=True
        ).count()
        if active_count >= schedule.capacity:
            raise EnrollmentError("El horario alcanzó su capacidad máxima.")

        if Enrollment.objects.filter(
            gym=gym, member=member, schedule=schedule, active=True
        ).exists():
            raise EnrollmentError(
                "El miembro ya está inscripto en este horario.",
                status_code=409,
            )

        try:
            validate_enrollment(member, schedule)
        except ValueError as e:
            raise EnrollmentError(str(e))

        sub = SubscriptionDomain.get_current_subscription(member)

        with transaction.atomic():
            activity_item = None
            if sub is not None:
                locked_sub = Subscription.objects.select_for_update().get(
                    pk=sub.pk
                )
                activity_item = _ensure_activity_item(locked_sub, schedule.activity)
                sync_subscription_paid(locked_sub)

            enrollment = Enrollment.objects.create(
                gym=gym,
                member=member,
                schedule=schedule,
                subscription_item=activity_item,
                active=True,
            )

        return enrollment

    @staticmethod
    def unenroll_member(member, schedule):
        gym = SubscriptionDomain.resolve_gym(member)

        enrollment = Enrollment.objects.filter(
            gym=gym,
            member=member,
            schedule=schedule,
            active=True,
        ).first()
        if enrollment is None:
            raise EnrollmentError(
                "No se encontró una inscripción activa.",
                status_code=404,
            )

        sub = SubscriptionDomain.get_current_subscription(member)

        with transaction.atomic():
            enrollment.active = False
            enrollment.save(update_fields=["active"])

            if sub is not None:
                locked_sub = Subscription.objects.select_for_update().get(
                    pk=sub.pk
                )
                _cancel_activity_item(locked_sub, schedule.activity)
                sync_subscription_paid(locked_sub)

        return enrollment


def _ensure_activity_item(subscription, activity):
    """Create a SubscriptionItem for an activity in the given subscription.

    Returns the existing or newly created SubscriptionItem.
    """
    activity_item = SubscriptionItem.objects.filter(
        subscription=subscription,
        activity=activity,
        status="active",
    ).first()

    if activity_item is not None:
        return activity_item

    return SubscriptionItem.objects.create(
        subscription=subscription,
        item_type="activity",
        plan=None,
        activity=activity,
        name_snapshot=activity.name,
        price_snapshot=activity.monthly_price,
        status="active",
        start_date=subscription.start_date,
        end_date=subscription.end_date,
    )


def _cancel_activity_item(subscription, activity):
    """Cancel the SubscriptionItem for an activity when unenrolling.

    Only operates on subscriptions that are currently active
    (start_date <= today <= end_date) to preserve historical immutability.
    """
    from django.utils import timezone

    today = timezone.localdate()
    if not (subscription.start_date <= today <= subscription.end_date):
        return

    SubscriptionItem.objects.filter(
        subscription=subscription,
        activity=activity,
        status="active",
    ).update(status="cancelled")
