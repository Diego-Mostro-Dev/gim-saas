from datetime import timedelta

from django.db.models import Case, Count, IntegerField, Q, Value, When

from .models import Attendance, AttendanceSchedule, ScheduleSlot, ScheduleSwapRequest


SCHEDULE_SLOT_WEEKDAY_ORDER = Case(
    When(day="monday", then=Value(0)),
    When(day="tuesday", then=Value(1)),
    When(day="wednesday", then=Value(2)),
    When(day="thursday", then=Value(3)),
    When(day="friday", then=Value(4)),
    When(day="saturday", then=Value(5)),
    When(day="sunday", then=Value(6)),
    default=Value(99),
    output_field=IntegerField(),
)


def compute_effective_occupancy(slot, target_date, exclude_member=None):
    """
    Compute the effective number of members attending a slot on a specific date.

    effective = active_recurring + approved_swaps_in - approved_swaps_out
                + plan_changes_in - plan_changes_out

    Approved plan changes whose effective_date has arrived are honoured:
      - members moved INTO this slot are counted (and excluded from the
        recurring base to avoid double counting);
      - members moved OUT of this slot (recurring schedule present but plan
        change targets another slot) are no longer counted.

    Returns max(0, effective) to prevent negative occupancy.
    """
    from subscriptions.models import PlanChangeRequest

    # Members whose approved plan change (effective on/before target_date)
    # scheduled them INTO this slot. They are represented via future_count.
    future_qs = PlanChangeRequest.objects.filter(
        status="approved",
        effective_date__lte=target_date,
        planned_schedules__slot=slot,
    ).values("member").distinct()
    if exclude_member:
        future_qs = future_qs.exclude(member=exclude_member)
    future_count = future_qs.count()

    # Members whose approved plan change (effective on/before target_date)
    # moved them OUT of this slot: they have an active recurring schedule
    # here but their plan change does not keep this slot.
    leavers_qs = PlanChangeRequest.objects.filter(
        status="approved",
        effective_date__lte=target_date,
        member__schedules__slot=slot,
        member__schedules__active=True,
    ).exclude(planned_schedules__slot=slot).values("member").distinct()
    if exclude_member:
        leavers_qs = leavers_qs.exclude(member=exclude_member)

    # Recurring schedules in this slot, minus members already represented by
    # a plan change (leavers are excluded; entrants are re-added via
    # future_count to avoid double counting).
    base_qs = AttendanceSchedule.objects.filter(
        slot=slot,
        active=True,
    ).exclude(member__in=future_qs).exclude(member__in=leavers_qs)
    if exclude_member:
        base_qs = base_qs.exclude(member=exclude_member)
    base_count = base_qs.count()

    swaps_in_qs = ScheduleSwapRequest.objects.filter(
        destination_slot=slot,
        swap_date=target_date,
        status="approved",
    )
    if exclude_member:
        swaps_in_qs = swaps_in_qs.exclude(member=exclude_member)
    swaps_in = swaps_in_qs.count()

    swaps_out_qs = ScheduleSwapRequest.objects.filter(
        origin_schedule__slot=slot,
        swap_date=target_date,
        status="approved",
    )
    if exclude_member:
        swaps_out_qs = swaps_out_qs.exclude(member=exclude_member)
    swaps_out = swaps_out_qs.count()

    return max(0, base_count + swaps_in - swaps_out + future_count)


def compute_projected_occupancy(slot, target_date, exclude_member=None):
    """Project occupancy honouring approved plan changes.

    Delegates to the single source of truth compute_effective_occupancy,
    so every occupancy check (capacity, availability, projections) uses the
    exact same computation.
    """
    return compute_effective_occupancy(slot, target_date, exclude_member=exclude_member)


def has_effective_capacity(slot, gym, target_date, exclude_member=None):
    """Return True when a slot can take at least one more member on target_date.

    Centralises the capacity re-validation used when approving schedule-
    related requests, so every approval path shares the exact same
    occupancy semantics.

    Args:
        slot: The ScheduleSlot to check.
        gym: The gym (used for the default schedule capacity).
        target_date: The date whose effective occupancy matters.
        exclude_member: Member to count as already-in (e.g. the subject of
            an approval request that is not yet materialised).

    Returns:
        True when effective occupancy is below capacity (or capacity is
        unlimited), False when the slot is full.
    """
    cap = slot.capacity or gym.default_schedule_capacity
    if cap is None:
        return True
    effective = compute_effective_occupancy(
        slot, target_date, exclude_member=exclude_member
    )
    return effective < cap


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


def count_member_week_attendances(gym, member, target_date):
    """Count a member's attendances in the calendar week (Mon-Sun) of target_date.

    Only days on which the gym actually operates (has at least one
    ScheduleSlot) count toward the weekly quota, so closed days (e.g. a gym
    that does not open on Sundays) do not consume visit slots.
    """
    monday = target_date - timedelta(days=target_date.weekday())
    sunday = monday + timedelta(days=6)
    open_days = set(
        ScheduleSlot.objects.filter(gym=gym).values_list("day", flat=True)
    )
    day_by_weekday = {
        0: "monday",
        1: "tuesday",
        2: "wednesday",
        3: "thursday",
        4: "friday",
        5: "saturday",
        6: "sunday",
    }
    counted_dates = [
        monday + timedelta(days=i)
        for i in range(7)
        if day_by_weekday[(monday + timedelta(days=i)).weekday()] in open_days
    ]
    return Attendance.objects.filter(
        member=member,
        date__in=counted_dates,
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
    )
    return stats
