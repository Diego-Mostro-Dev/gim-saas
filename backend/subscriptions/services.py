import logging
from calendar import monthrange
from datetime import date
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from attendance.models import AttendanceSchedule, ScheduleSwapRequest
from .domain import ScheduleDomain, SubscriptionDomain

from .models import PlanChangeRequest, Subscription, SubscriptionItem, PlannedSchedule

logger = logging.getLogger(__name__)


def ensure_subscription_item(subscription):
    SubscriptionItem.objects.create(
        subscription=subscription,
        item_type="plan",
        plan=subscription.plan,
        status="active",
        name_snapshot=subscription.plan.name,
        price_snapshot=subscription.plan.price,
        start_date=subscription.start_date,
        end_date=subscription.end_date,
    )


def _copy_activity_items(from_subscription, to_subscription):
    """Copy active activity items from one subscription to another."""
    previous_items = SubscriptionItem.objects.filter(
        subscription=from_subscription,
        item_type="activity",
        status="active",
    ).select_related("activity")

    for prev_item in previous_items:
        activity = prev_item.activity
        if activity is None or not activity.active:
            continue
        SubscriptionItem.objects.create(
            subscription=to_subscription,
            item_type="activity",
            plan=None,
            activity=activity,
            status="active",
            name_snapshot=activity.name,
            price_snapshot=activity.monthly_price,
            start_date=to_subscription.start_date,
            end_date=to_subscription.end_date,
        )


def ensure_subscription_items(subscription, previous_subscription=None):
    """Ensure all billing items exist for a subscription.

    1. Creates the plan item (gym membership or base plan).
    2. If previous_subscription is provided, copies active activity items.
    """
    ensure_subscription_item(subscription)

    if previous_subscription is not None:
        _copy_activity_items(previous_subscription, subscription)


def calculate_subscription_total(subscription):
    """Return the total amount to pay for a subscription.

    Plan price for the period plus every active activity SubscriptionItem.
    This is the single source of truth for the subscription total and must
    stay identical to what the member portal displays (see
    SubscriptionSerializer.get_total).
    """
    plan_price = subscription.plan.price if subscription.plan else Decimal("0")
    items_total = sum(
        item.price_snapshot
        for item in subscription.items.all()
        if item.status == "active" and item.item_type == "activity"
    )
    return plan_price + items_total


def get_subscription_payment_status(subscription, at_date=None):
    today = at_date or timezone.localdate()
    if subscription.paid:
        return "paid"

    is_first = not Subscription.objects.filter(
        member=subscription.member,
        created_at__lt=subscription.created_at,
    ).exists()

    if is_first:
        return "initial_pending"

    gym = subscription.gym
    if today.day <= gym.payment_due_day:
        return "pending"
    if today.day < gym.access_block_day:
        return "overdue"
    return "blocked"


def get_last_day_of_month(d):
    return date(d.year, d.month, monthrange(d.year, d.month)[1])


def get_first_day_of_next_month(d):
    if d.month == 12:
        return date(d.year + 1, 1, 1)
    return date(d.year, d.month + 1, 1)


def cancel_future_plan_change(plan_change_request, cancel_status="cancelled_by_staff"):
    """Cancel an approved plan change that has not yet taken effect.

    Deletes planned schedules and updates the status.
    """
    if plan_change_request.status != "approved":
        return False
    if plan_change_request.effective_date and plan_change_request.effective_date <= date.today():
        return False

    with transaction.atomic():
        plan_change_request.planned_schedules.all().delete()
        plan_change_request.status = cancel_status
        plan_change_request.save(update_fields=["status"])

    return True


def suggest_alternative_slots(plan_change_request, failed_slot_key):
    from attendance.models import ScheduleSlot
    from attendance.utils import SCHEDULE_SLOT_WEEKDAY_ORDER

    target_date = plan_change_request.effective_date or calculate_effective_date(plan_change_request.member)
    plan = plan_change_request.requested_plan
    gym = plan_change_request.gym

    slots = ScheduleSlot.objects.filter(gym=gym).order_by(SCHEDULE_SLOT_WEEKDAY_ORDER, "hour")

    suggestions = []
    for slot in slots:
        cap = slot.capacity or gym.default_schedule_capacity
        if cap is None:
            suggestions.append({
                "day": slot.day,
                "hour": slot.hour.strftime("%H:%M"),
                "slot_id": slot.id,
            })
            continue

        projected = compute_projected_occupancy(
            slot, target_date, exclude_member=plan_change_request.member
        )
        if projected < cap:
            suggestions.append({
                "day": slot.day,
                "hour": slot.hour.strftime("%H:%M"),
                "slot_id": slot.id,
            })

    failed_day, failed_hour = failed_slot_key

    def sort_key(s):
        day_order = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        d_diff = abs(day_order.index(s["day"]) - day_order.index(failed_day))
        h_diff = abs(
            int(s["hour"].split(":")[0]) * 60 + int(s["hour"].split(":")[1])
            - int(failed_hour.split(":")[0]) * 60 - int(failed_hour.split(":")[1])
        )
        return d_diff + h_diff / (24 * 60)

    suggestions.sort(key=sort_key)
    return suggestions


