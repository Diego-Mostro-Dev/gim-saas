from decimal import Decimal, InvalidOperation

from django.db import transaction

from members.eligibility import MemberEligibility
from subscriptions.domain import SubscriptionDomain
from subscriptions.models import Subscription, SubscriptionItem
from subscriptions.services import sync_subscription_paid

from .models import OutingEnrollment, OutingSchedule


class OutingEnrollmentError(ValueError):
    def __init__(self, message, status_code=400):
        self.status_code = status_code
        super().__init__(message)


class OutingEnrollmentService:
    @staticmethod
    def enroll_member(
        member,
        schedule,
        skip_eligibility_check=False,
        modality="monthly",
        package_total_sessions=None,
        session_price=None,
    ):
        outing = schedule.outing
        is_comp = member.is_comp

        if modality == "package":
            if outing.billing_mode != "sessions":
                raise OutingEnrollmentError(
                    "La salida no está configurada para modalidad por sesiones."
                )
            try:
                package_total = int(package_total_sessions)
            except (TypeError, ValueError):
                raise OutingEnrollmentError(
                    "La modalidad paquete requiere un total de sesiones válido."
                )
            if package_total <= 0:
                raise OutingEnrollmentError(
                    "La modalidad paquete requiere un total de sesiones mayor a cero."
                )
            if is_comp:
                session_price = Decimal("0")
            elif session_price not in (None, ""):
                try:
                    session_price = Decimal(str(session_price))
                except (InvalidOperation, ValueError):
                    raise OutingEnrollmentError(
                        "El precio por sesión debe ser un monto válido."
                    )
                if session_price < 0:
                    raise OutingEnrollmentError(
                        "El precio por sesión no puede ser negativo."
                    )
            else:
                raise OutingEnrollmentError(
                    "Debés definir el costo por sesión. "
                    "Usá 0 si la obra social cubre las salidas o es sin cargo."
                )
        else:
            modality = "monthly"
            package_total = None
            session_price = None

        if not skip_eligibility_check:
            if not MemberEligibility.can_operate(member):
                raise OutingEnrollmentError("El miembro no puede operar.")

        gym = SubscriptionDomain.resolve_gym(member)

        with transaction.atomic():
            locked_schedule = OutingSchedule.objects.select_for_update().get(
                pk=schedule.pk
            )

            active_count = OutingEnrollment.objects.filter(
                gym=gym, schedule=locked_schedule, active=True
            ).count()
            if active_count >= locked_schedule.capacity:
                raise OutingEnrollmentError(
                    "El horario alcanzó su capacidad máxima."
                )

            if OutingEnrollment.objects.filter(
                gym=gym, member=member, schedule=locked_schedule, active=True
            ).exists():
                raise OutingEnrollmentError(
                    "El miembro ya está inscripto en este horario.",
                    status_code=409,
                )

            outing_item = None
            if modality == "monthly":
                sub = SubscriptionDomain.get_current_subscription(member)
                if sub is not None:
                    locked_sub = Subscription.objects.select_for_update().get(
                        pk=sub.pk
                    )
                    outing_item = _ensure_outing_item(
                        locked_sub,
                        outing,
                        price=Decimal("0") if is_comp else None,
                    )
                    sync_subscription_paid(locked_sub)

            enrollment = OutingEnrollment.objects.create(
                gym=gym,
                member=member,
                schedule=locked_schedule,
                subscription_item=outing_item,
                modality=modality,
                package_total_sessions=package_total,
                session_price=session_price,
                active=True,
            )

        return enrollment

    @staticmethod
    def unenroll_member(member, schedule):
        gym = SubscriptionDomain.resolve_gym(member)

        enrollment = OutingEnrollment.objects.filter(
            gym=gym,
            member=member,
            schedule=schedule,
            active=True,
        ).first()
        if enrollment is None:
            raise OutingEnrollmentError(
                "No se encontró una inscripción activa.",
                status_code=404,
            )

        sub = SubscriptionDomain.get_current_subscription(member)

        with transaction.atomic():
            enrollment.active = False
            enrollment.save(update_fields=["active"])

            _cancel_outing_items(member, schedule.outing)

            if sub is not None:
                locked_sub = Subscription.objects.select_for_update().get(
                    pk=sub.pk
                )
                sync_subscription_paid(locked_sub)

        return enrollment

    @staticmethod
    def record_package_payment(
        enrollment,
        amount,
        payment_method="cash",
        notes="",
    ):
        """Register an amount paid against an outing package enrollment.

        Records a Payment with concept="outing". The Payment rows are the
        only source of truth: OutingEnrollment.amount_paid is synced from
        them. Total paid cannot exceed the package total (session_price *
        total sessions).

        Args:
            enrollment: The package OutingEnrollment.
            amount: The Decimal amount being collected.
            payment_method: Payment method ("cash", "transfer", "card").
            notes: Optional note stored on the Payment record.

        Returns:
            The updated OutingEnrollment.
        """
        from payments.models import Payment
        from payments.services import (
            outing_sessions_paid,
            sync_outing_paid,
        )

        if enrollment.modality != "package":
            raise OutingEnrollmentError(
                "La inscripción no es de modalidad paquete."
            )

        if enrollment.member.is_comp:
            raise OutingEnrollmentError(
                "Socio con pase de cortesía: no se le cobra por las sesiones."
            )

        if enrollment.total_amount is None:
            raise OutingEnrollmentError(
                "Este paquete no tiene costo por sesión definido. "
                "No se pueden cobrar sesiones."
            )

        try:
            amount = Decimal(str(amount))
        except (InvalidOperation, ValueError):
            raise OutingEnrollmentError(
                "El monto debe ser un valor válido."
            )
        if amount <= 0:
            raise OutingEnrollmentError("El monto debe ser mayor a cero.")

        with transaction.atomic():
            enrollment = OutingEnrollment.objects.select_for_update().get(
                pk=enrollment.pk
            )

            total = enrollment.total_amount
            if total is None:
                raise OutingEnrollmentError(
                    "Este paquete no tiene costo por sesión definido. "
                    "No se pueden cobrar sesiones."
                )

            paid = outing_sessions_paid(enrollment)
            if paid + amount > total:
                remaining = total - paid
                raise OutingEnrollmentError(
                    f"El monto supera el saldo pendiente. "
                    f"Falta cobrar ${remaining}."
                )

            Payment.objects.create(
                gym=enrollment.gym,
                member=enrollment.member,
                outing_enrollment=enrollment,
                concept="outing",
                amount=amount,
                payment_method=payment_method,
                notes=notes,
                member_name=(
                    f"{enrollment.member.first_name} "
                    f"{enrollment.member.last_name}"
                ),
                plan_name=f"{enrollment.schedule.outing.name} · Sesiones",
            )

            sync_outing_paid(enrollment)

        enrollment.refresh_from_db()
        return enrollment


