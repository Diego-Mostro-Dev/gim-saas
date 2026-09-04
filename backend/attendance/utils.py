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


def compute_effective_occupancies(slots, target_date, exclude_member=None):
    """Compute effective occupancy for many slots at once.

    Equivalent to calling ``compute_effective_occupancy`` for each slot, but
    reduces the per-slot N+1 queries (4~5 round-trips per slot) to a handful
    of aggregate queries. Returns ``{slot_id: effective}``.

    Semantics mirror ``compute_effective_occupancy`` exactly; only the shape
    of the queries changes, never the result.
    """
    from subscriptions.models import PlanChangeRequest, PlannedSchedule

    slot_ids = [s.id for s in slots]
    if not slot_ids:
        return {}

    # Members with an active recurring schedule, grouped by slot.
    recurring = list(
        AttendanceSchedule.objects.filter(
            slot_id__in=slot_ids,
            active=True,
        ).values_list("slot_id", "member_id")
    )
    if exclude_member is not None:
        recurring = [r for r in recurring if r[1] != exclude_member]

    active_by_slot = {}
    for slot_id, member_id in recurring:
        active_by_slot.setdefault(slot_id, set()).add(member_id)

    # Members with an approved plan change effective on/before target_date,
    # and which slots that plan change schedules them into (only the slots we
    # care about are fetched, but every effective change is considered so a
    # change targeting a slot outside this set still counts as a "leaver").
    changes = list(
        PlanChangeRequest.objects.filter(
            status="approved",
            effective_date__lte=target_date,
        ).values_list("id", "member_id")
    )
    member_changes = {}
    for change_id, member_id in changes:
        member_changes.setdefault(member_id, set()).add(change_id)

    # change_id -> set of planned slot ids (restricted to `slot_ids`, which is
    # all that matters for these slots' occupancy).
    planned = list(
        PlannedSchedule.objects.filter(
            plan_change_id__in=[c[0] for c in changes],
            slot_id__in=slot_ids,
        ).values_list("plan_change_id", "slot_id")
    )
    change_slots = {}
    for change_id, slot_id in planned:
        change_slots.setdefault(change_id, set()).add(slot_id)

    # future_by_slot: members whose approved, effective plan change schedules
    # them into this slot. Mirrors future_qs (planned_schedules__slot=slot).
    future_by_slot = {}
    for change_id, member_id in changes:
        for planned_slot_id in change_slots.get(change_id, set()):
            if exclude_member is not None and member_id == exclude_member:
                continue
            future_by_slot.setdefault(planned_slot_id, set()).add(member_id)

    # leavers_by_slot: members with an active recurring schedule here whose
    # approved, effective plan change does NOT keep them in this slot.
    # Mirrors leavers_qs (member__schedules__slot + NOT planned_schedules__slot).
    leavers_by_slot = {}
    for slot_id, active_members in active_by_slot.items():
        leavers = set()
        for member_id in active_members:
            if exclude_member is not None and member_id == exclude_member:
                continue
            for change_id in member_changes.get(member_id, set()):
                if slot_id not in change_slots.get(change_id, set()):
                    leavers.add(member_id)
                    break
        if leavers:
            leavers_by_slot[slot_id] = leavers

    swaps_in_count = {}
    swaps_in = ScheduleSwapRequest.objects.filter(
        destination_slot_id__in=slot_ids,
        swap_date=target_date,
        status="approved",
    ).values_list("destination_slot_id", "member_id")
    for slot_id, member_id in swaps_in:
        if exclude_member is not None and member_id == exclude_member:
            continue
        swaps_in_count[slot_id] = swaps_in_count.get(slot_id, 0) + 1

    swaps_out_count = {}
    swaps_out = ScheduleSwapRequest.objects.filter(
        origin_schedule__slot_id__in=slot_ids,
        swap_date=target_date,
        status="approved",
    ).values_list("origin_schedule__slot_id", "member_id")
    for slot_id, member_id in swaps_out:
        if exclude_member is not None and member_id == exclude_member:
            continue
        swaps_out_count[slot_id] = swaps_out_count.get(slot_id, 0) + 1

    result = {}
    for slot_id in slot_ids:
        base_count = len(
            active_by_slot.get(slot_id, set())
            - future_by_slot.get(slot_id, set())
            - leavers_by_slot.get(slot_id, set())
        )
        effective = (
            base_count
            + swaps_in_count.get(slot_id, 0)
            - swaps_out_count.get(slot_id, 0)
            + len(future_by_slot.get(slot_id, set()))
        )
        result[slot_id] = max(0, effective)

    return result


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
