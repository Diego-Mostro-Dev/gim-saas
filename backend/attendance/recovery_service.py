"""Lógica de negocio de la recuperación de clases / sesiones.

Reglas:
- El gym debe tener la feature activa (``allow_session_recovery``) para otorgar.
- Tope mensual: recuperaciones otorgadas en el mes calendario (opción A).
  Usar o no usar no libera cupo mensual.
- El staff programa la recuperación para un día y horario exactos creándola
  con estado ``scheduled`` (``grant_scheduled``). No se crea asistencia ni se
  descuenta sesión en ese momento.
- La recuperación se consume cuando el socio escanea su QR el día programado
  (``use_recovery``): training crea la Attendance ``is_recovery=True``;
  activity con paquete descuenta 1 sesión (ActivitySessionRecord).
- Si el socio no escanea el día programado, la recuperación vence: el estado
  efectivo pasa a ``expired`` de forma perezosa (``effective_status``).
- ``undo_recovery`` permite deshacer una recuperación usada y borrar la
  asistencia/sesión creada.
- ``kind=training``: recupera un horario del gym (ScheduleSlot) ese día.
- ``kind=activity``: recupera una clase de la misma actividad. Los horarios
  donde el socio ya está inscripto quedan excluidos; si no existen
  alternativas con cupo y sin colisión, se permite el propio (fallback).
  Si el socio tiene un paquete activo, se crea ActivitySessionRecord
  (source="recovery") que descuenta 1 sesión del paquete.
"""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .models import Attendance, AttendanceSchedule, ScheduleSlot, SessionRecovery
from .utils import compute_effective_occupancy, has_effective_capacity
from activities.models import ActivitySchedule, Enrollment
from activities.session_service import SessionService, SessionError
from gyms.models import GymClosedDate
from members.eligibility import MemberEligibility
from subscriptions.domain import SubscriptionDomain


DAY_BY_WEEKDAY = {
    0: "monday",
    1: "tuesday",
    2: "wednesday",
    3: "thursday",
    4: "friday",
    5: "saturday",
    6: "sunday",
}


class RecoveryError(Exception):
    """Error de negocio de la recuperación de clases."""


def effective_status(recovery):
    """Estado efectivo: marca 'expired' perezosamente cuando venció."""
    today = timezone.localdate()
    if recovery.status == "scheduled" and recovery.used_date and recovery.used_date < today:
        return "expired"
    if recovery.status == "available" and recovery.expires_at < today:
        return "expired"
    return recovery.status


def _assert_usable(recovery, target_date):
    if effective_status(recovery) in ("expired", "cancelled"):
        raise RecoveryError("La recuperación ya no está disponible.")
    if recovery.status not in ("scheduled", "available"):
        raise RecoveryError(
            "La recuperación ya no está disponible."
        )
    if target_date < timezone.localdate():
        raise RecoveryError("La fecha de uso no puede ser anterior a hoy.")
    if recovery.status == "scheduled":
        if recovery.used_date != target_date:
            raise RecoveryError(
                "La recuperación debe usarse el día en que fue programada."
            )
    elif recovery.expires_at is not None and target_date > recovery.expires_at:
        raise RecoveryError("La recuperación vence antes de esa fecha.")

    if not MemberEligibility.can_operate(recovery.member):
        raise RecoveryError(
            "Acceso suspendido por falta de pago del socio."
        )

    has_attendance = Attendance.objects.filter(
        member=recovery.member,
        date=target_date,
    ).exists()
    has_used_recovery = SessionRecovery.objects.filter(
        member=recovery.member,
        used_date=target_date,
        status="used",
    ).exists()
    if has_attendance or has_used_recovery:
        raise RecoveryError(
            "El socio ya tiene una asistencia registrada ese día. "
            "La recuperación es la asistencia del día."
        )


