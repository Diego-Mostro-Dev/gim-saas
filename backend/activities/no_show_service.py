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
- ADD-27: cada recuperación cubre **exactamente una** falta. Al otorgarla se
  anota qué falta perdona (``forgiven_date`` + inscripción/asignación) y el
  crédito deja de cubrir faltas nuevas: sin ese vínculo, una recuperación
  perdonaba dos faltas (la que borraba al otorgarse y la que el barrido
 protegía después).
- Avanza el watermark ``no_show_scan_until`` para no reprocesar: las
  correcciones manuales del staff ("Quitar") no se vuelven a descontar.
"""

from datetime import timedelta

from django.db import transaction
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


def _bind_recovery(recovery, *, enrollment=None, assignment=None, date_=None):
    """Anota a qué falta concreta cubre la recuperación (ADD-27)."""
    recovery.forgiven_enrollment = enrollment
    recovery.forgiven_assignment = assignment
    recovery.forgiven_date = date_
    recovery.save(
        update_fields=[
            "forgiven_enrollment",
            "forgiven_assignment",
            "forgiven_date",
            "updated_at",
        ]
    )


def _forgiven_dates(**filters):
    """Fechas de las faltas que ya cubre una recuperación."""
    from attendance.models import SessionRecovery

    return set(
        SessionRecovery.objects.filter(
            forgiven_date__isnull=False, **filters
        ).values_list("forgiven_date", flat=True)
    )


def _pending_recovery_credits(member, activity):
    """Recuperaciones de actividad en vuelo (programadas para el futuro).

    Una recuperación programada todavía no consumida cubre la falta más
    reciente de esa actividad: esas faltas no se descuentan como no_show.
    Las vencidas (``used_date`` ya pasó y no se usaron) no cubren nada.

    ADD-27: las que ya perdonaron una falta concreta quedan fuera: un
    recupero cubre **una** falta, no una por cada barrido.
    """
    from attendance.models import SessionRecovery

    today = timezone.localdate()
    return SessionRecovery.objects.filter(
        member=member,
        activity=activity,
        kind="activity",
        status="scheduled",
        used_date__gte=today,
        forgiven_date__isnull=True,
    ).count()


def _bind_pending_recoveries(member, activity, enrollment, dates):
    """Enlaza las recuperaciones en vuelo con las faltas que perdonan."""
    from attendance.models import SessionRecovery

    if not dates:
        return
    today = timezone.localdate()
    recoveries = list(
        SessionRecovery.objects.filter(
            member=member,
            activity=activity,
            kind="activity",
            status="scheduled",
            used_date__gte=today,
            forgiven_date__isnull=True,
        ).order_by("created_at")[: len(dates)]
    )
    for recovery, date_ in zip(recoveries, dates):
        _bind_recovery(recovery, enrollment=enrollment, date_=date_)


def _pending_pt_recovery_credits(member, assignment):
    """Recuperaciones de PT en vuelo (programadas para el futuro).

    Espeja ``_pending_recovery_credits`` para actividades: ADD-21, una
    recuperación de PT cubre la falta más reciente para que "falta +
    recuperación" cueste 1 sesión.
    """
    from attendance.models import SessionRecovery

    today = timezone.localdate()
    return SessionRecovery.objects.filter(
        member=member,
        pt_assignment=assignment,
        kind="pt",
        status="scheduled",
        used_date__gte=today,
        forgiven_date__isnull=True,
    ).count()


def _bind_pending_pt_recoveries(assignment, dates):
    """Enlaza las recuperaciones de PT en vuelo con las faltas que perdonan."""
    from attendance.models import SessionRecovery

    if not dates:
        return
    today = timezone.localdate()
    recoveries = list(
        SessionRecovery.objects.filter(
            member=assignment.member,
            pt_assignment=assignment,
            kind="pt",
            status="scheduled",
            used_date__gte=today,
            forgiven_date__isnull=True,
        ).order_by("created_at")[: len(dates)]
    )
    for recovery, date_ in zip(recoveries, dates):
        _bind_recovery(recovery, assignment=assignment, date_=date_)


def _deduct_activity_enrollment(enrollment, start, end, closed):
    """Descuenta las faltas de una inscripción.

    Devuelve ``(created, last_charged, pending)``:
    - ``created``: cuántos registros ``no_show`` se crearon.
    - ``last_charged``: la última fecha cobrada (``None`` si no se cobró
      ninguna).
    - ``pending``: quedan faltas sin cobrar (el paquete está agotado o el
      tope truncó la lista). ADD-29: si quedan pendientes, el watermark no
      puede avanzar más allá de la última cobrada, o esas faltas se pierden
      para siempre.
    """
    total = enrollment.package_total_sessions
    if total is None:
        return 0, None, False

    existing = set(
        enrollment.session_records.filter(date__range=(start, end)).values_list(
            "date", flat=True
        )
    )
    # ADD-27: las faltas que una recuperación ya perdonó no se vuelven a
    # descontar (el registro se borró al perdonarse).
    forgiven = _forgiven_dates(forgiven_enrollment=enrollment)
    day_index = DAY_INDEX[enrollment.schedule.day]

    missed = []
    d = start
    while d <= end:
        if (
            d.weekday() == day_index
            and d not in closed
            and d not in existing
            and d not in forgiven
        ):
            missed.append(d)
        d += timedelta(days=1)

    if not missed:
        return 0, None, False

    used = enrollment.session_records.count()
    remaining = max(0, total - used)
    if remaining <= 0:
        # ADD-29: el paquete está agotado. La falta no se cobra ahora, pero
        # tampoco se pierde: queda pendiente hasta que el staff agregue
        # sesiones.
        return 0, None, True

    credits = _pending_recovery_credits(
        enrollment.member, enrollment.schedule.activity_id
    )
    if credits and missed:
        forgiven_dates = missed[-credits:]
        missed = missed[:-credits]
        # ADD-27: la recuperación queda atada a la falta que perdona, así
        # no vuelve a cubrir otra en el próximo barrido.
        _bind_pending_recoveries(
            enrollment.member,
            enrollment.schedule.activity_id,
            enrollment,
            forgiven_dates,
        )

    created = 0
    last_charged = None
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
        last_charged = date_

    # ADD-29: si sobraron faltas, el tope truncó la lista y quedan
    # pendientes para la próxima vuelta.
    pending = len(missed) > remaining
    return created, last_charged, pending


def _deduct_pt_assignment(assignment, start, end, closed):
    """Descuenta las faltas de una asignación de PT.

    Espeja ``_deduct_activity_enrollment`` (mismo retorno y misma regla del
    watermark: ADD-29).
    """
    total = assignment.package_total_sessions
    if total is None:
        return 0, None, False

    existing = set(
        assignment.session_records.filter(date__range=(start, end)).values_list(
            "date", flat=True
        )
    )
    # ADD-27: igual que en actividades, la falta perdonada no se vuelve a
    # descontar.
    forgiven = _forgiven_dates(forgiven_assignment=assignment)
    day_index = DAY_INDEX[assignment.day]

    missed = []
    d = start
    while d <= end:
        if (
            d.weekday() == day_index
            and d not in closed
            and d not in existing
            and d not in forgiven
        ):
            missed.append(d)
        d += timedelta(days=1)

    if not missed:
        return 0, None, False

    used = assignment.session_records.count()
    remaining = max(0, total - used)
    if remaining <= 0:
        # ADD-29: la falta queda pendiente, no se pierde.
        return 0, None, True

    credits = _pending_pt_recovery_credits(assignment.member, assignment)
    if credits and missed:
        forgiven_dates = missed[-credits:]
        missed = missed[:-credits]
        # ADD-27: la recuperación queda atada a la falta que perdona.
        _bind_pending_pt_recoveries(assignment, forgiven_dates)

    created = 0
    last_charged = None
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
        last_charged = date_

    # ADD-29: las faltas que no entraron en el paquete quedan pendientes.
    pending = len(missed) > remaining
    return created, last_charged, pending


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
            # ADD-07: el watermark se clampea contra el floor. Un watermark
            # viejo (avanzado antes de que el horario existiera) no puede
            # hacer que se descuenten fechas sin clase dictada.
            start = max(floor, start + timedelta(days=1))
        if start > end:
            continue

        created, last_charged, pending = _deduct_activity_enrollment(
            enrollment, start, end, closed
        )
        records_created += created
        # ADD-29: con faltas pendientes el watermark no puede pasar de la
        # última cobrada: si avanzara, esas faltas se perderían para
        # siempre (el socio las usaría sin que nadie las cobrara).
        new_watermark = last_charged if pending else end
        if new_watermark is not None and (
            enrollment.no_show_scan_until is None
            or new_watermark > enrollment.no_show_scan_until
        ):
            enrollment.no_show_scan_until = new_watermark
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
            # ADD-07: mismo clamp que en actividades.
            start = max(floor, start + timedelta(days=1))
        if start > end:
            continue

        created, last_charged, pending = _deduct_pt_assignment(
            assignment, start, end, closed
        )
        records_created += created
        # ADD-29: mismo criterio que en actividades.
        new_watermark = last_charged if pending else end
        if new_watermark is not None and (
            assignment.no_show_scan_until is None
            or new_watermark > assignment.no_show_scan_until
        ):
            assignment.no_show_scan_until = new_watermark
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
        # Fase 4: cada gym dentro de su propio atomic(). La escritura avanza
        # un watermark por enrollment (no_show_scan_until) y es idempotente,
        # así el daño de un timeout queda acotado a los gyms ya procesados.
        with transaction.atomic():
            activity = deduct_missed_activity_enrollments(gym)
            pt = deduct_missed_pt_assignments(gym)
        total["enrollments"] += activity["enrollments"]
        total["enrollment_records_created"] += activity["records_created"]
        total["assignments"] += pt["assignments"]
        total["assignment_records_created"] += pt["records_created"]

    return total


def cancel_recovered_no_show(member, activity, recovery=None):
    """Anula la falta más reciente de una actividad al otorgarle recuperación.

    "Falta + recuperación" debe costar 1 sesión: el recupero descontará 1
    cuando se use (``source="recovery"`` en la fecha del recupero), de modo
    que la no_show de esa falta se elimina aquí para no cobrarla dos veces.

    ADD-27: si se pasa la ``recovery``, queda anotada a qué falta concreta
    perdona (inscripción + fecha), para que no cubra otra en el próximo
    barrido del cron.
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
    enrollment = newest.enrollment
    forgiven_date = newest.date
    newest.delete()
    if recovery is not None:
        _bind_recovery(recovery, enrollment=enrollment, date_=forgiven_date)
    return 1


def cancel_recovered_no_show_pt(member, assignment, recovery=None):
    """Anula la falta más reciente de una asignación de PT al otorgarle recuperación.

    Espeja ``cancel_recovered_no_show`` (ADD-21): "falta + recuperación" debe
    costar 1 sesión; el recupero descontará 1 cuando se use
    (``source="recovery"``), así que la no_show de esa falta se elimina aquí.

    ADD-27: igual que en actividades, la recuperación queda atada a la falta
    que perdona.
    """
    from personal_training.models import PersonalTrainingSessionRecord

    newest = (
        PersonalTrainingSessionRecord.objects.filter(
            member=member,
            assignment=assignment,
            source="no_show",
        )
        .order_by("-date", "-created_at")
        .first()
    )
    if newest is None:
        return 0
    forgiven_date = newest.date
    newest.delete()
    if recovery is not None:
        _bind_recovery(recovery, assignment=assignment, date_=forgiven_date)
    return 1
