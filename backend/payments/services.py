from decimal import Decimal

from django.db.models import Sum

from .models import Payment


def _paid_total(queryset, exclude_pk=None):
    if exclude_pk is not None:
        queryset = queryset.exclude(pk=exclude_pk)
    return queryset.aggregate(total=Sum("amount"))["total"] or Decimal("0")


def enrollment_sessions_paid(enrollment, exclude_pk=None):
    """Paid amount for an enrollment derived from its session payments.

    Only sellado payments are excluded: any other Payment tied to an
    enrollment (currently "coseguro") counts toward amount_paid.
    """
    return _paid_total(
        Payment.objects.filter(enrollment=enrollment).exclude(concept="sellado"),
        exclude_pk,
    )


def assignment_sessions_paid(assignment, exclude_pk=None):
    """Paid amount for a PT assignment from its session (non-sellado) payments."""
    return _paid_total(
        Payment.objects.filter(
            personal_training_assignment=assignment
        ).exclude(concept="sellado"),
        exclude_pk,
    )


def sellado_paid_exists(enrollment=None, assignment=None):
    """True if at least one sellado Payment exists for the given target."""
    if enrollment is not None:
        return Payment.objects.filter(
            enrollment=enrollment, concept="sellado"
        ).exists()
    if assignment is not None:
        return Payment.objects.filter(
            personal_training_assignment=assignment, concept="sellado"
        ).exists()
    return False


def sync_enrollment_paid(enrollment, exclude_pk=None):
    """Recompute Enrollment.amount_paid from its session payments."""
    from activities.models import Enrollment

    locked = Enrollment.objects.select_for_update().get(pk=enrollment.pk)
    locked.amount_paid = enrollment_sessions_paid(locked, exclude_pk)
    locked.save(update_fields=["amount_paid"])
    return locked


def sync_assignment_paid(assignment, exclude_pk=None):
    """Recompute PT assignment amount_paid from its session payments."""
    from personal_training.models import PersonalTrainingAssignment

    locked = PersonalTrainingAssignment.objects.select_for_update().get(
        pk=assignment.pk
    )
    locked.amount_paid = assignment_sessions_paid(locked, exclude_pk)
    locked.save(update_fields=["amount_paid"])
    return locked


def set_sellado_paid(target, paid):
    """Set sellado_paid on the given enrollment or assignment.

    paid must be derived from sellado_paid_exists() so the flag always
    reflects the sellado payments.
    """
    from activities.models import Enrollment
    from personal_training.models import PersonalTrainingAssignment

    if isinstance(target, Enrollment):
        locked = Enrollment.objects.select_for_update().get(pk=target.pk)
    elif isinstance(target, PersonalTrainingAssignment):
        locked = PersonalTrainingAssignment.objects.select_for_update().get(
            pk=target.pk
        )
    else:
        return None

    if locked.sellado_paid != bool(paid):
        locked.sellado_paid = bool(paid)
        locked.save(update_fields=["sellado_paid"])
    return locked