def _gym_slot_overlaps_activity(slot, member, day):
    """¿El horario del gym se superpone con alguna clase del socio ese día?"""
    gym = SubscriptionDomain.resolve_gym(member)
    conflicting = Enrollment.objects.filter(
        gym=gym,
        member=member,
        active=True,
        schedule__day=day,
        schedule__active=True,
        schedule__activity__active=True,
    ).select_related("schedule")
    for enrollment in conflicting:
        sched = enrollment.schedule
        if _times_overlap(
            slot.hour, _add_hour(slot.hour),
            sched.start_time, sched.end_time,
        ):
            return True
    return False


def _activity_overlaps_member(member, gym, schedule):
    """¿La clase elegida choca con horarios de gym u otras clases del socio?"""
    start, end = schedule.start_time, schedule.end_time

    gym_schedules = AttendanceSchedule.objects.filter(
        member=member,
        active=True,
        slot__day=schedule.day,
    ).select_related("slot")
    for gs in gym_schedules:
        if _times_overlap(gs.slot.hour, _add_hour(gs.slot.hour), start, end):
            return True

    others = Enrollment.objects.filter(
        gym=gym,
        member=member,
        active=True,
        schedule__day=schedule.day,
    ).exclude(schedule=schedule).select_related("schedule")
    for enrollment in others:
        other = enrollment.schedule
        if _times_overlap(other.start_time, other.end_time, start, end):
            return True

    return False


def _add_hour(t):
    from datetime import datetime
    return (datetime.combine(datetime(2000, 1, 1), t) + timedelta(hours=1)).time()


def _times_overlap(start_a, end_a, start_b, end_b):
    return start_a < end_b and start_b < end_a


def _validate_plan_date(gym, member, target_date):
    """Precondiciones compartidas para programar el uso en una fecha."""
    if not MemberEligibility.can_operate(member):
        raise RecoveryError("Acceso suspendido por falta de pago del socio.")

    if GymClosedDate.objects.filter(gym=gym, date=target_date).exists():
        raise RecoveryError("El gimnasio está cerrado esa fecha.")

    if Attendance.objects.filter(
        member=member,
        date=target_date,
    ).exists():
        raise RecoveryError(
            "El socio ya tiene una asistencia registrada ese día. "
            "La recuperación es la asistencia del día."
        )

    if SessionRecovery.objects.filter(
        member=member,
        used_date=target_date,
        status__in=["scheduled", "used"],
    ).exists():
        raise RecoveryError(
            "El socio ya tiene una recuperación programada o usada ese día."
        )


def eligible_options(gym, member, kind, activity, target_date):
    """Opciones válidas para programar la recuperación de un socio en una fecha."""
    if kind not in ("training", "activity"):
        raise RecoveryError("Tipo de recuperación inválido.")

    if member.gym_id not in (gym.pk, None):
        raise RecoveryError("El socio no pertenece a este gimnasio.")

    if kind == "activity":
        if activity is None:
            raise RecoveryError(
                "Para recuperar una clase es necesario indicar la actividad."
            )
        if activity.service.gym_id != gym.pk:
            raise RecoveryError("La actividad no pertenece a este gimnasio.")

    _validate_plan_date(gym, member, target_date)
    day = DAY_BY_WEEKDAY[target_date.weekday()]

    if kind == "training":
        return _eligible_training_slots(gym, member, target_date, day)

    return _eligible_activity_schedules(gym, activity, member, target_date, day)


def _eligible_training_slots(gym, member, target_date, day):
    result = []
    slots = ScheduleSlot.objects.filter(
        gym=gym,
        day=day,
    ).order_by("hour")

    for slot in slots:
        if not has_effective_capacity(
            slot, gym, target_date, exclude_member=member
        ):
            continue
        if _gym_slot_overlaps_activity(slot, member, day):
            continue

        cap = slot.capacity or gym.default_schedule_capacity
        occ = compute_effective_occupancy(
            slot, target_date, exclude_member=member
        )
        result.append({
            "type": "slot",
            "slot_id": slot.id,
            "day": slot.day,
            "hour": slot.hour.strftime("%H:%M"),
            "capacity": cap,
            "occupancy": occ,
            "available": max(0, cap - occ) if cap is not None else None,
        })

    return result


