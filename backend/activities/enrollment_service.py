from datetime import date

from django.db import transaction

from subscriptions.models import Subscription, SubscriptionItem
from subscriptions.services import (
    can_member_operate,
    get_last_day_of_month,
    get_member_active_subscription,
    member_has_active_subscription_for_service,
)
from plans.services import ensure_base_plan_for_gym

from .models import Enrollment
from .overlap import validate_enrollment


class EnrollmentError(ValueError):
    def __init__(self, message, status_code=400):
        self.status_code = status_code
        super().__init__(message)


class EnrollmentService:
    @staticmethod
    def enroll_member(member, schedule):
        if not can_member_operate(member):
            raise EnrollmentError("El miembro no puede operar.")

        if not member_has_active_subscription_for_service(member, schedule.activity.service):
            raise EnrollmentError(
                "El miembro no tiene una suscripción activa "
                "para el servicio de esta actividad."
            )

        active_count = Enrollment.objects.filter(
            gym=member.gym, schedule=schedule, active=True
        ).count()
        if active_count >= schedule.capacity:
            raise EnrollmentError("El horario alcanzó su capacidad máxima.")

        if Enrollment.objects.filter(
            gym=member.gym, member=member, schedule=schedule, active=True
        ).exists():
            raise EnrollmentError(
                "El miembro ya está inscripto en este horario.",
                status_code=409,
            )

        try:
            validate_enrollment(member, schedule)
        except ValueError as e:
            raise EnrollmentError(str(e))

        with transaction.atomic():
            enrollment = Enrollment.objects.create(
                gym=member.gym,
                member=member,
                schedule=schedule,
                active=True,
            )

            _ensure_activity_item(member, schedule.activity)

        return enrollment

    @staticmethod
    def unenroll_member(member, schedule):
        enrollment = Enrollment.objects.filter(
            gym=member.gym,
            member=member,
            schedule=schedule,
            active=True,
        ).first()
        if enrollment is None:
            raise EnrollmentError(
                "No se encontró una inscripción activa.",
                status_code=404,
            )

        with transaction.atomic():
            enrollment.active = False
            enrollment.save(update_fields=["active"])

            _cancel_activity_item(member, schedule.activity)

        return enrollment


def _ensure_activity_item(member, activity):
    """Create a SubscriptionItem for an activity in the member's current subscription."""
    sub = get_member_active_subscription(member)
    if sub is None:
        return

    activity_item = SubscriptionItem.objects.filter(
        subscription=sub,
        activity=activity,
        status="active",
    ).first()

    if activity_item is not None:
        return

    SubscriptionItem.objects.create(
        subscription=sub,
        item_type="activity",
        plan=None,
        activity=activity,
        name_snapshot=activity.name,
        price_snapshot=activity.monthly_price,
        status="active",
        start_date=sub.start_date,
        end_date=sub.end_date,
    )


def _cancel_activity_item(member, activity):
    """Cancel the SubscriptionItem for an activity when unenrolling."""
    sub = get_member_active_subscription(member)
    if sub is None:
        return

    SubscriptionItem.objects.filter(
        subscription=sub,
        activity=activity,
        status="active",
    ).update(status="cancelled")
