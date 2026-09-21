from decimal import Decimal, InvalidOperation

from django.db import transaction

from gyms.features import personal_training_enabled
from gyms.labels import msg
from members.eligibility import MemberEligibility
from subscriptions.domain import SubscriptionDomain
from subscriptions.models import Subscription, SubscriptionItem
from subscriptions.services import sync_subscription_paid
from profiles.models import UserProfile

from .models import PersonalTrainingAssignment, PersonalTrainingService
from .overlap import validate_assignment


class AssignmentError(ValueError):
    def __init__(self, message, status_code=400):
        self.status_code = status_code
        super().__init__(message)


class AssignmentService:
    @staticmethod
    def check_assignment_inputs(member, service, trainer, gym=None):
        """Validate the static invariants of a PT assignment (no schedule check)."""
        gym = gym or SubscriptionDomain.resolve_gym(member)

        if not personal_training_enabled(gym):
            raise AssignmentError(msg(gym, "features.pt_disabled"))

        if service.gym_id != gym.id or service.service.gym_id != gym.id:
            raise AssignmentError(msg(gym, "errors.offer_not_in_gym"))

        if trainer.profile.gym_id != gym.id:
            raise AssignmentError(msg(gym, "errors.trainer_not_in_gym"))

        if trainer.profile.role != UserProfile.ROLE_TRAINER:
            raise AssignmentError("El usuario seleccionado no es entrenador/a.")

        if not _gender_compatible(service, trainer):
            label = service.get_trainer_gender_display()
            raise AssignmentError(
                f"La oferta requiere un/a entrenador/a: {label}."
            )

    @staticmethod
    def assign_member(
        member,
        service,
        trainer,
        day,
        start_time,
        end_time,
        skip_eligibility_check=False,
        modality="monthly",
        package_total_sessions=None,
        session_price=None,
        sellado_amount=None,
    ):
        """Create a PT assignment for the member, handling billing."""
        gym = SubscriptionDomain.resolve_gym(member)

        AssignmentService.check_assignment_inputs(member, service, trainer, gym)

        is_comp = member.is_comp

        if modality == "package":
            if service.billing_mode != "sessions":
                raise AssignmentError(
                    "La oferta no está configurada para modalidad por sesiones."
                )
            try:
                package_total = int(package_total_sessions)
            except (TypeError, ValueError):
                raise AssignmentError(
                    "La modalidad paquete requiere un total de sesiones válido."
                )
            if package_total <= 0:
                raise AssignmentError(
                    "La modalidad paquete requiere un total de sesiones mayor a cero."
                )
            if is_comp:
                session_price = Decimal("0")
                sellado_amount = None
            elif session_price not in (None, ""):
                try:
                    session_price = Decimal(str(session_price))
                except (InvalidOperation, ValueError):
                    raise AssignmentError(
                        "El precio por sesión debe ser un monto válido."
                    )
                if session_price < 0:
                    raise AssignmentError(
                        "El precio por sesión no puede ser negativo."
                    )
            else:
                raise AssignmentError(
                    "Debés definir el coseguro por sesión. Usá 0 si la obra "
                    "social cubre las sesiones o es sin cargo."
                )
        else:
            modality = "monthly"
            package_total = None
            session_price = None
            sellado_amount = None

        if not skip_eligibility_check:
            if not MemberEligibility.can_operate(member):
                raise AssignmentError("El miembro no puede operar.")

        if not member.address.strip():
            raise AssignmentError(
                "El socio debe tener cargada una dirección para el "
                "entrenamiento personal a domicilio."
            )

        try:
            validate_assignment(member, trainer, day, start_time, end_time)
        except ValueError as e:
            raise AssignmentError(str(e))

        with transaction.atomic():
            pt_item = None
            if modality == "monthly":
                sub = SubscriptionDomain.get_current_subscription(member)
                if sub is not None:
                    locked_sub = Subscription.objects.select_for_update().get(
                        pk=sub.pk
                    )
                    pt_item = _ensure_pt_item(
                        locked_sub,
                        service,
                        price=Decimal("0") if is_comp else None,
                    )
                    sync_subscription_paid(locked_sub)

            assignment = PersonalTrainingAssignment.objects.create(
                gym=gym,
                member=member,
                trainer=trainer,
                service=service,
                day=day,
                start_time=start_time,
                end_time=end_time,
                subscription_item=pt_item,
                modality=modality,
                package_total_sessions=package_total,
                session_price=session_price,
                sellado_amount=sellado_amount,
                active=True,
            )

        return assignment

    @staticmethod
    def update_assignment(assignment, *, trainer=None, day=None,
                          start_time=None, end_time=None, service=None):
        """Apply a schedule/trainer change keeping billing intact.

        Re-validates overlap for the new slot. Trainers can also be rotated
        here. The recurring schedule is 1:1 so no separate schedule row is
        updated.
        """
        next_trainer = trainer if trainer is not None else assignment.trainer
        next_day = day if day is not None else assignment.day
        next_start = start_time if start_time is not None else assignment.start_time
        next_end = end_time if end_time is not None else assignment.end_time
        next_service = service if service is not None else assignment.service

        if not _gender_compatible(next_service, next_trainer):
            label = next_service.get_trainer_gender_display()
            raise AssignmentError(f"La oferta requiere un/a entrenador/a: {label}.")

        try:
            validate_assignment(
                assignment.member,
                next_trainer,
                next_day,
                next_start,
                next_end,
                exclude=assignment,
            )
        except ValueError as e:
            raise AssignmentError(str(e))

        assignment.trainer = next_trainer
        assignment.day = next_day
        assignment.start_time = next_start
        assignment.end_time = next_end
        assignment.save(
            update_fields=["trainer", "day", "start_time", "end_time", "service"]
        )
        return assignment

    @staticmethod
    def unassign_member(member, assignment):
        gym = SubscriptionDomain.resolve_gym(member)

        with transaction.atomic():
            assignment.active = False
            assignment.save(update_fields=["active"])

            _cancel_pt_items(member, assignment.service, assignment)

            sub = SubscriptionDomain.get_current_subscription(member)
            if sub is not None:
                locked_sub = Subscription.objects.select_for_update().get(
                    pk=sub.pk
                )
                sync_subscription_paid(locked_sub)

        return assignment

    @staticmethod
    def record_package_payment(assignment, amount, payment_method="cash", notes=""):
        """Register an amount paid against a PT package assignment.

        Records a Payment with concept="personal_training". The Payment rows
        are the only source of truth: assignment.amount_paid is synced from
        them.
        """
        from payments.models import Payment
        from payments.services import (
            assignment_sessions_paid,
            sync_assignment_paid,
        )

        if assignment.modality != "package":
            raise AssignmentError(
                "Esta asignación es mensual: se cobra en la cuota del socio, "
                "no por sesiones. Solo los paquetes admiten cobro de sesiones."
            )

        if assignment.member.is_comp:
            raise AssignmentError(
                "Socio con pase de cortesía: no se le cobra por las sesiones."
            )

        if assignment.total_amount is None:
            raise AssignmentError(
                "Esta asignación no tiene coseguro definido. "
                "No se pueden cobrar sesiones."
            )

        try:
            amount = Decimal(str(amount))
        except (InvalidOperation, ValueError):
            raise AssignmentError("El monto cobrado debe ser un valor válido.")

        if amount <= 0:
            raise AssignmentError("El monto cobrado debe ser mayor a cero.")

        with transaction.atomic():
            locked = PersonalTrainingAssignment.objects.select_for_update().get(
                pk=assignment.pk
            )

            total = locked.total_amount
            if total is None:
                raise AssignmentError(
                    "Esta asignación no tiene coseguro definido. "
                    "No se pueden cobrar sesiones."
                )

            paid = assignment_sessions_paid(locked)
            if paid + amount > total:
                remaining = total - paid
                raise AssignmentError(
                    f"El monto supera el saldo pendiente. "
                    f"Falta cobrar ${remaining}."
                )

            Payment.objects.create(
                gym=locked.gym,
                member=locked.member,
                personal_training_assignment=locked,
                concept="personal_training",
                amount=amount,
                payment_method=payment_method,
                notes=notes,
                member_name=(
                    f"{locked.member.first_name} {locked.member.last_name}"
                ),
                plan_name=f"{locked.service.name} · Sesiones",
            )

            sync_assignment_paid(locked)

        locked.refresh_from_db()
        return locked