def _eligible_activity_schedules(gym, activity, member, target_date, day):
    schedules = ActivitySchedule.objects.filter(
        activity=activity,
        day=day,
        active=True,
        activity__active=True,
    ).order_by("start_time")

    own_ids = set(
        Enrollment.objects.filter(
            gym=gym,
            member=member,
            active=True,
            schedule__activity=activity,
        ).values_list("schedule_id", flat=True)
    )

    candidates = []
    own_candidates = []
    for schedule in schedules:
        if _activity_overlaps_member(member, gym, schedule):
            continue

        enrollees = Enrollment.objects.filter(
            gym=gym,
            schedule=schedule,
            active=True,
        ).count()
        cap = schedule.capacity
        available = max(0, cap - enrollees) if cap is not None else None

        entry = {
            "type": "schedule",
            "schedule_id": schedule.id,
            "activity_id": activity.id,
            "activity_name": schedule.activity.name,
            "day": schedule.day,
            "start_time": schedule.start_time.strftime("%H:%M"),
            "end_time": schedule.end_time.strftime("%H:%M"),
            "capacity": cap,
            "occupancy": enrollees,
            "available": available,
            "is_own": schedule.id in own_ids,
        }

        if schedule.id in own_ids:
            own_candidates.append(entry)
        else:
            if cap is None or enrollees < cap:
                candidates.append(entry)

    # Regla Lidia: se excluye el horario propio mientras existan alternativas.
    # Fallback (caso Juan): si no hay alternativas, se permite el propio.
    if candidates:
        return candidates
    return own_candidates


@transaction.atomic
def use_recovery(recovery, target_date, slot=None, schedule=None, used_by=None):
    """Consume la recuperación en la fecha programada.

    Para ``kind=training`` crea la Attendance (``is_recovery=True``) en el
    horario programado. Para ``kind=activity`` con paquete descuenta 1 sesión
    del paquete (``ActivitySessionRecord`` source="recovery").
    """
    _assert_usable(recovery, target_date)

    if recovery.kind == "training":
        slot = slot or recovery.used_slot
        if slot is None:
            raise RecoveryError(
                "La recuperación no tiene un horario de entrenamiento programado."
            )
        if slot.gym_id != recovery.gym_id or slot.day != DAY_BY_WEEKDAY[target_date.weekday()]:
            raise RecoveryError("El horario seleccionado no es válido para esa fecha.")
        options = _eligible_training_slots(recovery.gym, recovery.member, target_date, slot.day)
        if not any(o["slot_id"] == slot.id for o in options):
            raise RecoveryError(
                "El horario programado ya no tiene cupo o colisiona con una clase del socio."
            )

        attendance = Attendance.objects.create(
            gym=recovery.gym,
            member=recovery.member,
            slot=slot,
            date=target_date,
            is_recovery=True,
            recovery=recovery,
        )

        recovery.status = "used"
        recovery.used_at = timezone.now()
        recovery.used_date = target_date
        recovery.used_slot = slot
        recovery.save(
            update_fields=["status", "used_at", "used_date", "used_slot", "updated_at"]
        )
        return recovery, attendance

    # kind == activity
    schedule = schedule or recovery.used_schedule
    if schedule is None:
        raise RecoveryError(
            "La recuperación no tiene una clase programada."
        )
    if schedule.activity_id != recovery.activity_id:
        raise RecoveryError("La clase no pertenece a la actividad de la recuperación.")

    options = _eligible_activity_schedules(
        recovery.gym, recovery.activity, recovery.member, target_date, schedule.day
    )
    if not any(o["schedule_id"] == schedule.id for o in options):
        raise RecoveryError(
            "La clase seleccionada ya no tiene cupo o colisiona con otra clase del socio."
        )

    enrollment = (
        Enrollment.objects.filter(
            gym=recovery.gym,
            member=recovery.member,
            schedule__activity=recovery.activity,
            active=True,
        )
        .select_related("schedule")
        .first()
    )
    if enrollment and enrollment.modality == "package" and not enrollment.exhausted:
        SessionService.record_session(
            enrollment, target_date, source="recovery", schedule=schedule
        )

    recovery.status = "used"
    recovery.used_at = timezone.now()
    recovery.used_date = target_date
    recovery.used_schedule = schedule
    recovery.save(
        update_fields=["status", "used_at", "used_date", "used_schedule", "updated_at"]
    )
    return recovery, None


