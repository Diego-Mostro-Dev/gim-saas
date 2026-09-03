"""
SubscriptionDomain — central service for subscription operations.

This module establishes Subscription as the aggregate root.
All business decisions about eligibility, billing, schedule limits,
and enrollment consequences flow through this service.

Design principle:
- Member is the identity (authentication, display, token lookup).
- Subscription is the contract (eligibility, billing, schedule limits).
- AttendanceSchedule and Enrollment are operational consequences
  of the subscription contract.

Every public method in this file should accept a Subscription object
as its primary parameter (or derive it from a Member when the subscription
is not yet known). This is the opposite of the old pattern where
Subscription was always looked up FROM Member.
"""

from django.utils import timezone

from attendance.models import DAY_CHOICES

DAY_LABELS = dict(DAY_CHOICES)


class ScheduleError(ValueError):
    """Raised when a schedule operation fails (slot not found, capacity full)."""

    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.status_code = status_code


class SubscriptionConflictError(ValueError):
    """Raised when a subscription cannot be created due to a scheduling conflict."""

    def __init__(self, message, status_code=400):
        super().__init__(message)
        self.status_code = status_code


class SubscriptionDomain:
    """Central service for subscription-level business decisions."""

    @staticmethod
    def open_subscription(*, member, plan, start_date, end_date, paid=False,
                          auto_renew=True, origin="onboarding"):
        """Create a Subscription through the single canonical entry point.

        All subscription creation MUST eventually call this method.
        Dates must be pre-calculated by the caller.

        Validates:
        1. No overlapping subscription exists for this member.

        Args:
            member: The Member instance.
            plan: The MembershipPlan instance.
            start_date: Subscription start date (must be provided).
            end_date: Subscription end date (must be provided).
            paid: Whether the subscription is paid.
            auto_renew: Whether auto-renewal is enabled.
            origin: One of ORIGIN_CHOICES on Subscription.

        Returns:
            The created Subscription instance.

        Raises:
            SubscriptionConflictError: If any validation fails.
        """
        from django.db import transaction
        from .models import Subscription
        from .services import ensure_subscription_item

        if start_date is None or end_date is None:
            raise SubscriptionConflictError(
                "start_date y end_date son obligatorios."
            )

        if end_date < start_date:
            raise SubscriptionConflictError(
                "end_date no puede ser anterior a start_date."
            )

        with transaction.atomic():
            existing_subs = Subscription.objects.select_for_update().filter(
                member=member,
            )

            # ── Rule: no overlapping subscription ────────────────────────
            overlap = existing_subs.filter(
                start_date__lte=end_date,
                end_date__gte=start_date,
            ).first()
            if overlap is not None:
                raise SubscriptionConflictError(
                    f"Ya existe una suscripción que se superpone: "
                    f"{overlap.start_date} → {overlap.end_date}."
                )

            # ── Create ───────────────────────────────────────────────────
            sub = Subscription.objects.create(
                gym=member.gym,
                member=member,
                plan=plan,
                start_date=start_date,
                end_date=end_date,
                paid=paid,
                auto_renew=auto_renew,
                origin=origin,
            )

            ensure_subscription_item(sub)

            return sub

    @staticmethod
    def get_active_subscription(member):
        """Return the member's currently-active Subscription, or the most recent one.

        A subscription is 'active' when start_date <= today <= end_date.
        Falls back to the most-recent subscription of any status when no
        subscription covers today.
        """
        from .models import Subscription

        today = timezone.localdate()

        active = Subscription.objects.filter(
            member=member,
            start_date__lte=today,
            end_date__gte=today,
        ).order_by("-created_at").first()

        if active:
            return active

        return Subscription.objects.filter(
            member=member,
            start_date__lte=today,
        ).order_by("-created_at").first()

    @staticmethod
    def get_current_subscription(member):
        """Return the member's currently-active Subscription, or None.

        A subscription is 'current' when start_date <= today <= end_date.
        Unlike get_active_subscription, this does NOT fall back to past
        subscriptions — only a subscription covering today qualifies.
        """
        from .models import Subscription

        today = timezone.localdate()

        return Subscription.objects.filter(
            member=member,
            start_date__lte=today,
            end_date__gte=today,
        ).order_by("-created_at").first()

    @staticmethod
    def get_all_subscriptions(member):
        """Return every subscription for the member, newest first."""
        from .models import Subscription

        return Subscription.objects.filter(
            member=member,
        ).order_by("-created_at")

    @staticmethod
    def get_payment_status(subscription):
        """Return the payment-status string for a subscription.

        Possible values: 'paid', 'initial_pending', 'pending',
        'overdue', 'blocked'.
        """
        from .services import get_subscription_payment_status

        return get_subscription_payment_status(subscription)

    @staticmethod
    def get_payment_status_for_member(member):
        """Return payment status for a member's latest subscription.

        Returns 'none' when no subscription exists.
        """
        sub = SubscriptionDomain.get_active_subscription(member)
        if not sub:
            return "none"
        return SubscriptionDomain.get_payment_status(sub)

    @staticmethod
    def resolve_gym(member):
        """Resolve the gym from a member's active subscription.

        Falls back to member.gym when no subscription exists.
        This is the canonical way to resolve gym context when the
        subscription is the business root.
        """
        sub = SubscriptionDomain.get_active_subscription(member)
        if sub is not None:
            return sub.gym
        return member.gym


