from core.overlap import (
    CONFLICT_ACTIVITY,
    CONFLICT_GYM_SCHEDULE,
    CONFLICT_OUTING,
    CONFLICT_PT,
    SlotConflict,
    check_member_slot,
)
from gyms.labels import msg
from subscriptions.domain import SubscriptionDomain

from .models import PersonalTrainingAssignment


def validate_assignment(member, trainer, day, start_time, end_time, exclude=None):
    """Validate a PT assignment doesn't collide with existing schedules.

    Checks four dimensions:
    - the member's fixed gym schedule (AttendanceSchedule);
    - the member's activity enrollments;
    - the member's other PT assignments;
    - the trainer's other PT assignments (a trainer can't be at two places
      at the same time).

    The first three come from ``core/overlap.py`` (the shared checker, so
    outings are covered too since Fase K2 / ADD-16); the trainer's own
    agenda is specific to PT.

    Args:
        member: The Member instance.
        trainer: The auth.User instance acting as trainer.
        day: str, e.g. "monday".
        start_time/end_time: time objects.
        exclude: Optional PersonalTrainingAssignment to exclude (updates).

    Raises:
        ValueError: With a human-readable message on collision.
    """
    try:
        check_member_slot(
            member,
            day,
            start_time,
            end_time,
            exclude=(
                {"personal_training": exclude.pk} if exclude is not None else None
            ),
        )
    except SlotConflict as conflict:
        raise ValueError(_conflict_message(conflict, member))

    _check_trainer_pt_overlap(trainer, day, start_time, end_time, exclude)


def _conflict_message(conflict, member):
    gym = SubscriptionDomain.resolve_gym(member)

    if conflict.code == CONFLICT_GYM_SCHEDULE:
        return msg(gym, "errors.pt_fixed_schedule_overlap")
    if conflict.code == CONFLICT_ACTIVITY:
        return (
            "El socio tiene una actividad cuyo horario se superpone "
            "con el entrenamiento personal."
        )
    if conflict.code == CONFLICT_OUTING:
        return (
            "El socio tiene una salida cuyo horario se superpone "
            "con el entrenamiento personal."
        )
    if conflict.code == CONFLICT_PT:
        return (
            "El socio ya tiene otro entrenamiento personal cuyo horario "
            "se superpone."
        )
    return "El horario se superpone con otro compromiso del socio."


def _check_trainer_pt_overlap(trainer, day, start_time, end_time, exclude):
    qs = PersonalTrainingAssignment.objects.filter(
        trainer=trainer, active=True, day=day
    )
    if exclude is not None:
        qs = qs.exclude(pk=exclude.pk)
    for assignment in qs:
        if _times_overlap(
            assignment.start_time, assignment.end_time, start_time, end_time
        ):
            raise ValueError(
                "El/la entrenador/a ya tiene otra sesión cuyo horario se "
                "superpone en ese día."
            )


def _times_overlap(start_a, end_a, start_b, end_b):
    return start_a < end_b and start_b < end_a
