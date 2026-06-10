from django.db.models import Count, Q

from .models import Attendance, AttendanceSchedule, ScheduleSlot, ScheduleSwapRequest


def compute_effective_occupancy(slot, target_date):
    """
    Compute the effective number of members attending a slot on a specific date.

    effective = active_recurring + approved_swaps_in - approved_swaps_out

    Returns max(0, effective) to prevent negative occupancy.
    """
    base = AttendanceSchedule.objects.filter(
        slot=slot,
        active=True,
    ).count()

    swaps_in = ScheduleSwapRequest.objects.filter(
        destination_slot=slot,
        swap_date=target_date,
        status="approved",
    ).count()

    swaps_out = ScheduleSwapRequest.objects.filter(
        origin_schedule__slot=slot,
        swap_date=target_date,
        status="approved",
    ).count()

    return max(0, base + swaps_in - swaps_out)


def count_regular_attendances(gym, target_date):
    """Count attendances from recurring schedules (non-swap, non-walk-in)."""
    return Attendance.objects.filter(
        gym=gym,
        date=target_date,
        slot__isnull=False,
        swap_request__isnull=True,
    ).count()


def count_swap_attendances(gym, target_date):
    """Count attendances linked to approved schedule swaps."""
    return Attendance.objects.filter(
        gym=gym,
        date=target_date,
        swap_request__isnull=False,
    ).count()


def count_walkin_attendances(gym, target_date):
    """Count attendances without a schedule link (QR / walk-in)."""
    return Attendance.objects.filter(
        gym=gym,
        date=target_date,
        slot__isnull=True,
    ).count()


def count_attendances_by_slot(gym, slot, target_date):
    """Count attendances for a specific ScheduleSlot on a given date."""
    return Attendance.objects.filter(
        gym=gym,
        slot=slot,
        date=target_date,
    ).count()


def get_attendance_breakdown(gym, target_date):
    """Return a dict with attendance broken down by type."""
    return {
        "regular": count_regular_attendances(gym, target_date),
        "swap": count_swap_attendances(gym, target_date),
        "walkin": count_walkin_attendances(gym, target_date),
        "total": Attendance.objects.filter(gym=gym, date=target_date).count(),
    }


def get_attendance_by_slot(gym, slot, start_date, end_date):
    """Return attendance records for a specific slot within a date range."""
    return Attendance.objects.filter(
        gym=gym,
        slot=slot,
        date__gte=start_date,
        date__lte=end_date,
    ).select_related("member").order_by("date")


def get_attendance_by_member(gym, member, start_date, end_date):
    """Return attendance records for a specific member within a date range."""
    return Attendance.objects.filter(
        gym=gym,
        member=member,
        date__gte=start_date,
        date__lte=end_date,
    ).select_related("slot").order_by("date")


def get_swap_usage_metrics(gym, start_date, end_date):
    """Return swap request metrics for a gym within a date range."""
    qs = ScheduleSwapRequest.objects.filter(
        gym=gym,
        requested_at__date__gte=start_date,
        requested_at__date__lte=end_date,
    )
    stats = qs.aggregate(
        total=Count("id"),
        pending=Count("id", filter=Q(status="pending")),
        approved=Count("id", filter=Q(status="approved")),
        rejected=Count("id", filter=Q(status="rejected")),
        cancelled=Count("id", filter=Q(status="cancelled")),
        auto_approved=Count("id", filter=Q(
            status="approved",
            reviewed_by__isnull=True,
            admin_notes="Aprobado automáticamente",
        )),
    )
    return stats