class ScheduleDomain:
    """Central service for AttendanceSchedule write operations.

    All AttendanceSchedule mutations (create, activate, deactivate, sync)
    go through this service to ensure consistent validation and behavior.
    """

    @staticmethod
    def get_schedule_limit(member):
        """Return the weekly-visit limit from the member's plan, or None."""
        sub = SubscriptionDomain.get_current_subscription(member)
        if sub is None:
            return None
        return sub.plan.weekly_visits

    @staticmethod
    def get_active_schedule_count(member):
        """Return the number of active AttendanceSchedule records."""
        return member.schedules.filter(active=True).count()

    @staticmethod
    def validate_slot(gym, day, hour):
        """Look up a ScheduleSlot and verify capacity.

        Returns the ScheduleSlot if valid.
        Raises ScheduleError if the slot doesn't exist or is full.
        """
        from attendance.models import AttendanceSchedule, ScheduleSlot

        try:
            slot = ScheduleSlot.objects.get(gym=gym, day=day, hour=hour)
        except ScheduleSlot.DoesNotExist:
            raise ScheduleError(
                f"El horario {DAY_LABELS.get(day, day)} {hour} no está disponible."
            )

        cap = slot.capacity or gym.default_schedule_capacity
        if cap is not None:
            current_count = AttendanceSchedule.objects.filter(
                gym=gym, slot=slot, active=True
            ).count()
            if current_count >= cap:
                raise ScheduleError(
                    f"El horario {DAY_LABELS.get(day, day)} {hour} está completo."
                )

        return slot

    @staticmethod
    def activate_schedule(member, gym, slot, subscription=None):
        """Reactivate an existing schedule or create a new one."""
        from attendance.models import AttendanceSchedule

        existing = AttendanceSchedule.objects.filter(
            member=member, slot=slot
        ).first()

        if existing:
            if not existing.active:
                update_fields = ["active"]
                existing.active = True
                if subscription is not None:
                    existing.subscription = subscription
                    update_fields.append("subscription")
                existing.save(update_fields=update_fields)
            elif subscription is not None and existing.subscription is None:
                existing.subscription = subscription
                existing.save(update_fields=["subscription"])
            return existing

        return AttendanceSchedule.objects.create(
            member=member, gym=gym, slot=slot, active=True,
            subscription=subscription,
        )

    @staticmethod
    def deactivate_all(member):
        """Deactivate all active schedules for a member."""
        from attendance.models import AttendanceSchedule

        AttendanceSchedule.objects.filter(
            member=member, active=True
        ).update(active=False)

    @staticmethod
    def create_bulk(member, gym, schedules, subscription=None):
        """Validate and bulk-create schedules from a list of {day, hour} dicts."""
        from attendance.models import AttendanceSchedule

        slots = []
        for s in schedules:
            slot = ScheduleDomain.validate_slot(gym, s["day"], s["hour"])
            slots.append(
                AttendanceSchedule(member=member, gym=gym, slot=slot, subscription=subscription)
            )

        return AttendanceSchedule.objects.bulk_create(slots)

    @staticmethod
    def sync_schedules(member, gym, target_schedules, subscription=None):
        """Diff current schedules against target and apply changes.

        target_schedules: list of dicts with 'day' and 'hour' keys.
        Deactivates schedules not in target, activates or creates missing ones.
        Silently skips slots that no longer exist. Validates capacity before
        adding a member to a slot, excluding the member being edited so an
        existing/re-added slot does not count them twice.
        """
        from attendance.models import AttendanceSchedule, ScheduleSlot

        current = {
            (s.slot.day, s.slot.hour.strftime("%H:%M")): s
            for s in AttendanceSchedule.objects.filter(
                member=member
            ).select_related("slot")
        }

        target_keys = {(s["day"], s["hour"]) for s in target_schedules}

        for key, schedule in current.items():
            if schedule.active and key not in target_keys:
                schedule.active = False
                schedule.save(update_fields=["active"])

        for day, hour in target_keys:
            key = (day, hour)
            try:
                slot = ScheduleSlot.objects.get(gym=gym, day=day, hour=hour)
            except ScheduleSlot.DoesNotExist:
                continue

            cap = slot.capacity or gym.default_schedule_capacity
            if cap is not None:
                current_count = AttendanceSchedule.objects.filter(
                    gym=gym, slot=slot, active=True,
                ).exclude(member=member).count()
                already_has = (
                    key in current
                    and current[key].active
                )
                if not already_has and current_count >= cap:
                    raise ScheduleError(
                        f"El horario {DAY_LABELS.get(day, day)} {hour} está completo."
                    )

            if key in current:
                schedule = current[key]
                if not schedule.active:
                    update_fields = ["active"]
                    schedule.active = True
                    if subscription is not None:
                        schedule.subscription = subscription
                        update_fields.append("subscription")
                    schedule.save(update_fields=update_fields)
            else:
                AttendanceSchedule.objects.create(
                    member=member, gym=gym, slot=slot, active=True,
                    subscription=subscription,
                )
