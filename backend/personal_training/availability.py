from datetime import datetime, timedelta

from activities.models import Enrollment as ActivityEnrollment
from attendance.models import AttendanceSchedule, ScheduleSlot
from subscriptions.domain import SubscriptionDomain

from .models import DAY_CHOICES, PersonalTrainingAssignment


def available_slots(gym, member, trainer, exclude=None, duration_minutes=None):
    """Franjas recurrentes libres por día para un PT (socio + trainer).

    Args:
        gym: The Gym.
        member: The Member instance.
        trainer: The auth.User instance acting as trainer.
        exclude: Optional PersonalTrainingAssignment to exclude (the slot
            being rescheduled is not treated as occupied).
        duration_minutes: Optional service duration; intervals shorter than
            this are dropped so the service always fits.

    Returns:
        dict: {
            "days": {day: [{"start_time": "HH:MM", "end_time": "HH:MM"}]},
            "closed_days": [day, ...],
        }
    """
    days = {}
    closed_days = []
    for day, _label in DAY_CHOICES:
        intervals = free_intervals(gym, member, trainer, day, exclude)
        if intervals is None:
            days[day] = []
            closed_days.append(day)
        else:
            if duration_minutes:
                intervals = [
                    (start, end)
                    for start, end in intervals
                    if (end.hour * 60 + end.minute)
                    - (start.hour * 60 + start.minute)
                    >= duration_minutes
                ]
            days[day] = [
                {
                    "start_time": start.strftime("%H:%M"),
                    "end_time": end.strftime("%H:%M"),
                }
                for start, end in intervals
            ]
    return {"days": days, "closed_days": closed_days}


def free_intervals(gym, member, trainer, day, exclude=None):
    """Intervalos libres de media abierta [start, end) para un día dado.

    Ventanas abiertas = ScheduleSlot del gimnasio ese día (cada una se trata
    como 1h, misma convención que usa el resto del código). Se restan los
    intervalos ocupados por: el horario fijo del socio, sus actividades, sus
    otros PT y los otros PT del trainer.

    Returns:
        List of (start, end) time objects, o None si el gimnasio no abre
        ese día.
    """
    slots = list(ScheduleSlot.objects.filter(gym=gym, day=day))
    if not slots:
        return None

    windows = [
        (_to_minutes(slot.hour), _to_minutes(slot.hour) + 60) for slot in slots
    ]
    occupied = []
    occupied.extend(_gym_schedule_intervals(member, day))
    occupied.extend(_member_activity_intervals(gym, member, day))
    occupied.extend(_member_pt_intervals(gym, member, day, exclude))
    occupied.extend(_trainer_pt_intervals(trainer, day, exclude))

    free_minutes = _subtract_intervals(windows, occupied)
    return [(_to_time(start), _to_time(end)) for start, end in free_minutes]


def _gym_schedule_intervals(member, day):
    qs = AttendanceSchedule.objects.filter(
        member=member, active=True
    ).select_related("slot")
    return [
        (_to_minutes(gs.slot.hour), _to_minutes(gs.slot.hour) + 60)
        for gs in qs
        if gs.slot.day == day
    ]


def _member_activity_intervals(gym, member, day):
    qs = ActivityEnrollment.objects.filter(
        gym=gym, member=member, active=True, schedule__day=day
    ).select_related("schedule")
    return [
        (
            _to_minutes(enrollment.schedule.start_time),
            _to_minutes(enrollment.schedule.end_time),
        )
        for enrollment in qs
    ]


def _member_pt_intervals(gym, member, day, exclude):
    qs = PersonalTrainingAssignment.objects.filter(
        gym=gym, member=member, active=True, day=day
    )
    if exclude is not None:
        qs = qs.exclude(pk=exclude.pk)
    return [
        (_to_minutes(a.start_time), _to_minutes(a.end_time)) for a in qs
    ]


def _trainer_pt_intervals(trainer, day, exclude):
    qs = PersonalTrainingAssignment.objects.filter(
        trainer=trainer, active=True, day=day
    )
    if exclude is not None:
        qs = qs.exclude(pk=exclude.pk)
    return [
        (_to_minutes(a.start_time), _to_minutes(a.end_time)) for a in qs
    ]


def _subtract_intervals(intervals, subtractions):
    result = [list(i) for i in intervals]
    for sub_start, sub_end in subtractions:
        if sub_end <= sub_start:
            continue
        new_result = []
        for start, end in result:
            if sub_end <= start or sub_start >= end:
                new_result.append([start, end])
                continue
            if sub_start > start:
                new_result.append([start, sub_start])
            if sub_end < end:
                new_result.append([sub_end, end])
        result = new_result
    return _merge_intervals(result)


def _merge_intervals(intervals):
    intervals = sorted(intervals)
    merged = []
    for start, end in intervals:
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return [
        interval for interval in merged if interval[1] > interval[0]
    ]


def _to_minutes(t):
    return t.hour * 60 + t.minute


def _to_time(minutes):
    return (datetime(2000, 1, 1) + timedelta(minutes=minutes)).time()