def calculate_effective_date(member=None):
    today = timezone.localdate()
    return get_first_day_of_next_month(today)


def compute_projected_occupancy(slot, target_date, exclude_member=None):
    base = AttendanceSchedule.objects.filter(slot=slot, active=True)
    if exclude_member:
        base = base.exclude(member=exclude_member)
    base_count = base.count()

    swaps_in = ScheduleSwapRequest.objects.filter(
        destination_slot=slot,
        swap_date=target_date,
        status="approved",
    ).count()

    swaps_out = ScheduleSwapRequest.objects.filter(
        origin_schedule__slot=slot,
        swap_date=target_date,
        status="approved",
    )
    if exclude_member:
        swaps_out = swaps_out.exclude(member=exclude_member)
    swaps_out_count = swaps_out.count()

    future_changes_qs = PlanChangeRequest.objects.filter(
        status="approved",
        effective_date__lte=target_date,
        planned_schedules__slot=slot,
    )
    if exclude_member:
        future_changes_qs = future_changes_qs.exclude(member=exclude_member)
    future_change_count = future_changes_qs.values("member").distinct().count()

    return max(0, base_count + swaps_in - swaps_out_count + future_change_count)


def create_next_subscription(expired_sub, origin="auto_renewal"):
    """Create the next monthly subscription for a member.

    The successor period starts on the calendar month that follows the
    expired subscription's end_date. This lets the command run on any
    day of the month and still recover renewals a missed cron left
    pending, without ever changing the renewal period.

    Resolves the plan (honouring approved plan changes) and copies
    activity items from the expired subscription.

    Args:
        expired_sub: The Subscription that has expired.
        origin: One of Subscription.ORIGIN_CHOICES.

    Returns:
        The new Subscription.
    """
    target_start = get_first_day_of_next_month(expired_sub.end_date)
    target_end = get_last_day_of_month(target_start)

    plan, approved_pcr = _resolve_plan(expired_sub.member, expired_sub, target_start)

    with transaction.atomic():
        new_sub = SubscriptionDomain.open_subscription(
            member=expired_sub.member,
            plan=plan,
            start_date=target_start,
            end_date=target_end,
            paid=False,
            auto_renew=expired_sub.auto_renew,
            origin=origin,
        )
        _copy_activity_items(expired_sub, new_sub)

        if approved_pcr is not None:
            apply_plan_change(approved_pcr)

    return new_sub


def _collect_renewal_candidates(queryset):
    """Select expired auto_renew subscriptions that have not been renewed yet.

    Returns a list of (subscription, target_start, target_end) tuples.
    The successor period always starts on the calendar month that follows
    the expired subscription's end_date, so the command can run any day
    of the month and still catch up on renewals the cron missed.

    Skips:
    - Base Plan subscriptions when the gym no longer allows activity-only.
    - Members whose active flag is False.
    - Members whose expired subscription was in 'blocked' payment status
      at the time of expiry (unpaid renewal subscriptions whose end_date
      falls on or after the gym's access_block_day).
    """
    from plans.services import get_base_plan_for_gym

    today = timezone.localdate()
    expired = queryset.filter(
        end_date__lt=today,
        auto_renew=True,
    ).select_related("member", "plan", "gym")

    candidates = []
    for sub in expired:
        # ── Base plan guard ──────────────────────────────────────────
        base_plan = get_base_plan_for_gym(sub.gym)
        if base_plan and sub.plan_id == base_plan.pk:
            if not sub.gym.allow_activity_without_membership:
                continue

        # ── Member active guard ──────────────────────────────────────
        if not sub.member.active:
            continue

        # ── Payment status guard (evaluate at expiry date) ───────────
        if get_subscription_payment_status(sub, at_date=sub.end_date) == "blocked":
            continue

        target_start = get_first_day_of_next_month(sub.end_date)
        target_end = get_last_day_of_month(target_start)
        candidates.append((sub, target_start, target_end))
    return candidates


def _find_already_renewed_members(candidates):
    """Phase 2: Detect members who already have a subscription for the target period.

    Builds a single OR query across all candidates to find existing successors
    in one round-trip, then returns a set of member_ids to skip.
    """
    if not candidates:
        return set()

    query = Q()
    for _sub, target_start, _end in candidates:
        query |= Q(member_id=_sub.member_id, start_date=target_start)
    return set(
        Subscription.objects.filter(query).values_list("member_id", flat=True)
    )


def _apply_due_plan_changes(member_id):
    """Execute approved plan changes whose effective_date has arrived.

    Used by the renewal job so a due plan change is still completed when
    the member was skipped because its successor subscription already
    exists (apply_plan_change is idempotent).
    """
    for pcr in PlanChangeRequest.objects.filter(
        member_id=member_id,
        status="approved",
        effective_date__lte=timezone.localdate(),
    ):
        try:
            apply_plan_change(pcr)
        except Exception:
            logger.exception("Failed to apply plan change %s", pcr.pk)


