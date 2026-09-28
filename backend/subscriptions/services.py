import logging
from calendar import monthrange
from collections import defaultdict
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.db import transaction
from django.db.models import Min, Sum
from django.utils import timezone

from attendance.models import AttendanceSchedule, ScheduleSwapRequest
from attendance.utils import compute_effective_occupancy
from activities.no_show_service import deduct_missed_sessions
from .domain import ScheduleDomain, SubscriptionConflictError, SubscriptionDomain

from .models import PlanChangeRequest, Subscription, SubscriptionItem, PlannedSchedule

logger = logging.getLogger(__name__)


def ensure_subscription_item(subscription):
    price = _item_price(subscription, subscription.plan.price)
    SubscriptionItem.objects.create(
        subscription=subscription,
        item_type="plan",
        plan=subscription.plan,
        status="active",
        name_snapshot=subscription.plan.name,
        price_snapshot=price,
        start_date=subscription.start_date,
        end_date=subscription.end_date,
    )


def _item_price(subscription, monthly_price):
    """Precio de facturación del ítem para el período (Fase 5, #48).

    Un socio ``is_comp`` no se factura: su ítem se escribe en 0, sin importar
    la vía de alta. Así el total queda en 0 aunque un resto de precio se haya
    colado en un snapshot previo.
    """
    return Decimal("0") if subscription.member.is_comp else monthly_price


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
        if SubscriptionItem.objects.filter(
            subscription=to_subscription,
            activity=activity,
            status="active",
        ).exists():
            continue
        SubscriptionItem.objects.create(
            subscription=to_subscription,
            item_type="activity",
            plan=None,
            activity=activity,
            status="active",
            name_snapshot=activity.name,
            price_snapshot=_item_price(to_subscription, activity.monthly_price),
            start_date=to_subscription.start_date,
            end_date=to_subscription.end_date,
        )


def _copy_personal_training_items(from_subscription, to_subscription):
    """Copy active personal-training items from one subscription to another.

    Mirrors _copy_activity_items: when the gym's personal-training add-on
    is disabled, PT items are not copied so the service stops being billed
    in renewals. Re-enabling the add-on restores billing in later renewals.
    """
    from gyms.features import personal_training_enabled

    if not personal_training_enabled(to_subscription.gym):
        return

    previous_items = SubscriptionItem.objects.filter(
        subscription=from_subscription,
        item_type="personal_training",
        status="active",
    ).select_related("personal_training")

    for prev_item in previous_items:
        pt_service = prev_item.personal_training
        if pt_service is None or not pt_service.active:
            continue
        if SubscriptionItem.objects.filter(
            subscription=to_subscription,
            personal_training=pt_service,
            status="active",
        ).exists():
            continue
        SubscriptionItem.objects.create(
            subscription=to_subscription,
            item_type="personal_training",
            plan=None,
            personal_training=pt_service,
            status="active",
            name_snapshot=pt_service.name,
            price_snapshot=_item_price(to_subscription, pt_service.monthly_price),
            start_date=to_subscription.start_date,
            end_date=to_subscription.end_date,
        )


def _copy_outing_items(from_subscription, to_subscription):
    """Copy active outing items from one subscription to another.

    Mirrors _copy_activity_items: when the gym's running-grupo add-on
    is disabled, outing items are not copied so the service stops being
    billed in renewals. Re-enabling the add-on restores billing in later
    renewals.
    """
    from gyms.features import outings_enabled

    if not outings_enabled(to_subscription.gym):
        return

    previous_items = SubscriptionItem.objects.filter(
        subscription=from_subscription,
        item_type="outing",
        status="active",
    ).select_related("outing")

    for prev_item in previous_items:
        outing = prev_item.outing
        if outing is None or not outing.active:
            continue
        if SubscriptionItem.objects.filter(
            subscription=to_subscription,
            outing=outing,
            status="active",
        ).exists():
            continue
        SubscriptionItem.objects.create(
            subscription=to_subscription,
            item_type="outing",
            plan=None,
            outing=outing,
            status="active",
            name_snapshot=outing.name,
            price_snapshot=_item_price(to_subscription, outing.monthly_price),
            start_date=to_subscription.start_date,
            end_date=to_subscription.end_date,
        )


