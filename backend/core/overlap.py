"""Choque de horarios del socio: única fuente de verdad.

Actividades, salidas y PT ocupan el mismo tiempo del mismo socio: nadie
puede estar en el gimnasio y en una clase a las 9. Cada app llevaba su
propia copia de la comprobación y las copias se desfasaron: las salidas
no tenían ninguna (ADD-16, Fase K2), así que el socio quedaba anotado en
dos cosas a la misma hora.

Este módulo hace la comprobación una sola vez y devuelve un código de
conflicto; cada app lo traduce a su propio texto (los de gimnasio se
pueden personalizar por gym en ``gyms/labels.py``).
"""

from datetime import datetime, timedelta

from core.times import slot_end

CONFLICT_GYM_SCHEDULE = "gym_schedule"
CONFLICT_ACTIVITY = "activity"
CONFLICT_OUTING = "outing"
CONFLICT_PT = "personal_training"


class SlotConflict(ValueError):
    """El socio ya tiene algo anotado en ese horario.

    ``code`` es uno de los ``CONFLICT_*`` y ``detail`` trae el dato
    concreto del choque (nombre de la actividad, de la salida, etc.).
    """

    def __init__(self, code, detail=""):
        self.code = code
        self.detail = detail
        super().__init__(code)


def check_member_slot(member, day, start_time, end_time, exclude=None):
    """Revisa que el socio no tenga nada anotado en ese horario.

    Args:
        member: el Member.
        day: str del día ("monday", ...).
        start_time/end_time: objetos ``time``.
        exclude: dict opcional con la clave de cada tipo y el pk a ignorar
            ("activity": pk del ActivitySchedule, "outing": pk del
            OutingSchedule, "personal_training": pk de la asignación).
            Sirve para no chocar consigo mismo al revalidar.

    Raises:
        SlotConflict: con el código del tipo de choque.
    """
    exclude = exclude or {}
    gym = _resolve_gym(member)
    _check_gym_schedule(member, day, start_time, end_time)
    _check_activity(
        member, gym, day, start_time, end_time, exclude.get("activity")
    )
    _check_outing(
        member, gym, day, start_time, end_time, exclude.get("outing")
    )
    _check_pt(
        member, gym, day, start_time, end_time, exclude.get("personal_training")
    )


def _resolve_gym(member):
    """Gimnasio del socio: el de su suscripción activa, o el de su ficha.

    Mismo criterio que usaban los validadores por app antes de este
    módulo: las inscripciones se filtran por gimnasio.
    """
    from subscriptions.domain import SubscriptionDomain

    return SubscriptionDomain.resolve_gym(member)


def _check_gym_schedule(member, day, start_time, end_time):
    from attendance.models import AttendanceSchedule

    active_gym_schedules = AttendanceSchedule.objects.filter(
        member=member, active=True
    ).select_related("slot")

    for gs in active_gym_schedules:
        if gs.slot.day != day:
            continue
        gym_start = gs.slot.hour
        # ADD-05: el bloque del gym tiene duración real, no siempre 1 hora.
        gym_end = slot_end(gs.slot)
        if times_overlap(gym_start, gym_end, start_time, end_time):
            raise SlotConflict(
                CONFLICT_GYM_SCHEDULE,
                f"{gs.slot.get_day_display()} {gs.slot.hour:%H:%M}",
            )


def _check_activity(
    member, gym, day, start_time, end_time, exclude_schedule_id=None
):
    from activities.models import Enrollment

    overlapping = Enrollment.objects.filter(
        gym=gym,
        member=member,
        active=True,
        schedule__day=day,
    ).select_related("schedule", "schedule__activity")

    for enrollment in overlapping:
        if (
            exclude_schedule_id is not None
            and enrollment.schedule_id == exclude_schedule_id
        ):
            continue
        existing = enrollment.schedule
        if times_overlap(
            existing.start_time, existing.end_time, start_time, end_time
        ):
            raise SlotConflict(
                CONFLICT_ACTIVITY, existing.activity.name
            )


def _check_outing(
    member, gym, day, start_time, end_time, exclude_schedule_id=None
):
    from outings.models import OutingEnrollment

    overlapping = OutingEnrollment.objects.filter(
        gym=gym,
        member=member,
        active=True,
        schedule__day=day,
    ).select_related("schedule", "schedule__outing")

    for enrollment in overlapping:
        if (
            exclude_schedule_id is not None
            and enrollment.schedule_id == exclude_schedule_id
        ):
            continue
        existing = enrollment.schedule
        if times_overlap(
            existing.start_time, existing.end_time, start_time, end_time
        ):
            raise SlotConflict(CONFLICT_OUTING, existing.outing.name)


def _check_pt(
    member, gym, day, start_time, end_time, exclude_assignment_id=None
):
    from personal_training.models import PersonalTrainingAssignment

    overlapping = PersonalTrainingAssignment.objects.filter(
        gym=gym, member=member, active=True, day=day
    ).select_related("service")

    for assignment in overlapping:
        if (
            exclude_assignment_id is not None
            and assignment.pk == exclude_assignment_id
        ):
            continue
        if times_overlap(
            assignment.start_time, assignment.end_time, start_time, end_time
        ):
            raise SlotConflict(
                CONFLICT_PT, assignment.service.name
            )


def times_overlap(start_a, end_a, start_b, end_b):
    return start_a < end_b and start_b < end_a


def add_hour(t):
    dt = datetime.combine(datetime.today(), t) + timedelta(hours=1)
    return dt.time()

