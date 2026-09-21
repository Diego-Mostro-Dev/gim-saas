from datetime import datetime, timedelta

from activities.models import Enrollment as ActivityEnrollment
from attendance.models import AttendanceSchedule
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

    Args:
        member: The Member instance.
        trainer: The auth.User instance acting as trainer.
        day: str, e.g. "monday".
        start_time/end_time: time objects.
        exclude: Optional PersonalTrainingAssignment to exclude (updates).

    Raises:
        ValueError: With a human-readable message on collision.
    """
    _check_gym_schedule_overlap(member, day, start_time, end_time)
    _check_member_activity_overlap(member, day, start_time, end_time)
    _check_member_pt_overlap(member, day, start_time, end_time, exclude)
    _check_trainer_pt_overlap(trainer, day, start_time, end_time, exclude)


def _check_gym_schedule_overlap(member, day, start_time, end_time):
    active_gym_schedules = AttendanceSchedule.objects.filter(
        member=member, active=True
    ).select_related("slot")
    for gs in active_gym_schedules:
        if gs.slot.day != day:
            continue
        gym_start = gs.slot.hour
        gym_end = _add_hour(gs.slot.hour)
        if _times_overlap(gym_start, gym_end, start_time, end_time):
            gym = SubscriptionDomain.resolve_gym(member)
            raise ValueError(msg(gym, "errors.pt_fixed_schedule_overlap"))


def _check_member_activity_overlap(member, day, start_time, end_time):
    gym = SubscriptionDomain.resolve_gym(member)
    overlapping = ActivityEnrollment.objects.filter(
        gym=gym,
        member=member,
        active=True,
        schedule__day=day,
    ).select_related("schedule")
    for enrollment in overlapping:
        existing = enrollment.schedule
        if _times_overlap(
            existing.start_time, existing.end_time, start_time, end_time
        ):
            raise ValueError(
                "El socio tiene una actividad cuyo horario se superpone "
                "con el entrenamiento personal."
            )


def _check_member_pt_overlap(member, day, start_time, end_time, exclude):
    gym = SubscriptionDomain.resolve_gym(member)
    qs = PersonalTrainingAssignment.objects.filter(
        gym=gym, member=member, active=True, day=day
    )
    if exclude is not None:
        qs = qs.exclude(pk=exclude.pk)
    for assignment in qs:
        if _times_overlap(
            assignment.start_time, assignment.end_time, start_time, end_time
        ):
            raise ValueError(
                "El socio ya tiene otro entrenamiento personal cuyo horario "
                "se superpone."
            )


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


def _add_hour(t):
    dt = datetime.combine(datetime.today(), t) + timedelta(hours=1)
    return dt.time()