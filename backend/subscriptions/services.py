from calendar import monthrange
from datetime import date, timedelta

from django.db import transaction
from django.db.models import Max, Q
from django.db.models.expressions import Exists, OuterRef
from django.utils import timezone

from attendance.models import AttendanceSchedule, ScheduleSlot, ScheduleSwapRequest

from .models import PlanChangeRequest, Subscription, SubscriptionItem, PlannedSchedule


def ensure_subscription_item(subscription):
    SubscriptionItem.objects.update_or_create(
        subscription=subscription,
        item_type="plan",
        plan=subscription.plan,
        defaults={
            "status": "active",
            "name_snapshot": subscription.plan.name,
            "price_snapshot": subscription.plan.price,
            "start_date": subscription.start_date,
            "end_date": subscription.end_date,
        },
    )


def ensure_subscription_items(subscription, previous_subscription=None):
    """Ensure all billing items exist for a subscription.

    1. Creates/updates the plan item (gym membership or base plan).
    2. If previous_subscription is provided, copies active activity items.
    """
    ensure_subscription_item(subscription)

    if previous_subscription is None:
        return

    previous_items = SubscriptionItem.objects.filter(
        subscription=previous_subscription,
        item_type="activity",
        status="active",
    ).select_related("activity")

    for prev_item in previous_items:
        activity = prev_item.activity
        if activity is None or not activity.active:
            continue
        SubscriptionItem.objects.update_or_create(
            subscription=subscription,
            activity=activity,
            defaults={
                "item_type": "activity",
                "plan": None,
                "status": "active",
                "name_snapshot": activity.name,
                "price_snapshot": activity.monthly_price,
                "start_date": subscription.start_date,
                "end_date": subscription.end_date,
            },
        )


def get_subscription_payment_status(subscription):
    today = timezone.localdate()
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


def can_member_operate(member):
    subscription = (
        Subscription.objects.filter(member=member)
        .order_by("-end_date")
        .first()
    )
    if not subscription:
        return False
    status = get_subscription_payment_status(subscription)
    return status not in ("blocked", "initial_pending")


def member_has_active_subscription_for_service(member, service):
    """Check if member has an active subscription that grants access.

    With the Base Plan architecture, any active subscription grants activity
    access, subject to gym policy:
    - Gym plan subscriptions always grant access.
    - Base Plan subscriptions grant access only if gym allows activity-only.
    """
    from plans.services import get_base_plan_for_gym

    now = timezone.localdate()
    sub = Subscription.objects.filter(
        member=member,
        start_date__lte=now,
        end_date__gte=now,
    ).order_by("-created_at").first()

    if sub is None:
        return False

    base_plan = get_base_plan_for_gym(member.gym)
    if base_plan and sub.plan_id == base_plan.pk:
        return member.gym.allow_activity_without_membership

    return True


def get_last_day_of_month(d):
    return date(d.year, d.month, monthrange(d.year, d.month)[1])


def get_first_day_of_next_month(d):
    if d.month == 12:
        return date(d.year + 1, 1, 1)
    return date(d.year, d.month + 1, 1)


def cancel_future_plan_change(plan_change_request, cancel_status="cancelled_by_staff"):
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


def get_member_active_subscription(member):
    today = date.today()

    active = Subscription.objects.filter(
        member=member,
        start_date__lte=today,
        end_date__gte=today,
    ).order_by("-created_at").first()

    if active:
        return active

    return Subscription.objects.filter(
        member=member,
    ).order_by("-created_at").first()


def get_member_schedule_limit(member):
    subscription = get_member_active_subscription(member)
    if subscription is None:
        return None
    return subscription.plan.weekly_visits


def get_member_active_schedule_count(member):
    return member.schedules.filter(active=True).count()


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


def gym_has_pending_auto_renewals(gym):
    latest_ids = (
        Subscription.objects.filter(gym=gym)
        .values("member_id")
        .annotate(latest_id=Max("id"))
        .values_list("latest_id", flat=True)
    )

    has_next = Subscription.objects.filter(
        member=OuterRef('member'),
        start_date=OuterRef('end_date') + timedelta(days=1),
    )

    return Subscription.objects.filter(
        id__in=latest_ids, auto_renew=True,
    ).filter(~Exists(has_next)).exists()


