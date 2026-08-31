import logging
from calendar import monthrange
from datetime import date
from decimal import Decimal

from django.db import transaction
from django.db.models import Min, Q, Sum
from django.utils import timezone

from attendance.models import AttendanceSchedule, ScheduleSwapRequest
from attendance.utils import compute_effective_occupancy
from .domain import ScheduleDomain, SubscriptionConflictError, SubscriptionDomain

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
    """Copy active activity items from one subscription to another.

    When the gym's activities add-on is disabled, activity items are not
    copied so the activity is not billed. The plan item (gym membership or
    base plan) is unaffected. This freezes activity-only members without
    cost; re-enabling the add-on restores the billing in later renewals.
    """
    from gyms.features import activities_enabled

    if not activities_enabled(to_subscription.gym):
        return

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

    The total is the contract price for the period and is computed
    exclusively from the SubscriptionItem price snapshots:

    - the plan item's price_snapshot: the membership price the member
      actually contracted when the subscription was created;
    - every active activity item's price_snapshot.

    MembershipPlan.price is intentionally NOT used so a later change to the
    plan price never alters the total of subscriptions created before the
    change. This is the single source of truth for the subscription total
    and must stay identical to what the member portal displays (see
    SubscriptionSerializer.get_total).

    Defensive fallback: a subscription created before the SubscriptionItem
    backfill may lack a plan item; only then is the current plan price used
    as a last resort.
    """
    total = Decimal("0")
    has_plan_item = False

    for item in subscription.items.all():
        if item.status != "active":
            continue
        if item.item_type == "plan":
            has_plan_item = True
        total += item.price_snapshot

    if not has_plan_item and subscription.plan is not None:
        total += subscription.plan.price

    return total


def sync_subscription_paid(subscription):
    """Reconcile the denormalized ``paid`` flag with the real balance.

    Rule: after any Payment mutation (create/update/delete),

        subscription.paid == (subscription_remaining_balance(subscription)["remaining"] == 0)

    Must be called inside a transaction with the subscription locked with
    select_for_update so concurrent mutations cannot leave the flag stale.
    ``payment_status`` keeps being derived from the real balance and is not
    replaced by this flag.

    Args:
        subscription: The Subscription instance (locked).

    Returns:
        The Subscription instance.
    """
    balance = subscription_remaining_balance(subscription)
    should_be_paid = balance["remaining"] == 0

    if subscription.paid != should_be_paid:
        subscription.paid = should_be_paid
        subscription.save(update_fields=["paid"])

    return subscription


def subscription_remaining_balance(subscription, paid_amount=None):
    """Return the pending balance of a subscription.

    Single source of truth for a subscription's balance:

    - total: the full amount to pay for the period, computed through
      calculate_subscription_total, which remains the source of truth
      for billing amounts.
    - paid_amount: the sum of every Payment linked to the subscription.
    - remaining: total minus paid_amount, clamped at zero.

    Args:
        subscription: The Subscription instance.
        paid_amount: Optional precomputed paid total. When provided it is
            used as-is to avoid an extra query in bulk contexts.

    Returns:
        A dict with "total", "paid_amount" and "remaining" Decimals.
    """
    from payments.models import Payment

    total = calculate_subscription_total(subscription)

    if paid_amount is None:
        paid_amount = (
            Payment.objects.filter(subscription=subscription).aggregate(
                paid=Sum("amount")
            )["paid"]
            or Decimal("0")
        )

    remaining = total - paid_amount
    if remaining < 0:
        remaining = Decimal("0")

    return {
        "total": total,
        "paid_amount": paid_amount,
        "remaining": remaining,
    }


def member_total_outstanding_debt(member):
    """Return the member's total outstanding debt.

    The debt is composed of every subscription of the member with a positive
    remaining balance, computed through subscription_remaining_balance, which
    stays the single source of truth for subscription balances. It does not
    rely on the paid=False denormalized flag: a subscription flagged as paid
    but with an unpaid balance still counts as outstanding.

    Returns:
        A dict with:
        - subscriptions: list of {"subscription": Subscription, "total": Decimal,
          "paid": Decimal, "remaining": Decimal} for every unpaid
          subscription with a positive remaining balance, ordered by period
          ascending.
        - total: the sum of all remaining balances as a Decimal.
    """
    from payments.models import Payment

    outstanding_subs = (
        Subscription.objects.filter(
            member=member,
        )
        .select_related("plan")
        .prefetch_related("items")
        .order_by("start_date", "created_at")
    )

    paid_by_subscription = {
        row["subscription"]: row["paid"]
        for row in Payment.objects.filter(
            subscription__in=outstanding_subs
        ).values("subscription").annotate(paid=Sum("amount"))
    }

    subscriptions = []
    for sub in outstanding_subs:
        balance = subscription_remaining_balance(
            sub,
            paid_amount=paid_by_subscription.get(sub.id) or Decimal("0"),
        )
        if balance["remaining"] <= 0:
            continue
        subscriptions.append(
            {
                "subscription": sub,
                "total": balance["total"],
                "paid_amount": balance["paid_amount"],
                "remaining": balance["remaining"],
            }
        )

    total = sum(
        (entry["remaining"] for entry in subscriptions),
        Decimal("0"),
    )

    return {
        "subscriptions": subscriptions,
        "total": total,
    }


def gym_outstanding_subscriptions(gym):
    """Return every subscription in the gym with a positive remaining balance.

    Unlike member_total_outstanding_debt, this is gym-wide and does NOT rely
    on the paid=False denormalized flag: the remaining balance is always
    computed from the actual payments through subscription_remaining_balance,
    and only subscriptions with remaining > 0 are returned.

    Args:
        gym: The Gym instance.

    Returns:
        A list of {"subscription": Subscription, "total": Decimal,
        "paid_amount": Decimal, "remaining": Decimal}, ordered by period
        ascending.
    """
    from payments.models import Payment

    subscriptions = (
        Subscription.objects.filter(gym=gym)
        .select_related("member", "plan", "gym")
        .prefetch_related("items__activity")
        .order_by("start_date", "created_at")
    )

    paid_by_subscription = {
        row["subscription"]: row["paid"]
        for row in Payment.objects.filter(
            subscription__in=subscriptions
        ).values("subscription").annotate(paid=Sum("amount"))
    }

    earliest_first_created = dict(
        Subscription.objects.filter(gym=gym)
        .values("member")
        .annotate(first_created=Min("created_at"))
        .values_list("member", "first_created")
    )

    outstanding = []
    for sub in subscriptions:
        balance = subscription_remaining_balance(
            sub,
            paid_amount=paid_by_subscription.get(sub.id) or Decimal("0"),
        )
        if balance["remaining"] > 0:
            outstanding.append({
                "subscription": sub,
                **balance,
                "is_first": (
                    sub.created_at == earliest_first_created.get(sub.member_id)
                ),
            })

    return outstanding


def get_subscription_payment_status(subscription, at_date=None, remaining=None,
                                    is_first=None):
    today = at_date or timezone.localdate()

    if remaining is None:
        remaining = subscription_remaining_balance(subscription)["remaining"]

    if remaining == 0:
        return "paid"

    if is_first is None:
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
    """Project occupancy honouring approved plan changes.

    Delegates to the single source of truth compute_effective_occupancy so
    every occupancy check (capacity, availability, projections) uses the
    exact same computation.
    """
    return compute_effective_occupancy(slot, target_date, exclude_member=exclude_member)


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


def recover_member(member):
    """Reactivate a member, optionally opening a new subscription.

    Two distinct scenarios are handled:

    Case A — Reactivation: the member already has a Subscription covering
    today and every subscription is fully settled. No new subscription is
    created; the member is simply reactivated (active=True) and the existing
    current Subscription is returned.

    Case B — Recovery: the member has no subscription covering today.
    Recovery is always a manual staff action. It creates a new subscription
    for the current period only when every precondition holds:
    1. No subscription of the member has a positive remaining balance
       (computed through subscription_remaining_balance), so no historical
       debt remains. The denormalized ``paid`` flag is deliberately not
       used: a subscription flagged as paid with an unpaid balance still
       counts as debt, and a flagged unpaid one with a zero balance does
       not.
    2. No subscription covers today (no current subscription).
    3. No subscription starts in the future (no future subscription).
    4. The plan is the approved plan change's requested plan when one is due,
       otherwise the latest subscription's plan. The base plan is rejected.
    5. Active activity items are copied from the latest subscription and the
       auto_renew flag is inherited.
    6. The new subscription starts today, ends on the last day of the current
       month, is unpaid, and has origin="recovery".

    When an approved plan change is used, it is fully executed inside the same
    transaction: linked to the new subscription, marked as executed, schedules
    synchronized and PlannedSchedule rows activated, so the apply_plan_changes
    job never retries it.

    Args:
        member: The Member being recovered.

    Returns:
        The current Subscription when reactivating (Case A), or the new
        Subscription created for the current period (Case B).

    Raises:
        SubscriptionConflictError: When a recovery precondition fails.
    """
    today = timezone.localdate()
    month_end = get_last_day_of_month(today)

    latest_sub = Subscription.objects.filter(
        member=member,
    ).order_by("-start_date", "-created_at").first()

    if latest_sub is None:
        raise SubscriptionConflictError(
            "No se puede recuperar: el socio no tiene una suscripción previa."
        )

    if member_total_outstanding_debt(member)["total"] > 0:
        raise SubscriptionConflictError(
            "No se puede recuperar: el socio todavía posee deuda pendiente."
        )

    current_sub = SubscriptionDomain.get_current_subscription(member)

    if current_sub is not None:
        member.active = True
        member.save(update_fields=["active"])
        return current_sub

    if Subscription.objects.filter(member=member, start_date__gt=today).exists():
        raise SubscriptionConflictError(
            "No se puede recuperar: el socio ya tiene una suscripción futura."
        )

    plan, approved_pcr = _resolve_plan(member, latest_sub, today)

    if plan.is_base:
        raise SubscriptionConflictError(
            "No se puede recuperar con el plan base."
        )

    with transaction.atomic():
        new_sub = SubscriptionDomain.open_subscription(
            member=member,
            plan=plan,
            start_date=today,
            end_date=month_end,
            paid=False,
            auto_renew=latest_sub.auto_renew,
            origin="recovery",
        )
        _copy_activity_items(latest_sub, new_sub)

        if approved_pcr is not None:
            _finalize_plan_change(approved_pcr, new_sub)

        member.active = True
        member.save(update_fields=["active"])

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


def _finalize_plan_change(plan_change_request, subscription):
    """Execute a due approved plan change against an existing subscription.

    Mirrors the finalization performed by apply_plan_change so that recovery
    and the scheduled job share the same execution semantics:
    1. Links the request to the subscription and marks it as executed.
    2. Synchronizes AttendanceSchedule with the target schedules.
    3. Marks PlannedSchedule rows as activated.

    Args:
        plan_change_request: The approved PlanChangeRequest to execute.
        subscription: The Subscription the plan change took effect on.

    Returns:
        The executed PlanChangeRequest.
    """
    plan_change_request.subscription = subscription
    plan_change_request.status = "executed"
    plan_change_request.save(update_fields=["status", "subscription"])

    ScheduleDomain.sync_schedules(
        plan_change_request.member,
        plan_change_request.gym,
        plan_change_request.target_schedules_snapshot or [],
        subscription=subscription,
    )

    plan_change_request.planned_schedules.filter(
        activated=False
    ).update(activated=True)

    return plan_change_request


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
        else:
            if period_sub.plan != plan_change_request.requested_plan:
                period_sub.plan = plan_change_request.requested_plan
                period_sub.save(update_fields=["plan"])

                period_sub.items.filter(
                    item_type="plan",
                    status="active",
                ).update(status="cancelled")

                ensure_subscription_item(period_sub)

        _finalize_plan_change(plan_change_request, period_sub)

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