def ensure_subscription_items(subscription, previous_subscription=None):
    """Ensure all billing items exist for a subscription.

    1. Creates the plan item (gym membership or base plan).
    2. If previous_subscription is provided, copies active activity and
       personal-training items.
    """
    ensure_subscription_item(subscription)

    if previous_subscription is not None:
        _copy_activity_items(previous_subscription, subscription)
        _copy_personal_training_items(previous_subscription, subscription)
        _copy_outing_items(previous_subscription, subscription)


def ensure_pt_items_for_active_assignments(member, subscription):
    """Fase 5 (#2): garantiza el ítem de PT para cada asignación activa.

    Al abrir o reactivar una suscripción, si el socio tiene asignaciones de
    entrenamiento personal activas debe quedar el ítem de PT correspondiente
    (facturado en 0 si el socio es ``is_comp``). Se ejecuta en el punto de
    escritura canónico (``open_subscription``) porque hay flujos en los que
    la asignación existe pero el ítem no llegó a la suscripción nueva (fue
    creada sin suscripción vigente, o el ítem se anuló). Preventivo puro:
    hoy el audit da 0 afectados.
    """
    for assignment in member.personal_training_assignments.filter(
        active=True
    ).select_related("service"):
        service = assignment.service
        if SubscriptionItem.objects.filter(
            subscription=subscription,
            personal_training=service,
            status="active",
        ).exists():
            continue
        SubscriptionItem.objects.create(
            subscription=subscription,
            item_type="personal_training",
            plan=None,
            personal_training=service,
            status="active",
            name_snapshot=service.name,
            price_snapshot=_item_price(subscription, service.monthly_price),
            start_date=subscription.start_date,
            end_date=subscription.end_date,
        )


def calculate_subscription_total(subscription, apply_discount=True):
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

    When the member has an active gym-assigned discount, the discount is
    applied to the total (rounding half-up to cents). The original price is
    kept in the price snapshots, so passing ``apply_discount=False`` yields
    the undiscounted contract total for display.

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

    if not apply_discount:
        return total

    return discounted_amount(total, member_discount_percent(subscription.member))


def member_discount_percent(member):
    """Return the active discount percent for a member, or 0.

    A member with no assigned discount (or whose discount is inactive) has
    no discount. Pase de cortesía members are not affected here: their
    price snapshots are zeroed, so their total is already 0.
    """
    discount = getattr(member, "discount", None)
    if discount is None or not discount.active:
        return 0
    return discount.discount_percent


def discounted_amount(amount, percent):
    """Apply a percent discount to an amount, rounding half-up to cents.

    Args:
        amount: Decimal with the original price.
        percent: Integer percentage (0-100).

    Returns:
        Decimal with the discounted amount (2 decimal places).
    """
    if percent <= 0 or amount is None:
        return amount
    discount = (amount * Decimal(percent)) / Decimal("100")
    return (amount - discount).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def subscription_original_total(subscription):
    """Undiscounted contract total for a subscription."""
    return calculate_subscription_total(subscription, apply_discount=False)


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
    overpayment = Decimal("0")
    if remaining < 0:
        overpayment = -remaining
        remaining = Decimal("0")

    if subscription.member.is_comp:
        # Pase de cortesía: nunca genera saldo pendiente, sin importar el
        # historial de items o pagos. Es la garantía de que un socio comp
        # no figure en deudas, pendientes ni recuperables.
        return {
            "total": total,
            "paid_amount": total,
            "remaining": Decimal("0"),
            "overpayment": Decimal("0"),
        }

    return {
        "total": total,
        "paid_amount": paid_amount,
        "remaining": remaining,
        "overpayment": overpayment,
    }


