from calendar import monthrange
from datetime import date

from django.db import transaction
from django.utils import timezone

from attendance.models import AttendanceSchedule, ScheduleSlot, ScheduleSwapRequest

from .models import PlanChangeRequest, Subscription, PlannedSchedule


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
        return True
    status = get_subscription_payment_status(subscription)
    return status not in ("blocked", "initial_pending")


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

    target_date = plan_change_request.effective_date or calculate_effective_date(plan_change_request.member)
    plan = plan_change_request.requested_plan
    gym = plan_change_request.gym

    slots = ScheduleSlot.objects.filter(gym=gym).order_by("day", "hour")

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
