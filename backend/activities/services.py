from datetime import datetime, timedelta

from attendance.models import AttendanceSchedule
from .models import Enrollment


def validate_enrollment(member, schedule):
    active_gym_schedules = list(
        AttendanceSchedule.objects.filter(
            member=member, active=True
        ).select_related("slot")
    )

    if active_gym_schedules:
        _check_gym_schedule_overlap(active_gym_schedules, schedule)

    _check_activity_overlap(member, schedule)


def _check_gym_schedule_overlap(active_gym_schedules, target_schedule):
    for gs in active_gym_schedules:
        if gs.slot.day != target_schedule.day:
            continue

        gym_start = gs.slot.hour
        gym_end = _add_hour(gs.slot.hour)

        if _times_overlap(
            gym_start, gym_end,
            target_schedule.start_time, target_schedule.end_time,
        ):
            raise ValueError(
                "El miembro tiene un horario fijo del gimnasio que se superpone "
                "con el horario de esta actividad."
            )


def _check_activity_overlap(member, target_schedule):
    overlapping = Enrollment.objects.filter(
        gym=member.gym,
        member=member,
        active=True,
        schedule__day=target_schedule.day,
    ).exclude(schedule=target_schedule).select_related("schedule")

    for enrollment in overlapping:
        existing = enrollment.schedule
        if _times_overlap(
            existing.start_time, existing.end_time,
            target_schedule.start_time, target_schedule.end_time,
        ):
            raise ValueError(
                "El miembro ya está inscripto en una actividad cuyo horario "
                "se superpone con esta actividad."
            )


def _times_overlap(start_a, end_a, start_b, end_b):
    return start_a < end_b and start_b < end_a


def _add_hour(t):
    dt = datetime.combine(datetime.today(), t) + timedelta(hours=1)
    return dt.time()