def member_activity_package_debt(member):
    """Return unpaid per-session activity packages for a single member.

    Session packages (modality="package") are charged independently of the
    subscription/payment system, accumulating in Enrollment.amount_paid.
    A package counts as debt when its total (session_price × sessions) exceeds
    the amount paid.

    Returns:
        A list of dicts with the "enrollment" (prefetched with
        schedule__activity) plus name/sessions_total/session_price/total/
        paid_amount/remaining.
    """
    from activities.models import Enrollment

    pending_enrollments = (
        Enrollment.objects.filter(
            member=member,
            active=True,
            modality="package",
            session_price__isnull=False,
        )
        .select_related("schedule__activity")
    )
    return _package_debt_entries(pending_enrollments)


def gym_activity_package_debt(gym):
    """Gym-wide version of member_activity_package_debt.

    Returns entries that also include "member" (used by admin screens to
    surface session debt across the whole gym).
    """
    from activities.models import Enrollment

    pending_enrollments = (
        Enrollment.objects.filter(
            gym=gym,
            active=True,
            modality="package",
            session_price__isnull=False,
        )
        .select_related("member", "schedule__activity")
    )
    return _package_debt_entries(pending_enrollments, include_member=True)


def member_personal_training_package_debt(member):
    """Return unpaid per-session personal-training packages for a single member.

    Mirrors member_activity_package_debt for PT assignments in package
    modality, which accumulate independent of the subscription payment
    system in PersonalTrainingAssignment.amount_paid.
    """
    from personal_training.models import PersonalTrainingAssignment

    pending_assignments = (
        PersonalTrainingAssignment.objects.filter(
            member=member,
            active=True,
            modality="package",
            session_price__isnull=False,
        )
        .select_related("service", "member")
    )
    return _pt_package_debt_entries(pending_assignments)


def gym_personal_training_package_debt(gym):
    """Gym-wide version of member_personal_training_package_debt."""
    from personal_training.models import PersonalTrainingAssignment

    pending_assignments = (
        PersonalTrainingAssignment.objects.filter(
            gym=gym,
            active=True,
            modality="package",
            session_price__isnull=False,
        )
        .select_related("service", "member")
    )
    return _pt_package_debt_entries(pending_assignments, include_member=True)


def member_outing_package_debt(member):
    """Return unpaid per-session outing packages for a single member.

    Mirrors member_activity_package_debt for outing enrollments in package
    modality, which accumulate independently of the subscription payment
    system in OutingEnrollment.amount_paid.
    """
    from outings.models import OutingEnrollment

    pending_enrollments = (
        OutingEnrollment.objects.filter(
            member=member,
            active=True,
            modality="package",
            session_price__isnull=False,
        )
        .select_related("schedule__outing")
    )
    return _outing_package_debt_entries(pending_enrollments)


def gym_outing_package_debt(gym):
    """Gym-wide version of member_outing_package_debt."""
    from outings.models import OutingEnrollment

    pending_enrollments = (
        OutingEnrollment.objects.filter(
            gym=gym,
            active=True,
            modality="package",
            session_price__isnull=False,
        )
        .select_related("member", "schedule__outing")
    )
    return _outing_package_debt_entries(pending_enrollments, include_member=True)


def _package_debt_entries(queryset, include_member=False):
    """Map pending package enrollments into debt entry dicts."""
    entries = []
    for e in queryset:
        if getattr(e.member, "is_comp", False):
            continue
        remaining = e.remaining_amount
        if remaining is None or remaining <= 0:
            continue
        entry = {
            "type": "activity_package",
            "enrollment": e,
            "name": e.schedule.activity.name,
            "sessions_total": e.package_total_sessions,
            "session_price": e.session_price,
            "total": e.total_amount or Decimal("0"),
            "paid_amount": e.amount_paid or Decimal("0"),
            "remaining": remaining,
        }
        if include_member:
            entry["member"] = e.member
        entries.append(entry)
    return entries


