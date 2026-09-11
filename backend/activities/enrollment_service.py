from datetime import date
from decimal import Decimal, InvalidOperation

from django.db import transaction

from members.eligibility import MemberEligibility
from subscriptions.domain import SubscriptionDomain
from subscriptions.models import Subscription, SubscriptionItem
from subscriptions.services import sync_subscription_paid

from .models import ActivitySchedule, Enrollment
from .overlap import validate_enrollment


class EnrollmentError(ValueError):
    def __init__(self, message, status_code=400):
        self.status_code = status_code
        super().__init__(message)


class EnrollmentService:
    @staticmethod
    def enroll_member(
        member,
        schedule,
        skip_eligibility_check=False,
        modality="monthly",
        package_total_sessions=None,
        session_price=None,
        sellado_amount=None,
    ):
        activity = schedule.activity
        is_comp = member.is_comp

        if modality == "package":
            if activity.billing_mode != "sessions":
                raise EnrollmentError(
                    "La actividad no está configurada para modalidad por sesiones."
                )
            try:
                package_total = int(package_total_sessions)
            except (TypeError, ValueError):
                raise EnrollmentError(
                    "La modalidad paquete requiere un total de sesiones válido."
                )
            if package_total <= 0:
                raise EnrollmentError(
                    "La modalidad paquete requiere un total de sesiones mayor a cero."
                )
            if is_comp:
                session_price = Decimal("0")
                sellado_amount = None
            elif session_price not in (None, ""):
                try:
                    session_price = Decimal(str(session_price))
                except Exception:
                    raise EnrollmentError(
                        "El precio por sesión debe ser un monto válido."
                    )
                if session_price < 0:
                    raise EnrollmentError(
                        "El precio por sesión no puede ser negativo."
                    )
            else:
                raise EnrollmentError(
                    "Debés definir el coseguro por sesión. "
                    "Usá 0 si la obra social cubre las sesiones o es sin cargo."
                )
        else:
            modality = "monthly"
            package_total = None
            session_price = None
            sellado_amount = None

        if not skip_eligibility_check:
            if not MemberEligibility.can_operate(member):
                raise EnrollmentError("El miembro no puede operar.")

        gym = SubscriptionDomain.resolve_gym(member)

        try:
            validate_enrollment(member, schedule)
        except ValueError as e:
            raise EnrollmentError(str(e))

        with transaction.atomic():
            # Lock the schedule row so concurrent enrollments are serialized
            # and cannot overshoot capacity or create duplicates.
            locked_schedule = ActivitySchedule.objects.select_for_update().get(
                pk=schedule.pk
            )

            active_count = Enrollment.objects.filter(
                gym=gym, schedule=locked_schedule, active=True
            ).count()
            if active_count >= locked_schedule.capacity:
                raise EnrollmentError("El horario alcanzó su capacidad máxima.")

            if Enrollment.objects.filter(
                gym=gym, member=member, schedule=locked_schedule, active=True
            ).exists():
                raise EnrollmentError(
                    "El miembro ya está inscripto en este horario.",
                    status_code=409,
                )

            activity_item = None
            if modality == "monthly":
                sub = SubscriptionDomain.get_current_subscription(member)
                if sub is not None:
                    locked_sub = Subscription.objects.select_for_update().get(
                        pk=sub.pk
                    )
                    activity_item = _ensure_activity_item(
                        locked_sub,
                        activity,
                        price=Decimal("0") if is_comp else None,
                    )
                    sync_subscription_paid(locked_sub)

            enrollment = Enrollment.objects.create(
                gym=gym,
                member=member,
                schedule=locked_schedule,
                subscription_item=activity_item,
                modality=modality,
                package_total_sessions=package_total,
                session_price=session_price,
                sellado_amount=sellado_amount,
                active=True,
            )

        return enrollment

    @staticmethod
    def record_package_payment(
        enrollment,
        amount,
        payment_method="cash",
        notes="",
    ):
        """Register an amount paid against a package enrollment.

        Accumulates the amount into enrollment.amount_paid and records a
        Payment with concept="coseguro". Total paid cannot exceed the
        package total (session_price * total sessions).

        Args:
            enrollment: The package Enrollment.
            amount: The Decimal amount being collected.
            payment_method: Payment method ("cash", "transfer", "card").
            notes: Optional note stored on the Payment record.

        Returns:
            The updated Enrollment.
        """
        from payments.models import Payment

        if enrollment.modality != "package":
            raise EnrollmentError(
                "Solo las inscripciones por paquete admiten cobro de sesiones."
            )

        if enrollment.member.is_comp:
            raise EnrollmentError(
                "Socio con pase de cortesía: no se le cobra por las sesiones."
            )

        if enrollment.total_amount is None:
            raise EnrollmentError(
                "Este paquete no tiene coseguro definido. "
                "No se pueden cobrar sesiones."
            )

        try:
            amount = Decimal(str(amount))
        except (InvalidOperation, ValueError):
            raise EnrollmentError(
                "El monto cobrado debe ser un valor válido."
            )

        if amount <= 0:
            raise EnrollmentError(
                "El monto cobrado debe ser mayor a cero."
            )

        total = enrollment.total_amount
        if enrollment.amount_paid + amount > total:
            remaining = total - enrollment.amount_paid
            raise EnrollmentError(
                f"El monto supera el saldo pendiente. "
                f"Falta cobrar ${remaining}."
            )

        with transaction.atomic():
            locked = Enrollment.objects.select_for_update().get(pk=enrollment.pk)
            locked.amount_paid += amount
            locked.save(update_fields=["amount_paid"])

            Payment.objects.create(
                gym=locked.gym,
                member=locked.member,
                enrollment=locked,
                concept="coseguro",
                amount=amount,
                payment_method=payment_method,
                notes=notes,
                member_name=(
                    f"{locked.member.first_name} {locked.member.last_name}"
                ),
                plan_name=f"{locked.schedule.activity.name} · Sesiones",
            )

        locked.refresh_from_db()
        return locked

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

            _cancel_activity_items(member, schedule.activity)

            if sub is not None:
                locked_sub = Subscription.objects.select_for_update().get(
                    pk=sub.pk
                )
                sync_subscription_paid(locked_sub)

        return enrollment


