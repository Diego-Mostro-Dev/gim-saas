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


def validate_schedule_batch(schedules):
    """Validate that a list of ActivitySchedules don't overlap with each other.

    Used during onboarding when multiple schedules are selected at once
    and no Enrollment records exist yet.
    """
    by_day = {}
    for s in schedules:
        by_day.setdefault(s.day, []).append(s)

    for day, day_schedules in by_day.items():
        for i, s1 in enumerate(day_schedules):
            for s2 in day_schedules[i + 1:]:
                if _times_overlap(
                    s1.start_time, s1.end_time,
                    s2.start_time, s2.end_time,
                ):
                    raise ValueError(
                        "Los horarios seleccionados se superponen: "
                        f"{s1.activity.name} ({s1.start_time:%H:%M}–{s1.end_time:%H:%M}) "
                        f"y {s2.activity.name} ({s2.start_time:%H:%M}–{s2.end_time:%H:%M})."
                    )


def validate_gym_activity_overlap(gym_slots, activity_schedules):
    """Validate that gym schedule slots don't overlap with activity schedules.

    Used during onboarding when gym schedules and activity schedules are
    selected together and no records exist in the database yet.

    Args:
        gym_slots: iterable of objects with .day (str) and .hour (time).
        activity_schedules: iterable of ActivitySchedule objects.
    """
    for slot in gym_slots:
        gym_start = slot.hour
        gym_end = _add_hour(slot.hour)
        for schedule in activity_schedules:
            if slot.day != schedule.day:
                continue
            if _times_overlap(
                gym_start, gym_end,
                schedule.start_time, schedule.end_time,
            ):
                raise ValueError(
                    f"El horario de gimnasio {slot.get_day_display()} {gym_start:%H:%M} se superpone "
                    f"con la actividad {schedule.activity.name} "
                    f"({schedule.start_time:%H:%M}–{schedule.end_time:%H:%M})."
                )


def _times_overlap(start_a, end_a, start_b, end_b):
    return start_a < end_b and start_b < end_a


def _add_hour(t):
    dt = datetime.combine(datetime.today(), t) + timedelta(hours=1)
    return dt.time()
