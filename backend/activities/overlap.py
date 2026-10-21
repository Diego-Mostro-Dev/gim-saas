from core.overlap import (
    CONFLICT_ACTIVITY,
    CONFLICT_GYM_SCHEDULE,
    CONFLICT_OUTING,
    CONFLICT_PT,
    SlotConflict,
    check_member_slot,
)
from core.times import slot_end
from gyms.labels import msg


def validate_enrollment(member, schedule):
    """Revisa que el horario no choque con nada de la agenda del socio.

    El choque se valida contra las cuatro fuentes: el horario fijo del
    gimnasio, las actividades, las salidas y el entrenamiento personal.
    Las salidas se agregaron en la Fase K2 (ADD-16): sin esa dimensión el
    socio podía quedar anotado en una salida y en una actividad a la misma
    hora.
    """
    try:
        check_member_slot(
            member,
            schedule.day,
            schedule.start_time,
            schedule.end_time,
            exclude={"activity": schedule.pk},
        )
    except SlotConflict as conflict:
        raise ValueError(_conflict_message(conflict, schedule))


def _conflict_message(conflict, schedule):
    gym = schedule.activity.service.gym

    if conflict.code == CONFLICT_GYM_SCHEDULE:
        return msg(gym, "errors.fixed_schedule_overlap")
    if conflict.code == CONFLICT_ACTIVITY:
        return (
            "El miembro ya está inscripto en una actividad cuyo horario "
            "se superpone con esta actividad."
        )
    if conflict.code == CONFLICT_OUTING:
        return (
            "El miembro ya está inscripto en una salida cuyo horario "
            "se superpone con esta actividad."
        )
    if conflict.code == CONFLICT_PT:
        return (
            "El miembro tiene un entrenamiento personal cuyo horario "
            "se superpone con esta actividad."
        )
    return "El horario se superpone con otro compromiso del miembro."


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
        # ADD-05: duración real del bloque del gym.
        gym_end = slot_end(slot)
        for schedule in activity_schedules:
            if slot.day != schedule.day:
                continue
            if _times_overlap(
                gym_start, gym_end,
                schedule.start_time, schedule.end_time,
            ):
                gym = gym_slots[0].gym
                raise ValueError(
                    msg(gym, "errors.gym_schedule_overlap_detailed").format(
                        day=slot.get_day_display(),
                        time=f"{gym_start:%H:%M}",
                        activity=schedule.activity.name,
                        schedule=(
                            f"{schedule.start_time:%H:%M}–"
                            f"{schedule.end_time:%H:%M}"
                        ),
                    )
                )


def _times_overlap(start_a, end_a, start_b, end_b):
    return start_a < end_b and start_b < end_a