def _gender_compatible(service, trainer):
    if service.trainer_gender == "any":
        return True
    profile = getattr(trainer, "profile", None)
    if profile is None:
        return False
    return profile.gender == service.trainer_gender


def _ensure_pt_item(subscription, pt_service, price=None):
    """Create a SubscriptionItem for a PT service in the given subscription.

    Returns the existing or newly created SubscriptionItem. Multiple active
    assignments of the same service share a single item.
    """
    pt_item = SubscriptionItem.objects.filter(
        subscription=subscription,
        personal_training=pt_service,
        status="active",
    ).first()

    if pt_item is not None:
        if price is not None and pt_item.price_snapshot != price:
            pt_item.price_snapshot = price
            pt_item.save(update_fields=["price_snapshot"])
        return pt_item

    return SubscriptionItem.objects.create(
        subscription=subscription,
        item_type="personal_training",
        plan=None,
        personal_training=pt_service,
        name_snapshot=pt_service.name,
        price_snapshot=price if price is not None else pt_service.monthly_price,
        status="active",
        start_date=subscription.start_date,
        end_date=subscription.end_date,
    )


def _cancel_pt_items(member, pt_service, exclude_assignment):
    """Cancel active PT items for a service once no active assignment uses it.

    Non-expired subscriptions keep their PT line cancelled when the last
    assignment of the service is removed; historical (expired) subscriptions
    are left untouched to preserve immutability.
    """
    from django.utils import timezone

    today = timezone.localdate()

    other_active = PersonalTrainingAssignment.objects.filter(
        member=member,
        service=pt_service,
        active=True,
    ).exclude(pk=exclude_assignment.pk).exists()

    if other_active:
        return

    SubscriptionItem.objects.filter(
        subscription__member=member,
        personal_training=pt_service,
        status="active",
        subscription__end_date__gte=today,
    ).update(status="cancelled")