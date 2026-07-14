from calendar import monthrange
from datetime import date, timedelta

from django.db import transaction
from django.db.models import Max, Q
from django.db.models.expressions import Exists, OuterRef
from django.utils import timezone

from time import perf_counter  # TEMP DEBUG

from django.db import connection  # TEMP DEBUG
import logging  # TEMP DEBUG

from attendance.models import AttendanceSchedule, ScheduleSlot, ScheduleSwapRequest

from .models import PlanChangeRequest, Subscription, SubscriptionItem, PlannedSchedule

logger = logging.getLogger(__name__)  # TEMP DEBUG


def ensure_subscription_item(subscription):
    SubscriptionItem.objects.update_or_create(
        subscription=subscription,
        defaults={
            "plan": subscription.plan,
            "status": "active",
            "price_snapshot": subscription.plan.price,
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
    now = timezone.localdate()
    return SubscriptionItem.objects.filter(
        subscription__member=member,
        plan__service=service,
        status="active",
        subscription__start_date__lte=now,
        subscription__end_date__gte=now,
    ).exists()


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


def auto_renew_subscriptions(gym=None, request_id=""):  # TEMP DEBUG added request_id
    qs = Subscription.objects
    if gym is not None:
        qs = qs.filter(gym=gym)
    renewed = 0
    skipped_auto_renew = 0
    skipped_already = 0
    skipped_no_prev = 0
    skipped_initial_pending = 0

    # TEMP DEBUG: per-phase instrumentation
    _t0 = perf_counter()
    _qc0 = len(connection.queries)
    _qc1 = _qc2 = _qc3 = _qc0
    _expired_count = 0

    # Phase 1: collect eligible candidates with computed target periods.
    #
    # Selection rule — a subscription is eligible for renewal iff:
    #   1. auto_renew is True
    #   2. end_date < today  (the subscription has expired)
    #
    # We do NOT use MAX(id) to pick "the latest subscription". That approach
    # picks future subscriptions and causes an infinite renewal cascade.
    # Instead we select ALL expired, auto_renew=True subscriptions. The
    # idempotency check in Phase 2 naturally deduplicates: if the successor
    # already exists for a given (member, target_start), the subscription is
    # skipped.
    today = timezone.localdate()
    expired_subs = qs.filter(
        end_date__lt=today,
        auto_renew=True,
    ).select_related("member", "plan")

    candidates = []
    for sub in expired_subs:
        _expired_count += 1  # TEMP DEBUG

        target_start = get_first_day_of_next_month(sub.end_date)
        target_end = get_last_day_of_month(target_start)
        candidates.append((sub, target_start, target_end))

    # TEMP DEBUG: Phase 1 complete
    _qc1 = len(connection.queries)
    _t1 = perf_counter()

    # Phase 2: bulk idempotency check — single query for all members
    if candidates:
        query = Q()
        for sub, target_start, _ in candidates:
            query |= Q(member_id=sub.member_id, start_date=target_start)
        already_renewed_member_ids = set(
            Subscription.objects.filter(query).values_list("member_id", flat=True)
        )
    else:
        already_renewed_member_ids = set()

    # TEMP DEBUG: Phase 2 complete
    _qc2 = len(connection.queries)
    _t2 = perf_counter()
    logger.info(
        "[%s] Phase 1&2: expired_subs=%d candidates=%d skipped_auto_renew=%d "
        "already_renewed=%d elapsed_p1=%.4fs elapsed_p2=%.4fs queries_p1=%d queries_p2=%d",
        request_id, _expired_count, len(candidates), skipped_auto_renew,
        len(already_renewed_member_ids),
        _t1 - _t0,
        _t2 - _t1,
        _qc1 - _qc0,
        _qc2 - _qc1,
    )

    # Phase 3: process candidates using pre-computed set
    for sub, target_start, target_end in candidates:
        if sub.member_id in already_renewed_member_ids:
            skipped_already += 1
            continue

        is_first_and_unpaid = (
            not sub.paid
            and not Subscription.objects.filter(
                member=sub.member,
                created_at__lt=sub.created_at,
            ).exists()
        )
        if is_first_and_unpaid:
            skipped_initial_pending += 1
            continue

        approved_pcr = PlanChangeRequest.objects.filter(
            member=sub.member,
            status="approved",
            effective_date__lte=target_start,
        ).first()
        plan = approved_pcr.requested_plan if approved_pcr else sub.plan

        with transaction.atomic():
            new_sub = Subscription.objects.create(
                gym=sub.gym,
                member=sub.member,
                plan=plan,
                start_date=target_start,
                end_date=target_end,
                paid=False,
                auto_renew=sub.auto_renew,
            )
            ensure_subscription_item(new_sub)
        renewed += 1

    # TEMP DEBUG: Phase 3 complete
    _qc3 = len(connection.queries)
    _t3 = perf_counter()
    logger.info(
        "[%s] Phase 3: created=%d skipped_already=%d skipped_initial_pending=%d "
        "elapsed_p3=%.4fs queries_p3=%d",
        request_id, renewed, skipped_already, skipped_initial_pending,
        _t3 - _t2,
        _qc3 - _qc2,
    )
    # TEMP DEBUG: totals
    _total_elapsed = _t3 - _t0
    _total_queries = _qc3 - _qc0
    logger.info(
        "[%s] TOTAL: renewed=%d skipped_auto_renew=%d skipped_already=%d "
        "skipped_initial_pending=%d elapsed=%.4fs queries=%d",
        request_id, renewed, skipped_auto_renew, skipped_already,
        skipped_initial_pending, _total_elapsed, _total_queries,
    )

    return {
        "renewed": renewed,
        "skipped_auto_renew": skipped_auto_renew,
        "skipped_already": skipped_already,
        "skipped_no_prev": skipped_no_prev,
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