def _ensure_activity_item(subscription, activity, price=None):
    """Create a SubscriptionItem for an activity in the given subscription.

    Returns the existing or newly created SubscriptionItem.

    Args:
        subscription: The Subscription instance.
        activity: The Activity instance.
        price: Optional Decimal override for price_snapshot (used for
            courtesy-pass members, billed at 0). When None, the activity's
            current monthly price is used.
    """
    activity_item = SubscriptionItem.objects.filter(
        subscription=subscription,
        activity=activity,
        status="active",
    ).first()

    if activity_item is not None:
        if price is not None and activity_item.price_snapshot != price:
            activity_item.price_snapshot = price
            activity_item.save(update_fields=["price_snapshot"])
        return activity_item

    return SubscriptionItem.objects.create(
        subscription=subscription,
        item_type="activity",
        plan=None,
        activity=activity,
        name_snapshot=activity.name,
        price_snapshot=price if price is not None else activity.monthly_price,
        status="active",
        start_date=subscription.start_date,
        end_date=subscription.end_date,
    )


def _cancel_activity_items(member, activity):
    """Cancel active activity items for a given activity across the member's
    non-expired subscriptions.

    Unenrolling today should stop the activity from being billed for the
    current period and every already-created future period (e.g. an
    auto-renewed subscription for next month). Historical (expired)
    subscriptions are left untouched to preserve immutability.
    """
    from django.utils import timezone

    today = timezone.localdate()

    SubscriptionItem.objects.filter(
        subscription__member=member,
        activity=activity,
        status="active",
        subscription__end_date__gte=today,
    ).update(status="cancelled")