def _pt_package_debt_entries(queryset, include_member=False):
    """Map pending PT package assignments into debt entry dicts."""
    entries = []
    for a in queryset:
        if getattr(a.member, "is_comp", False):
            continue
        remaining = a.remaining_amount
        if remaining is None or remaining <= 0:
            continue
        entry = {
            "type": "personal_training_package",
            "assignment": a,
            "name": a.service.name,
            "sessions_total": a.package_total_sessions,
            "session_price": a.session_price,
            "total": a.total_amount or Decimal("0"),
            "paid_amount": a.amount_paid or Decimal("0"),
            "remaining": remaining,
        }
        if include_member:
            entry["member"] = a.member
        entries.append(entry)
    return entries


def _outing_package_debt_entries(queryset, include_member=False):
    """Map pending outing package enrollments into debt entry dicts."""
    entries = []
    for e in queryset:
        if getattr(e.member, "is_comp", False):
            continue
        remaining = e.remaining_amount
        if remaining is None or remaining <= 0:
            continue
        entry = {
            "type": "outing_package",
            "outing_enrollment": e,
            "name": e.schedule.outing.name,
            "sessions_total": e.package_total_sessions,
            "session_price": e.session_price,
            "total": e.total_amount or Decimal("0"),
            "paid_amount": e.amount_paid or Decimal("0"),
            "remaining": remaining,
        }
        if include_member:
            entry["member"] = e.member
        entries.append(entry)
    return entries


def gym_sellado_debt(gym, member=None):
    """Return unpaid one-time sellado charges for a gym (or one member).

    Sellados belong to package inscriptions and PT assignments. The flag
    sellado_paid is the source of truth: a pending sellado exists while it
    reads False (renewals reset it).

    Args:
        gym: The Gym to scan for pending sellados.
        member: Optional Member to restrict the scan to a single member.

    Returns:
        A list of dicts with target_type ("enrollment"/"assignment"), the
        target instance, its display name, the sellado amount and, always,
        the charging member.
    """
    from activities.models import Enrollment
    from personal_training.models import PersonalTrainingAssignment

    sellados = []

    enrollments = Enrollment.objects.filter(
        gym=gym,
        active=True,
        sellado_amount__isnull=False,
        sellado_paid=False,
    ).select_related("member", "schedule__activity")
    if member is not None:
        enrollments = enrollments.filter(member=member)
    for e in enrollments:
        if getattr(e.member, "is_comp", False):
            continue
        sellados.append(
            {
                "target_type": "enrollment",
                "enrollment": e,
                "assignment": None,
                "name": e.schedule.activity.name,
                "amount": e.sellado_amount,
                "member": e.member,
            }
        )

    assignments = PersonalTrainingAssignment.objects.filter(
        gym=gym,
        active=True,
        sellado_amount__isnull=False,
        sellado_paid=False,
    ).select_related("member", "service")
    if member is not None:
        assignments = assignments.filter(member=member)
    for a in assignments:
        if getattr(a.member, "is_comp", False):
            continue
        sellados.append(
            {
                "target_type": "assignment",
                "enrollment": None,
                "assignment": a,
                "name": a.service.name,
                "amount": a.sellado_amount,
                "member": a.member,
            }
        )

    return sellados


def member_sellado_debt(member):
    """Return unpaid one-time sellado charges for a single member.

    Sellados belong to package inscriptions and PT assignments. The flag
    sellado_paid is the source of truth: a pending sellado exists while it
    reads False (renewals reset it).

    Returns:
        A list of dicts with target_type ("enrollment"/"assignment"),
        the target instance, its display name and the sellado amount.
    """
    if getattr(member, "is_comp", False):
        return []

    sellados = gym_sellado_debt(member.gym, member=member)
    for s in sellados:
        s.pop("member", None)
    return sellados