def _apply_all_due_plan_changes(gym=None):
    """Execute every approved plan change whose effective_date has arrived.

    A plan change is an administrative decision: its execution is never
    conditioned by the member's payment status, the auto_renew flag, or
    membership activity. This guarantees no approved plan change is left
    hanging because the member was not a renewal candidate.
    """
    due = PlanChangeRequest.objects.filter(
        status="approved",
        effective_date__lte=timezone.localdate(),
    )
    if gym is not None:
        due = due.filter(gym=gym)

    applied = 0
    failed = 0
    for pcr in due:
        try:
            apply_plan_change(pcr)
            applied += 1
        except Exception:
            failed += 1
            logger.exception("Failed to apply plan change %s", pcr.pk)
    return applied, failed


def _resolve_plan(member, expired_sub, target_start):
    """Resolve the plan for the renewal, honouring approved plan changes.

    Returns a (plan, approved_plan_change_request) tuple. The second item is
    the approved PlanChangeRequest being honoured (if any), so the caller can
    complete its workflow.
    """
    approved_pcr = PlanChangeRequest.objects.filter(
        member=member,
        status="approved",
        effective_date__lte=target_start,
    ).order_by("-requested_at").first()
    if approved_pcr is not None:
        return approved_pcr.requested_plan, approved_pcr
    return expired_sub.plan, None


def apply_plan_change(plan_change_request):
    """Execute an approved plan change whose effective_date has arrived.

    Completes the workflow started at approval:
    1. Creates (idempotently) the subscription for the effective period with
       the requested plan when the renewal has not created it yet.
    2. Links the request to that subscription and marks it as executed.
    3. Synchronizes AttendanceSchedule with the target schedules.
    4. Marks PlannedSchedule rows as activated.

    Idempotent: does nothing when the request is not approved or not due.

    Args:
        plan_change_request: The approved PlanChangeRequest to execute.

    Returns:
        The executed PlanChangeRequest, or None when not applicable.
    """
    if plan_change_request.status != "approved":
        return None
    if (
        plan_change_request.effective_date is None
        or plan_change_request.effective_date > timezone.localdate()
    ):
        return None

    with transaction.atomic():
        plan_change_request.refresh_from_db()
        if plan_change_request.status != "approved":
            return None

        member = plan_change_request.member
        gym = plan_change_request.gym
        month_start = plan_change_request.effective_date
        month_end = get_last_day_of_month(month_start)

        period_sub = Subscription.objects.filter(
            member=member,
            start_date=month_start,
        ).first()

        if period_sub is None:
            current_sub = Subscription.objects.filter(
                member=member,
            ).order_by("-created_at").first()
            period_sub = SubscriptionDomain.open_subscription(
                member=member,
                plan=plan_change_request.requested_plan,
                start_date=month_start,
                end_date=month_end,
                paid=False,
                auto_renew=current_sub.auto_renew if current_sub else True,
                origin="plan_change",
            )
            if current_sub:
                _copy_activity_items(current_sub, period_sub)

        plan_change_request.subscription = period_sub
        plan_change_request.status = "executed"
        plan_change_request.save(update_fields=["status", "subscription"])

        ScheduleDomain.sync_schedules(
            member,
            gym,
            plan_change_request.target_schedules_snapshot or [],
            subscription=period_sub,
        )

        plan_change_request.planned_schedules.filter(
            activated=False
        ).update(activated=True)

    return plan_change_request


def auto_renew_subscriptions(gym=None):
    """Create the successor subscription for each eligible member.

    A subscription is eligible when:
      1. auto_renew is True
      2. it has expired (end_date < today)
      3. no successor for the following period exists yet

    Two phases:
      1. Candidate selection — query expired subs, compute target periods.
      2. Creation — for each non-duplicate candidate, create the subscription
         plus its SubscriptionItem inside a transaction. A failure on one
         member is logged and does not stop the rest, so a later run can
         retry the failed member.

    A final phase applies every approved plan change whose effective date
    has arrived, for all members. A plan change is an administrative
    decision and never depends on the member's payment status or renewal
    eligibility, so it cannot be left hanging by the financial state.

    Safe to run on any day of the month; pending renewals are caught up.
    """
    qs = Subscription.objects
    if gym is not None:
        qs = qs.filter(gym=gym)

    candidates = _collect_renewal_candidates(qs)
    already_renewed = _find_already_renewed_members(candidates)

    renewed = 0
    skipped_already = 0
    failed = 0

    for expired_sub, _target_start, _target_end in candidates:
        if expired_sub.member_id in already_renewed:
            skipped_already += 1
            _apply_due_plan_changes(expired_sub.member_id)
            continue

        try:
            new_sub = create_next_subscription(expired_sub, origin="auto_renewal")
        except Exception:
            failed += 1
            logger.exception(
                "Auto-renewal failed for member %s (expired subscription %s)",
                expired_sub.member_id,
                expired_sub.pk,
            )
            continue

        if new_sub is not None:
            renewed += 1

    plan_changes_applied, plan_changes_failed = _apply_all_due_plan_changes(gym)

    return {
        "renewed": renewed,
        "skipped_already": skipped_already,
        "failed": failed,
        "plan_changes_applied": plan_changes_applied,
        "plan_changes_failed": plan_changes_failed,
    }



