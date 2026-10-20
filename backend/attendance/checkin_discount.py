"""Descuento automático de sesiones de paquete al registrar asistencia.

ACC-08 (Fase G): el check-in sólo conoce el día, no a qué clase fue el socio.
La regla aprobada es descontar sólo cuando la asistencia es inequívoca:

- una sola inscripción de paquete activa ese día → se descuenta aunque el
  socio haya entrado fuera de la ventana horaria (entrenó, se cobra);
- varias → se descuentan sólo las que caen en su ventana horaria;
- ninguna en ventana → no se descuenta (evita descontar la clase equivocada).

``now_dt=None`` (staff que registra sin hora) se trata como "sin ventana":
sólo se descuenta el caso inequívoco de una sola inscripción.

Vive en su propio módulo para que tanto ``public_views`` como ``serializers``
lo usen sin importarse mutuamente.
"""

DAY_BY_WEEKDAY = {
    0: "monday",
    1: "tuesday",
    2: "wednesday",
    3: "thursday",
    4: "friday",
    5: "saturday",
    6: "sunday",
}


def _discount_candidates(candidates, now_time):
    """Devuelve las inscripciones a descontar según la regla de ACC-08.

    ``candidates`` es una lista de ``(enrollment, schedule)``.
    """
    if not candidates:
        return []

    if len(candidates) == 1:
        return [candidates[0][0]]

    if now_time is None:
        return []

    return [
        enrollment
        for enrollment, schedule in candidates
        if schedule.start_time <= now_time <= schedule.end_time
    ]


def _activity_candidates(member, gym, day):
    from activities.models import Enrollment

    enrollments = Enrollment.objects.filter(
        gym=gym,
        member=member,
        active=True,
        modality="package",
        schedule__day=day,
        schedule__active=True,
        schedule__activity__active=True,
    ).select_related("schedule")
    return [(e, e.schedule) for e in enrollments]


def _outing_candidates(member, gym, day):
    from outings.models import OutingEnrollment

    enrollments = OutingEnrollment.objects.filter(
        gym=gym,
        member=member,
        active=True,
        modality="package",
        schedule__day=day,
        schedule__active=True,
        schedule__outing__active=True,
    ).select_related("schedule")
    return [(e, e.schedule) for e in enrollments]


def count_activity_sessions(member, gym, now_dt, today):
    """Descuenta las sesiones de actividad inequívocas del día (ACC-08)."""
    from activities.session_service import SessionService

    day = DAY_BY_WEEKDAY[today.weekday()]
    now_time = now_dt.time() if now_dt is not None else None
    for enrollment in _discount_candidates(
        _activity_candidates(member, gym, day), now_time
    ):
        SessionService.record_auto(enrollment, today)


def count_outing_sessions(member, gym, now_dt, today):
    """Descuenta las sesiones de salida inequívocas del día (ACC-08)."""
    from outings.session_service import SessionService

    day = DAY_BY_WEEKDAY[today.weekday()]
    now_time = now_dt.time() if now_dt is not None else None
    for enrollment in _discount_candidates(
        _outing_candidates(member, gym, day), now_time
    ):
        SessionService.record_auto(enrollment, today)
