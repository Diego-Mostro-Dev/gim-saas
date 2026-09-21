"""Deducción automática de sesiones de paquete no asistidas.

La tarea programada recorre los paquetes de actividades y de entrenamiento
personal de todos los gyms activos y, para cada fecha de clase pasada (nunca
hoy) sin registro de sesión, crea un ``*SessionRecord`` con
``source="no_show"``. Así una falta consume 1 sesión del paquete aunque nunca
se haya escaneado el QR ni el staff haya registrado la asistencia.

Reglas:
- Solo fechas estrictamente anteriores a hoy (la clase de hoy nunca se
  descuenta antes de terminar; la tarea corre cada ~6h).
- Se saltea días en que el gym estuvo cerrado (``GymClosedDate``).
- Idempotente: no crea registro si ya existe una sesión para esa fecha
  (asistida, manual, recuperación o no_show previa).
- Cap: nunca supera el total del paquete (evita "sesiones restantes"
  negativas).
- Recuperaciones pendientes de una actividad cubren las faltas más recientes:
  no se descuentan las últimas N faltas que ya tienen un recupero en vuelo
  (``status="scheduled"``), de modo que "falta + recuperación" cuesta 1 sesión.
- Avanza el watermark ``no_show_scan_until`` para no reprocesar: las
  correcciones manuales del staff ("Quitar") no se vuelven a descontar.
"""

from datetime import timedelta

from django.utils import timezone

from gyms.models import Gym, GymClosedDate

DAY_INDEX = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}


def _pending_recovery_credits(member, activity):
    """Recuperaciones de actividad en vuelo (programadas para el futuro).

    Una recuperación programada todavía no consumida cubre la falta más
    reciente de esa actividad: esas faltas no se descuentan como no_show.
    Las vencidas (``used_date`` ya pasó y no se usaron) no cubren nada.
    """
    from attendance.models import SessionRecovery

    today = timezone.localdate()
    return SessionRecovery.objects.filter(
        member=member,
        activity=activity,
        kind="activity",
        status="scheduled",
        used_date__gte=today,
    ).count()


def _deduct_activity_enrollment(enrollment, start, end, closed):
    total = enrollment.package_total_sessions
    if total is None:
        return 0

    existing = set(
        enrollment.session_records.filter(date__range=(start, end)).values_list(
            "date", flat=True
        )
    )
    day_index = DAY_INDEX[enrollment.schedule.day]

    missed = []
    d = start
    while d <= end:
        if d.weekday() == day_index and d not in closed and d not in existing:
            missed.append(d)
        d += timedelta(days=1)

    if not missed:
        return 0

    used = enrollment.session_records.count()
    remaining = max(0, total - used)
    if remaining <= 0:
        return 0

    credits = _pending_recovery_credits(
        enrollment.member, enrollment.schedule.activity_id
    )
    if credits:
        missed = missed[:-credits]

    created = 0
    for date_ in missed[:remaining]:
        from .models import ActivitySessionRecord

        ActivitySessionRecord.objects.create(
            gym=enrollment.gym,
            member=enrollment.member,
            enrollment=enrollment,
            schedule=enrollment.schedule,
            date=date_,
            source="no_show",
        )
        created += 1
    return created


def _deduct_pt_assignment(assignment, start, end, closed):
    total = assignment.package_total_sessions
    if total is None:
        return 0

    existing = set(
        assignment.session_records.filter(date__range=(start, end)).values_list(
            "date", flat=True
        )
    )
    day_index = DAY_INDEX[assignment.day]

    missed = []
    d = start
    while d <= end:
        if d.weekday() == day_index and d not in closed and d not in existing:
            missed.append(d)
        d += timedelta(days=1)

    if not missed:
        return 0

    used = assignment.session_records.count()
    remaining = max(0, total - used)
    if remaining <= 0:
        return 0

    created = 0
    for date_ in missed[:remaining]:
        from personal_training.models import PersonalTrainingSessionRecord

        PersonalTrainingSessionRecord.objects.create(
            gym=assignment.gym,
            member=assignment.member,
            assignment=assignment,
            date=date_,
            source="no_show",
        )
        created += 1
    return created


def deduct_missed_activity_enrollments(gym):
    """Crea los registros ``no_show`` pendientes de los paquetes de un gym."""
    from .models import Enrollment

    today = timezone.localdate()
    end = today - timedelta(days=1)
    closed = set(
        GymClosedDate.objects.filter(gym=gym, date__lte=end).values_list(
            "date", flat=True
        )
    )

    qs = Enrollment.objects.filter(
        gym=gym,
        active=True,
        modality="package",
        schedule__active=True,
        schedule__activity__active=True,
    ).select_related("schedule")

    enrollments = 0
    records_created = 0
    for enrollment in qs:
        floor = max(
            enrollment.enrolled_at.date(), enrollment.schedule.created_at.date()
        )
        start = enrollment.no_show_scan_until
        if start is None:
            start = floor
        else:
            start = start + timedelta(days=1)
        if start > end:
            continue

        records_created += _deduct_activity_enrollment(
            enrollment, start, end, closed
        )
        enrollment.no_show_scan_until = end
        enrollment.save(update_fields=["no_show_scan_until"])
        enrollments += 1

    return {"enrollments": enrollments, "records_created": records_created}


def deduct_missed_pt_assignments(gym):
    """Crea los registros ``no_show`` pendientes de los paquetes de PT."""
    from personal_training.models import PersonalTrainingAssignment

    today = timezone.localdate()
    end = today - timedelta(days=1)
    closed = set(
        GymClosedDate.objects.filter(gym=gym, date__lte=end).values_list(
            "date", flat=True
        )
    )

    qs = PersonalTrainingAssignment.objects.filter(
        gym=gym,
        active=True,
        modality="package",
        service__active=True,
    )

    assignments = 0
    records_created = 0
    for assignment in qs:
        floor = assignment.created_at.date()
        start = assignment.no_show_scan_until
        if start is None:
            start = floor
        else:
            start = start + timedelta(days=1)
        if start > end:
            continue

        records_created += _deduct_pt_assignment(assignment, start, end, closed)
        assignment.no_show_scan_until = end
        assignment.save(update_fields=["no_show_scan_until"])
        assignments += 1

    return {"assignments": assignments, "records_created": records_created}


def deduct_missed_sessions():
    """Recorre todos los gyms activos y descuenta las no asistencias."""
    total = {
        "enrollments": 0,
        "enrollment_records_created": 0,
        "assignments": 0,
        "assignment_records_created": 0,
    }

    for gym in Gym.objects.filter(active=True):
        activity = deduct_missed_activity_enrollments(gym)
        pt = deduct_missed_pt_assignments(gym)
        total["enrollments"] += activity["enrollments"]
        total["enrollment_records_created"] += activity["records_created"]
        total["assignments"] += pt["assignments"]
        total["assignment_records_created"] += pt["records_created"]

    return total


def cancel_recovered_no_show(member, activity):
    """Anula la falta más reciente de una actividad al otorgarle recuperación.

    "Falta + recuperación" debe costar 1 sesión: el recupero descontará 1
    cuando se use (``source="recovery"`` en la fecha del recupero), de modo
    que la no_show de esa falta se elimina aquí para no cobrarla dos veces.
    """
    from .models import ActivitySessionRecord

    newest = (
        ActivitySessionRecord.objects.filter(
            member=member,
            enrollment__schedule__activity=activity,
            source="no_show",
        )
        .order_by("-date", "-created_at")
        .first()
    )
    if newest is None:
        return 0
    newest.delete()
    return 1