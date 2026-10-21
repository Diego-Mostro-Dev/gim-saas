"""Choque de horarios para las salidas grupales (ADD-16, Fase K2).

Las salidas no validaban nada: el socio se anotaba en una salida a las 9
y en una actividad (o en el gimnasio, o en el entrenamiento personal) a
las 9 sin que nadie se enterara. La comprobación vive en
``core/overlap.py``, que es la fuente única para actividades, salidas y
PT; acá sólo se traduce el código de conflicto al texto del módulo.
"""

from core.overlap import (
    CONFLICT_ACTIVITY,
    CONFLICT_GYM_SCHEDULE,
    CONFLICT_OUTING,
    CONFLICT_PT,
    SlotConflict,
    check_member_slot,
)
from gyms.labels import msg


def validate_enrollment(member, schedule):
    """Revisa que el horario de la salida no choque con la agenda del socio.

    Args:
        member: el Member.
        schedule: el OutingSchedule destino.

    Raises:
        ValueError: con un mensaje legible si hay choque.
    """
    try:
        check_member_slot(
            member,
            schedule.day,
            schedule.start_time,
            schedule.end_time,
            exclude={"outing": schedule.pk},
        )
    except SlotConflict as conflict:
        raise ValueError(_conflict_message(conflict, schedule))


def _conflict_message(conflict, schedule):
    gym = schedule.outing.service.gym

    if conflict.code == CONFLICT_GYM_SCHEDULE:
        return msg(gym, "errors.fixed_schedule_overlap")
    if conflict.code == CONFLICT_ACTIVITY:
        return (
            "El miembro ya está inscripto en una actividad cuyo horario "
            "se superpone con esta salida."
        )
    if conflict.code == CONFLICT_OUTING:
        return (
            "El miembro ya está inscripto en una salida cuyo horario "
            "se superpone con esta salida."
        )
    if conflict.code == CONFLICT_PT:
        return (
            "El miembro tiene un entrenamiento personal cuyo horario "
            "se superpone con esta salida."
        )
    return "El horario se superpone con otro compromiso del miembro."