def _collect_renewal_candidates(queryset):
    """Phase 1: Select expired auto_renew subscriptions and compute target periods.

    Returns a list of (subscription, target_start, target_end) tuples.
    Skips Base Plan subscriptions when the gym no longer allows activity-only.
    """
    from plans.services import get_base_plan_for_gym

    today = timezone.localdate()
    expired = queryset.filter(
        end_date__lt=today,
        auto_renew=True,
    ).select_related("member", "plan", "gym")

    candidates = []
    for sub in expired:
        base_plan = get_base_plan_for_gym(sub.gym)
        if base_plan and sub.plan_id == base_plan.pk:
            if not sub.gym.allow_activity_without_membership:
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


def _resolve_plan(member, expired_sub, target_start):
    """Check for an approved plan change effective on or before target_start."""
    approved_pcr = PlanChangeRequest.objects.filter(
        member=member,
        status="approved",
        effective_date__lte=target_start,
    ).first()
    return approved_pcr.requested_plan if approved_pcr else expired_sub.plan


def auto_renew_subscriptions(gym=None):
    """Create the next monthly subscription for each eligible member.

    A subscription is eligible when:
      1. auto_renew is True
      2. end_date < today  (it has expired)

    Three phases:
      1. Candidate selection — query expired subs, compute target periods.
      2. Successor detection — bulk-check which members already have the
         target subscription (idempotency guard).
      3. Creation — for each non-duplicate candidate, resolve the plan
         (honouring approved plan changes) and create the subscription
         plus its SubscriptionItem inside a transaction.
    """
    qs = Subscription.objects
    if gym is not None:
        qs = qs.filter(gym=gym)

    candidates = _collect_renewal_candidates(qs)
    already_renewed = _find_already_renewed_members(candidates)

    renewed = 0
    skipped_already = 0
    skipped_initial_pending = 0

    for expired_sub, target_start, target_end in candidates:
        # Skip if a subscription already exists for this member+period.
        if expired_sub.member_id in already_renewed:
            skipped_already += 1
            continue

        # Skip if this is the member's very first subscription and it was
        # never paid — treat as initial_pending, not eligible for renewal.
        is_first_and_unpaid = (
            not expired_sub.paid
            and not Subscription.objects.filter(
                member=expired_sub.member,
                created_at__lt=expired_sub.created_at,
            ).exists()
        )
        if is_first_and_unpaid:
            skipped_initial_pending += 1
            continue

        plan = _resolve_plan(expired_sub.member, expired_sub, target_start)

        with transaction.atomic():
            new_sub = Subscription.objects.create(
                gym=expired_sub.gym,
                member=expired_sub.member,
                plan=plan,
                start_date=target_start,
                end_date=target_end,
                paid=False,
                auto_renew=expired_sub.auto_renew,
            )
            ensure_subscription_items(new_sub, previous_subscription=expired_sub)
        renewed += 1

    return {
        "renewed": renewed,
        "skipped_auto_renew": 0,
        "skipped_already": skipped_already,
        "skipped_no_prev": 0,
        "skipped_initial_pending": skipped_initial_pending,
    }


def apply_plan_change(plan_change_request):
    with transaction.atomic():
        plan_change_request.status = "executed"
        plan_change_request.save(update_fields=["status"])

        AttendanceSchedule.objects.filter(
            member=plan_change_request.member,
            active=True,
        ).update(active=False)

        from .models import PlannedSchedule

        for ps in PlannedSchedule.objects.filter(
            plan_change=plan_change_request,
            activated=False,
        ).select_related("slot"):
            existing = AttendanceSchedule.objects.filter(
                member=plan_change_request.member,
                slot=ps.slot,
            ).first()

            if existing:
                existing.active = True
                existing.save(update_fields=["active"])
            else:
                AttendanceSchedule.objects.create(
                    member=plan_change_request.member,
                    gym=plan_change_request.gym,
                    slot=ps.slot,
                    active=True,
                )

            ps.activated = True
            ps.save(update_fields=["activated"])