def member_total_outstanding_debt(member):
    from payments.models import Payment

    outstanding_subs = (
        Subscription.objects.filter(
            member=member,
        )
        .select_related("plan", "member__discount")
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

    # Package (activity) debt: unpaid per-session packages with a defined
    # session price. Independent of the subscription payment system but must
    # count as outstanding debt so the member is flagged as a debtor.
    packages = member_activity_package_debt(member)
    packages += member_personal_training_package_debt(member)
    packages += member_outing_package_debt(member)

    package_total = sum(
        (pkg["remaining"] for pkg in packages),
        Decimal("0"),
    )

    sellados = member_sellado_debt(member)
    sellado_total = sum(
        (sellado["amount"] for sellado in sellados),
        Decimal("0"),
    )

    return {
        "subscriptions": subscriptions,
        "packages": packages,
        "sellados": sellados,
        "total": total + package_total + sellado_total,
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
        .select_related("member__discount", "plan", "gym")
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
    if plan_change_request.effective_date and plan_change_request.effective_date <= timezone.localdate():
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
    if member is not None and not SubscriptionDomain.get_current_subscription(member):
        return today
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
        is_comp = expired_sub.member.is_comp
        new_sub = SubscriptionDomain.open_subscription(
            member=expired_sub.member,
            plan=plan,
            start_date=target_start,
            end_date=target_end,
            paid=is_comp,
            auto_renew=expired_sub.auto_renew,
            origin=origin,
        )
        _copy_activity_items(expired_sub, new_sub)
        _copy_personal_training_items(expired_sub, new_sub)
        _copy_outing_items(expired_sub, new_sub)

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
        _copy_personal_training_items(latest_sub, new_sub)
        _copy_outing_items(latest_sub, new_sub)

        if approved_pcr is not None:
            _finalize_plan_change(approved_pcr, new_sub)

        member.active = True
        member.save(update_fields=["active"])

    return new_sub


def _precomputed_remaining(subscription, paid_amount):
    """Remaining balance of a subscription using precomputed data.

    Mirrors ``subscription_remaining_balance`` without issuing any query:
    the items are prefetched and the paid total is passed in. Pase de
    cortesía members always have zero remaining.
    """
    total = calculate_subscription_total(subscription)
    if subscription.member.is_comp:
        return Decimal("0")
    remaining = total - paid_amount
    return remaining if remaining > 0 else Decimal("0")


def _skips_base_plan(sub, base_plan_ids):
    """True when the base-plan guard excludes ``sub`` from renewal.

    A member on the base plan only renews when the gym still allows
    activity-only access, or when it is a courtesy pass (always free).
    """
    if base_plan_ids.get(sub.gym_id) != sub.plan_id:
        return False
    if sub.gym.allow_activity_without_membership:
        return False
    return not sub.member.is_comp


def _collect_renewal_candidates(queryset):
    """Select expired auto_renew subscriptions and classify them (Fase 2).

    Two passes over the already-fetched rows, no per-row queries:

    - Pasada 0 (cobertura y limpieza): one range query over the candidate
      windows. A row whose target period is already covered by a successor is
      counted as ``covered`` and added to the cleanup list (auto_renew=False).
      The cleanup is unconditional: member/gym state is irrelevant.
    - Pasada 1 (guards, cheapest to most expensive): over the rows left after
      coverage. Stale backlog (target in a closed month) also goes to cleanup.
      The remaining guards split the rest into ``skipped_inactive_gym``,
      ``skipped_base_plan``, ``skipped_inactive_member`` and ``skipped_blocked``.

    Returns a 3-tuple:
      - ``candidates``: list of (subscription, target_start, target_end) tuples
        for rows that pass the creation guards (base plan, member active,
        payment not blocked), using the pre-Fase-2 order so the renewal loop
        behaviour (renewed / skipped_already / failed) is unchanged.
      - ``counters``: dict with the period-level breakdown of the full raw set.
      - ``cleanup_ids``: subscription pks that must get auto_renew=False
        (covered + stale rows).
    """
    from payments.models import Payment
    from plans.services import base_plan_ids_for_gyms

    today = timezone.localdate()
    month_start = today.replace(day=1)
    expired = list(
        queryset.filter(
            end_date__lt=today,
            auto_renew=True,
        )
        .select_related("member__discount", "plan", "gym")
        .prefetch_related("items")
    )

    member_ids = {sub.member_id for sub in expired}
    sub_ids = [sub.pk for sub in expired]
    gym_ids = {sub.gym_id for sub in expired}

    # ── Precompute (1 query each) ────────────────────────────────────
    windows = defaultdict(list)
    for member_id, start_date, end_date in Subscription.objects.filter(
        member_id__in=member_ids
    ).values_list("member_id", "start_date", "end_date"):
        windows[member_id].append((start_date, end_date))

    base_plan_ids = base_plan_ids_for_gyms(gym_ids)

    paid_by_sub = dict(
        Payment.objects.filter(subscription_id__in=sub_ids)
        .values("subscription_id")
        .annotate(paid=Sum("amount"))
        .values_list("subscription_id", "paid")
    )

    earliest_by_member = dict(
        Subscription.objects.filter(member_id__in=member_ids)
        .values("member_id")
        .annotate(first=Min("created_at"))
        .values_list("member_id", "first")
    )

    def payment_blocked(sub):
        remaining = _precomputed_remaining(
            sub, paid_by_sub.get(sub.pk, Decimal("0"))
        )
        return (
            get_subscription_payment_status(
                sub,
                at_date=sub.end_date,
                remaining=remaining,
                is_first=(sub.created_at == earliest_by_member.get(sub.member_id)),
            )
            == "blocked"
        )

    counters = {
        "covered": 0,
        "skipped_stale_backlog": 0,
        "skipped_inactive_gym": 0,
        "skipped_base_plan": 0,
        "skipped_inactive_member": 0,
        "skipped_blocked": 0,
        "candidates": 0,
    }
    cleanup_ids = []
    candidates = []

    for sub in expired:
        target_start = get_first_day_of_next_month(sub.end_date)
        target_end = get_last_day_of_month(target_start)

        # ── Pasada 0 — cobertura del propio período ───────────────────
        if any(
            a <= target_end and b >= target_start
            for a, b in windows[sub.member_id]
        ):
            counters["covered"] += 1
            cleanup_ids.append(sub.pk)
            continue

        # ── Pasada 1 — guards, del más barato al más caro ─────────────
        if target_start < month_start:
            counters["skipped_stale_backlog"] += 1
            cleanup_ids.append(sub.pk)
            continue

        if not sub.gym.active:
            counters["skipped_inactive_gym"] += 1
            continue

        if _skips_base_plan(sub, base_plan_ids):
            counters["skipped_base_plan"] += 1
            continue

        if not sub.member.active:
            counters["skipped_inactive_member"] += 1
            continue

        if payment_blocked(sub):
            counters["skipped_blocked"] += 1
            continue

        counters["candidates"] += 1

    # Loop candidates with the creation guards, in the pre-Fase-2 order. The
    # list is unchanged by Fase 3 (only the loop's skip semantics change).
    for sub in expired:
        if _skips_base_plan(sub, base_plan_ids):
            continue
        if not sub.member.active:
            continue
        if payment_blocked(sub):
            continue
        target_start = get_first_day_of_next_month(sub.end_date)
        target_end = get_last_day_of_month(target_start)
        candidates.append((sub, target_start, target_end))

    return candidates, counters, cleanup_ids


def _find_covered_periods(candidates):
    """Fase 3 (#1): map candidate members to their subscription windows.

    One bounded range query over the global target range replaces the
    per-member OR of ``_find_already_renewed_members`` (742 parameters ->
    ~16). Returns ``{member_id: [(start_date, end_date), ...]}`` — not a set
    of member_ids — so each candidate is judged against its own target
    period: a successor overlapping that window skips only that candidate,
    and one successor no longer masks a missing renewal in another month
    (H1, the 45 frozen members of Gym Demo).
    """
    if not candidates:
        return {}

    min_target_start = min(target_start for _, target_start, _ in candidates)
    max_target_end = max(target_end for _, _, target_end in candidates)

    covered = defaultdict(list)
    for member_id, start_date, end_date in Subscription.objects.filter(
        member_id__in={sub.member_id for sub, _, _ in candidates},
        start_date__lte=max_target_end,
        end_date__gte=min_target_start,
    ).values_list("member_id", "start_date", "end_date"):
        covered[member_id].append((start_date, end_date))
    return covered


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
                _copy_personal_training_items(current_sub, period_sub)
                _copy_outing_items(current_sub, period_sub)
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

    Fase 2 de PLAN-dinero.md: antes del loop, las filas cuyo target ya está
    cubierto por una sucesora y el rezago inerte (mes cerrado) reciben
    ``auto_renew = False`` en un ``UPDATE`` bulk y se cuentan con contadores
    nuevos (covered / stale / gym / base_plan / member / blocked / candidates).

    Fase 3 (#1): el skip del loop es por período propio, no por socio. Una
    sucesora que se superponga al target de esta candidata la saltea a ella
    nomás; una sucesora de otro mes ya no enmascara una renovación perdida
    (H1, los 45 congelados de Gym Demo). Las filas de la limpieza (cubiertas
    o rezago) no crean sucesora nunca: una cubierta ya tiene sucesora y el
    rezago crearía una suscripción retroactiva. Un guard de duplicados
    (member_id, target_start) protege ``unique_subscription_member_period``.

    A final phase applies every approved plan change whose effective date
    has arrived, for all members. A plan change is an administrative
    decision and never depends on the member's payment status or renewal
    eligibility, so it cannot be left hanging by the financial state.

    Safe to run on any day of the month; pending renewals are caught up.
    """
    qs = Subscription.objects
    if gym is not None:
        qs = qs.filter(gym=gym)

    candidates, counters, cleanup_ids = _collect_renewal_candidates(qs)
    covered_periods = _find_covered_periods(candidates)
    cleanup_set = set(cleanup_ids)

    # Fase 2: limpieza de H2 — la primera escritura real del proceso.
    # Las filas con el target ya cubierto y el rezago inerte dejan de
    # auto-renovarse. No importa el estado del socio ni del gym.
    if cleanup_ids:
        Subscription.objects.filter(pk__in=cleanup_ids).update(auto_renew=False)

    # Los socios con un cambio de plan vencido pendiente se atienden por
    # socio (red de #5), pero la comprobación se precarga en una sola
    # query para no emitir una por skip.
    due_pcr_members = set(
        PlanChangeRequest.objects.filter(
            status="approved",
            effective_date__lte=timezone.localdate(),
        ).values_list("member_id", flat=True)
    )

    renewed = 0
    skipped_already = 0
    failed = 0

    attended = set()
    for expired_sub, target_start, target_end in candidates:
        attended_key = (expired_sub.member_id, target_start)

        # Limpieza de la Fase 2 (target cubierto o rezago en mes cerrado):
        # nunca crea sucesora — la cubierta ya tiene una y el rezago
        # generaría una suscripción retroactiva.
        if expired_sub.pk in cleanup_set:
            skipped_already += 1
            if expired_sub.member_id in due_pcr_members:
                _apply_due_plan_changes(expired_sub.member_id)
            continue

        # Guard de duplicados en la misma corrida: el constraint
        # unique_subscription_member_period es real (hoy 0 casos).
        if attended_key in attended:
            skipped_already += 1
            if expired_sub.member_id in due_pcr_members:
                _apply_due_plan_changes(expired_sub.member_id)
            continue

        # Fase 3 (#1): skip por período propio. Una sucesora que cubre el
        # target de esta candidata la saltea a ella sola; una sucesora de
        # otro mes ya no enmascara una renovación perdida.
        if any(
            start <= target_end and end >= target_start
            for start, end in covered_periods.get(expired_sub.member_id, ())
        ):
            skipped_already += 1
            attended.add(attended_key)
            if expired_sub.member_id in due_pcr_members:
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
            attended.add(attended_key)
            renewed += 1

    plan_changes_applied, plan_changes_failed = _apply_all_due_plan_changes(gym)

    return {
        "renewed": renewed,
        "skipped_already": skipped_already,
        "failed": failed,
        "plan_changes_applied": plan_changes_applied,
        "plan_changes_failed": plan_changes_failed,
        **counters,
    }


# =========================
# Scheduled task runner
# =========================

import time as _time

from .models import TaskRun

TASK_NAME = "subscription_maintenance"


def _task_interval_seconds():
    return getattr(settings, "SCHEDULED_TASKS_INTERVAL_SECONDS", 6 * 60 * 60)


def maybe_run_scheduled_tasks(force=False):
    """Disparador perezoso: camino barato sin claim si no corresponde.

    Chequea la última ejecución con una sola consulta. Solo cuando la tarea
    está vencida (o se fuerza) entra al camino con el claim atómico, que
    hace doble-chequeo para que dos requests concurrentes no la corran dos
    veces.
    """
    from .models import TaskRun as _TaskRun

    now = timezone.now()

    last_run = _TaskRun.objects.filter(name=TASK_NAME).values_list(
        "last_run", flat=True
    ).first()

    if (
        not force
        and last_run is not None
        and (now - last_run).total_seconds() < _task_interval_seconds()
    ):
        return {"ran": False, "reason": "not_due"}

    return run_scheduled_tasks(force=force)


def run_scheduled_tasks(force=False):
    """Ejecuta el mantenimiento de suscripciones exactamente una vez.

    Incluye renovaciones automáticas y cambios de plan vencidos
    (auto_renew_subscriptions ya aplica ambos). La exclusión entre workers
    la da un claim atómico (Fase 4): un ``UPDATE`` condicional sobre
    ``TaskRun.last_run`` en una sola sentencia, sin lock de sesión y sin
    transacción abierta. El advisory lock se descartó porque muerto el
    proceso no se libera y el pooler de PgBouncer (transaction mode) puede
    reasignar la conexión.

    El claim ocurre al inicio: si la corrida muere, no se reintenta hasta que
    venza el intervalo y queda visible como ``last_status == "running"``. A
    cambio ya no hay un ``transaction.atomic()`` gigante: cada renovación es
    atómica por socio (``create_next_subscription``) y el ``TaskRun``
    autocommitea. Un timeout pierde una renovación en vez de 371.
    """
    from .models import TaskRun as _TaskRun

    started = _time.time()
    now = timezone.now()

    run, _ = _TaskRun.objects.get_or_create(
        name=TASK_NAME,
        defaults={
            "last_run": now - timezone.timedelta(days=1),
            "last_status": "ok",
        },
    )

    if not force:
        claimed = _TaskRun.objects.filter(
            name=TASK_NAME,
            last_run__lt=now - timezone.timedelta(seconds=_task_interval_seconds()),
        ).update(last_run=now, last_status="running")
        if not claimed:
            return {"ran": False, "reason": "not_due"}
    else:
        _TaskRun.objects.filter(name=TASK_NAME).update(
            last_run=now, last_status="running"
        )

    status = "ok"
    error = ""
    result = None
    try:
        result = auto_renew_subscriptions()
        no_show = deduct_missed_sessions()
        if isinstance(result, dict) and isinstance(no_show, dict):
            result = {**result, "no_show": no_show}
    except Exception as exc:  # pragma: no cover - defensivo
        status = "error"
        error = f"{type(exc).__name__}: {exc}"
        logger.exception("Scheduled task %s failed", TASK_NAME)

    run.last_run = timezone.now()
    run.last_status = status
    run.last_duration_seconds = _time.time() - started
    run.last_result = result
    run.last_error = error[:5000] if error else ""
    run.save(update_fields=[
        "last_run",
        "last_status",
        "last_duration_seconds",
        "last_result",
        "last_error",
    ])

    return {
        "ran": True,
        "status": status,
        "result": result,
        "error": error or None,
    }