def _ensure_outing_item(subscription, outing, price=None):
    """Create a SubscriptionItem for an outing in the given subscription.

    Returns the existing or newly created SubscriptionItem. When price is
    None the outing's current monthly price is used; courtesy-pass members
    are billed at 0.
    """
    outing_item = SubscriptionItem.objects.filter(
        subscription=subscription,
        outing=outing,
        status="active",
    ).first()

    if outing_item is not None:
        if price is not None and outing_item.price_snapshot != price:
            outing_item.price_snapshot = price
            outing_item.save(update_fields=["price_snapshot"])
        return outing_item

    return SubscriptionItem.objects.create(
        subscription=subscription,
        item_type="outing",
        plan=None,
        outing=outing,
        name_snapshot=outing.name,
        price_snapshot=price if price is not None else outing.monthly_price,
        status="active",
        start_date=subscription.start_date,
        end_date=subscription.end_date,
    )


def _cancel_outing_items(member, outing):
    """Cancel active outing items for a given outing across the member's
    non-expired subscriptions.

    Unenrolling today should stop the outing from being billed for the
    current period and every already-created future period. Historical
    (expired) subscriptions are left untouched to preserve immutability.
    """
    from django.utils import timezone

    today = timezone.localdate()

    SubscriptionItem.objects.filter(
        subscription__member=member,
        outing=outing,
        status="active",
        subscription__end_date__gte=today,
    ).update(status="cancelled")