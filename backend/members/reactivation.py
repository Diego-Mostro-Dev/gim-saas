from django.utils import timezone


def validate_reactivation_capacity(member):
    """Return conflicts that would appear when a deleted member is restored.

    Soft-deleted members are excluded from every operational count. If the
    freed seats were taken while the member was away, reactivating would
    silently oversubscribe the schedule, so the staff must resolve it first.
    The checks mirror the operational capacity rules but treat the member as
    not counted yet (they are still soft-deleted).
    """
    from activities.models import Enrollment
    from attendance.models import AttendanceSchedule
    from attendance.utils import compute_effective_occupancy
    from outings.models import OutingEnrollment
    from personal_training.models import PersonalTrainingAssignment
    from personal_training.overlap import validate_assignment

    conflicts = []
    today = timezone.localdate()

    schedules = AttendanceSchedule.objects.filter(
        member=member,
        active=True,
    ).select_related("slot")
    for schedule in schedules:
        slot = schedule.slot
        cap = slot.capacity or member.gym.default_schedule_capacity
        if cap is None:
            continue
        if compute_effective_occupancy(slot, today) >= cap:
            conflicts.append(
                f"Horario de gimnasio {slot.get_day_display()} "
                f"{slot.hour:%H:%M} completo."
            )

    for enrollment in Enrollment.objects.filter(
        member=member,
        active=True,
    ).select_related("schedule__activity"):
        schedule = enrollment.schedule
        if schedule.capacity is None:
            continue
        enrolled = Enrollment.objects.filter(
            schedule=schedule,
            active=True,
            member__deleted_at__isnull=True,
        ).count()
        if enrolled >= schedule.capacity:
            conflicts.append(
                f"Actividad {schedule.activity.name} "
                f"{schedule.get_day_display()} {schedule.start_time:%H:%M} "
                "completa."
            )

    for enrollment in OutingEnrollment.objects.filter(
        member=member,
        active=True,
    ).select_related("schedule__outing"):
        schedule = enrollment.schedule
        if schedule.capacity is None:
            continue
        enrolled = OutingEnrollment.objects.filter(
            schedule=schedule,
            active=True,
            member__deleted_at__isnull=True,
        ).count()
        if enrolled >= schedule.capacity:
            conflicts.append(
                f"Salida {schedule.outing.name} "
                f"{schedule.get_day_display()} {schedule.start_time:%H:%M} "
                "completa."
            )

    assignments = PersonalTrainingAssignment.objects.filter(
        member=member,
        active=True,
    ).select_related("trainer", "service")
    for assignment in assignments:
        try:
            validate_assignment(
                member,
                assignment.trainer,
                assignment.day,
                assignment.start_time,
                assignment.end_time,
                exclude=assignment,
            )
        except ValueError as exc:
            conflicts.append(
                f"Entrenamiento personal {assignment.service.name}: {exc}"
            )

    return conflicts
