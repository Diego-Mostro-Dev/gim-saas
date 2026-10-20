"""Invariantes de paquetes de sesiones (Fase G, PLAN-bugs.md).

Red de invariantes read-only sobre los paquetes de actividades y de
entrenamiento personal: afirma que las sesiones consumidas son exactamente
los registros existentes, que nunca se superan las sesiones del paquete y que
ninguna sesión "fantasma" (fecha sin clase dictada, día equivocado o gym
cerrado) quedó registrada — el corazón de ADD-07.

Uso típico desde una suite:

    violations = check_session_invariants(gym)
    self.assertEqual(violations, [])
"""

from collections import defaultdict


def _closed_dates(gym):
    from gyms.models import GymClosedDate

    return set(
        GymClosedDate.objects.filter(gym=gym).values_list("date", flat=True)
    )


def _check_package(records, schedule_created, schedule_day, total, closed,
                   label, violations):
    """Afirma los invariantes de un paquete de sesiones.

    ``records`` es la lista de ``(date, source, weekday)`` de la inscripción /
    asignación; ``schedule_created`` es la fecha en que nació el horario.
    """
    if total is not None and len(records) > total:
        violations.append(
            f"P2 {label}: {len(records)} sesiones consumidas > "
            f"{total} del paquete"
        )

    per_day = defaultdict(int)
    for date_, source, weekday in records:
        per_day[(date_, weekday)] += 1
        if weekday != schedule_day:
            violations.append(
                f"P3 {label}: sesión del {date_} en día {weekday} "
                f"(la clase es {schedule_day})"
            )
        if schedule_created is not None and date_ < schedule_created:
            violations.append(
                f"P3 {label}: sesión del {date_} anterior a la creación "
                f"del horario ({schedule_created})"
            )
        if date_ in closed:
            violations.append(
                f"P4 {label}: sesión registrada en fecha cerrada {date_}"
            )

    for (date_, _weekday), count in per_day.items():
        if count > 1:
            violations.append(
                f"P5 {label}: {count} sesiones para el {date_} "
                f"(se espera 1)"
            )


def check_session_invariants(gym):
    """Return a list of human-readable session invariant violations for ``gym``.

    Empty list means every invariant holds.

    Invariants:
      P1  las sesiones consumidas coinciden con los registros existentes
          (igualdad por construcción, se verifica que el conteo del modelo
          ``used_sessions`` no diverja del número de filas).
      P2  nunca se consumen más sesiones que las del paquete.
      P3  ninguna sesión cae en un día distinto al de la clase ni antes de la
          creación del horario (ADD-07).
      P4  ninguna sesión cae en una fecha en que el gym estuvo cerrado.
      P5  a lo sumo una sesión por (inscripción, fecha).
      P6  "falta + recuperación" cuesta 1 sesión: cada registro
          ``source="recovery"`` de un paquete está respaldado por una
          ``SessionRecovery`` usada del mismo socio, gimnasio y paquete; el
          número de recuperos usados que apuntan a un paquete nunca supera sus
          registros ``recovery`` (ADD-21).
    """
    from activities.models import ActivitySessionRecord, Enrollment
    from attendance.models import SessionRecovery
    from personal_training.models import (
        PersonalTrainingAssignment,
        PersonalTrainingSessionRecord,
    )

    violations = []
    closed = _closed_dates(gym)

    # ── Actividades ────────────────────────────────────────────────
    day_index = {
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
        "friday": 4, "saturday": 5, "sunday": 6,
    }
    enrollments = Enrollment.objects.filter(gym=gym).select_related("schedule")
    for enrollment in enrollments:
        records = list(
            ActivitySessionRecord.objects.filter(enrollment=enrollment).values_list(
                "date", "source"
            )
        )
        rows = [
            (date_, source, date_.weekday()) for date_, source in records
        ]
        if enrollment.used_sessions != len(records):
            violations.append(
                f"P1 actividad enrollment {enrollment.id}: used_sessions="
                f"{enrollment.used_sessions} pero {len(records)} registros"
            )
        _check_package(
            rows,
            enrollment.schedule.created_at.date(),
            day_index.get(enrollment.schedule.day),
            enrollment.package_total_sessions,
            closed,
            f"actividad enrollment {enrollment.id}",
            violations,
        )

        recovery_dates = {
            date_ for date_, source, _w in rows if source == "recovery"
        }
        used_dates = set(
            SessionRecovery.objects.filter(
                gym=gym,
                member_id=enrollment.member_id,
                kind="activity",
                activity_id=enrollment.schedule.activity_id,
                status="used",
            ).values_list("used_date", flat=True)
        )
        unbacked = recovery_dates - used_dates
        if unbacked:
            violations.append(
                f"P6 actividad enrollment {enrollment.id}: registros "
                f"source='recovery' sin recuperación usada en {sorted(unbacked)}"
            )
        # Una recuperación usada sin registro sólo es legítima si el paquete ya
        # estaba agotado (no se descuenta de un paquete sin saldo).
        if not enrollment.exhausted:
            missing = used_dates - recovery_dates
            if missing:
                violations.append(
                    f"P6 actividad enrollment {enrollment.id}: "
                    f"recuperaciones usadas sin registro de sesión en "
                    f"{sorted(missing)}"
                )

    # ── Entrenamiento personal ─────────────────────────────────────
    assignments = PersonalTrainingAssignment.objects.filter(gym=gym)
    for assignment in assignments:
        records = list(
            PersonalTrainingSessionRecord.objects.filter(
                assignment=assignment
            ).values_list("date", "source")
        )
        rows = [
            (date_, source, date_.weekday()) for date_, source in records
        ]
        if assignment.used_sessions != len(records):
            violations.append(
                f"P1 PT assignment {assignment.id}: used_sessions="
                f"{assignment.used_sessions} pero {len(records)} registros"
            )
        _check_package(
            rows,
            assignment.created_at.date(),
            day_index.get(assignment.day),
            assignment.package_total_sessions,
            closed,
            f"PT assignment {assignment.id}",
            violations,
        )

        recovery_dates = {
            date_ for date_, source, _w in rows if source == "recovery"
        }
        used_dates = set(
            SessionRecovery.objects.filter(
                gym=gym,
                member_id=assignment.member_id,
                kind="pt",
                pt_assignment_id=assignment.id,
                status="used",
            ).values_list("used_date", flat=True)
        )
        unbacked = recovery_dates - used_dates
        if unbacked:
            violations.append(
                f"P6 PT assignment {assignment.id}: registros "
                f"source='recovery' sin recuperación usada en {sorted(unbacked)}"
            )
        if not assignment.exhausted:
            missing = used_dates - recovery_dates
            if missing:
                violations.append(
                    f"P6 PT assignment {assignment.id}: recuperaciones usadas "
                    f"sin registro de sesión en {sorted(missing)}"
                )

    return violations