@transaction.atomic
def grant_scheduled(gym, member, granted_by=None, kind="training", activity=None,
                    note="", target_date=None, slot=None, schedule=None):
    """Programa una recuperación para día y horario fijos (estado ``scheduled``).

    No crea asistencia ni descuenta sesión: la recuperación se consume cuando
    el socio escanea su QR el día programado (``use_recovery``). Si no la usa
    ese día, vence (estado efectivo ``expired``).
    """
    if not gym.allow_session_recovery:
        raise RecoveryError(
            "El gimnasio no tiene habilitada la recuperación de clases."
        )

    if target_date is None:
        raise RecoveryError(
            "Debes indicar la fecha en que el socio recupera la clase."
        )

    if kind not in ("training", "activity"):
        raise RecoveryError("Tipo de recuperación inválido.")

    if member.gym_id not in (gym.pk, None):
        raise RecoveryError("El socio no pertenece a este gimnasio.")

    if kind == "activity":
        if activity is None:
            raise RecoveryError(
                "Para recuperar una clase es necesario indicar la actividad."
            )
        if activity.service.gym_id != gym.pk:
            raise RecoveryError("La actividad no pertenece a este gimnasio.")

    today = timezone.localdate()
    month_start = today.replace(day=1)
    granted_this_month = SessionRecovery.objects.filter(
        gym=gym,
        member=member,
        created_at__date__gte=month_start,
    ).count()
    if granted_this_month >= gym.max_session_recoveries_per_month:
        raise RecoveryError(
            f"El socio ya alcanzó el límite de "
            f"{gym.max_session_recoveries_per_month} recuperaciones este mes."
        )

    options = eligible_options(gym, member, kind, activity, target_date)

    if kind == "training":
        if slot is None:
            raise RecoveryError(
                "Debes elegir el horario de entrenamiento para la recuperación."
            )
        if not any(o["slot_id"] == slot.id for o in options):
            raise RecoveryError(
                "El horario seleccionado no está disponible: sin cupo, "
                "gimnasio cerrado o colisiona con una clase del socio."
            )
    else:
        if schedule is None:
            raise RecoveryError(
                "Debes elegir la clase en la que el socio recupera la sesión."
            )
        if schedule.activity_id != activity.pk:
            raise RecoveryError(
                "La clase no pertenece a la actividad de la recuperación."
            )
        if not any(o["schedule_id"] == schedule.id for o in options):
            raise RecoveryError(
                "La clase seleccionada no está disponible: sin cupo o "
                "colisiona con otra clase del socio."
            )

    recovery = SessionRecovery.objects.create(
        gym=gym,
        member=member,
        granted_by=granted_by,
        kind=kind,
        activity=activity if kind == "activity" else None,
        status="scheduled",
        used_date=target_date,
        used_slot=slot,
        used_schedule=schedule,
        expires_at=target_date,
        note=note,
    )
    return recovery


@transaction.atomic
def undo_recovery(recovery):
    """Deshace una recuperación usada: borra su asistencia y la deja cancelada."""
    if recovery.status != "used":
        raise RecoveryError(
            "Solo se pueden deshacer recuperaciones ya usadas."
        )

    Attendance.objects.filter(recovery=recovery).delete()

    if recovery.kind == "activity" and recovery.used_schedule_id:
        from activities.models import ActivitySessionRecord

        ActivitySessionRecord.objects.filter(
            member=recovery.member,
            date=recovery.used_date,
            schedule=recovery.used_schedule,
            source="recovery",
        ).delete()

    recovery.status = "cancelled"
    recovery.used_at = None
    recovery.used_date = None
    recovery.used_slot = None
    recovery.used_schedule = None
    recovery.save(
        update_fields=[
            "status",
            "used_at",
            "used_date",
            "used_slot",
            "used_schedule",
            "updated_at",
        ]
    )
    return recovery