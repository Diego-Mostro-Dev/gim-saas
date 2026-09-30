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

from decimal import ROUND_HALF_UP, Decimal

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
        from .services import (
            ensure_pt_items_for_active_assignments,
            ensure_subscription_item,
            member_discount_percent,
        )

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
            # Fase 7 (P5): el descuento se congela una vez por período, en el
            # mismo punto donde la Fase 5 puso sus guards. Así desactivar el
            # descuento después no altera un período ya facturado.
            sub = Subscription.objects.create(
                gym=member.gym,
                member=member,
                plan=plan,
                start_date=start_date,
                end_date=end_date,
                paid=paid,
                auto_renew=auto_renew,
                origin=origin,
                discount_percent_snapshot=member_discount_percent(member),
            )

            ensure_subscription_item(sub)

            # Fase 5 (#2): una asignación de PT activa sin ítem en la
            # suscripción recién abierta no debe quedar sin facturar.
            ensure_pt_items_for_active_assignments(member, sub)

            return sub

    @staticmethod
    def mutate_membership(*, member, comp=False, plan=None, origin="plan_change"):
        """Reclassify a live membership in place, keeping the same period.

        Used by the staff member-edition form for the "pase de cortesía"
        toggle so enrollments keep pointing at their SubscriptionItem:

        - comp=True: switches the current period to the free base plan.
          Only the days already served are billed, prorated by day; the
          rest of the period stops being charged. Any difference becomes
          an overpayment (see sync_subscription_paid).
        - comp=False: switches to a paid plan (base plan when the member
          is activity-only). Prices are restored and prorated by the days
          left in the period, so the member generates a balance for
          exactly what remains.

        Both directions bill the days the member spends in the state that
        is in force *after* the transition, the day of the transition
        counting towards the new state (Fase 7.1, P3).

        When the member has no subscription covering today, a new one is
        opened for the current month. That period starts today, so it is
        billed whole and no proration applies.

        ``paid`` is never written by hand: it is derived from the real
        balance by ``sync_subscription_paid`` at the end of each branch.

        Args:
            member: The Member instance.
            comp: Whether to apply the courtesy-pass reclassification.
            plan: The paid MembershipPlan (required when comp=False unless
                the member is activity-only).
            origin: Subscription.ORIGIN_CHOICES value for new subscriptions.

        Returns:
            The (possibly new) Subscription covering today.
        """
        from django.db import transaction

        from .models import Subscription, SubscriptionItem
        from .services import sync_subscription_paid

        today = timezone.localdate()

        with transaction.atomic():
            current = Subscription.objects.select_for_update().filter(
                member=member,
                start_date__lte=today,
                end_date__gte=today,
            ).order_by("-created_at").first()

            if current is not None:
                billable, period_days = SubscriptionDomain._proration_days(
                    current, today, comp
                )

                if comp:
                    from plans.services import ensure_base_plan_for_gym

                    base_plan = ensure_base_plan_for_gym(member.gym)
                    current.plan = base_plan
                    current.auto_renew = True
                    current.save(update_fields=["plan", "auto_renew"])

                    # Only the days already served keep being billed; the rest
                    # of the period stops being charged. The price line has to
                    # read the contract price *before* the plan item is moved
                    # to the free base plan below, or it reads 0.
                    for item in SubscriptionItem.objects.filter(
                        subscription=current, status="active"
                    ).select_related(
                        "plan", "activity", "outing", "personal_training"
                    ):
                        item.price_snapshot = SubscriptionDomain._prorate(
                            SubscriptionDomain._item_contract_price(item),
                            billable,
                            period_days,
                        )
                        if item.item_type == "plan":
                            item.plan = base_plan
                            item.name_snapshot = base_plan.name
                        item.save(
                            update_fields=["price_snapshot", "plan", "name_snapshot"]
                        )

                    # Neutralize any pending package co-pay balances: courtesy
                    # members are never billed, so their packages are zeroed.
                    SubscriptionDomain._neutralize_comp_package_balances(member)
                else:
                    if plan is None:
                        raise SubscriptionConflictError(
                            "Para quitar el pase de cortesía hay que elegir "
                            "un plan de membresía."
                        )

                    current.plan = plan
                    current.save(update_fields=["plan"])

                    plan_item = SubscriptionItem.objects.filter(
                        subscription=current,
                        item_type="plan",
                        status="active",
                    ).first()
                    if plan_item is not None:
                        plan_item.plan = plan
                        plan_item.price_snapshot = SubscriptionDomain._prorate(
                            plan.price, billable, period_days
                        )
                        plan_item.name_snapshot = plan.name
                        plan_item.save(
                            update_fields=["plan", "price_snapshot", "name_snapshot"]
                        )

                    # Restore monthly billing for active activities, outings
                    # and monthly PT (their snapshots were prorated down while
                    # comp was active), for the days left in the period.
                    for item in SubscriptionItem.objects.filter(
                        subscription=current,
                        item_type__in=("activity", "outing", "personal_training"),
                        status="active",
                    ).select_related("activity", "outing", "personal_training"):
                        item.price_snapshot = SubscriptionDomain._prorate(
                            SubscriptionDomain._item_contract_price(item),
                            billable,
                            period_days,
                        )
                        item.save(update_fields=["price_snapshot"])

                    # Restore package co-pay balances that were zeroed while
                    # comp was active: session_price back from the insurance,
                    # amount_paid recomputed from the session payments.
                    SubscriptionDomain._restore_comp_package_balances(member)

                # ``paid`` is derived from the balance, never written here:
                # it has to run after the items are rewritten, because
                # calculate_subscription_total reads them back from the DB.
                sync_subscription_paid(current)

                return current

            # No subscription covers today → open one for the current month.
            from .services import get_last_day_of_month

            if comp:
                from plans.services import ensure_base_plan_for_gym

                target_plan = ensure_base_plan_for_gym(member.gym)
            else:
                if plan is None:
                    raise SubscriptionConflictError(
                        "Es necesario elegir un plan de membresía."
                    )
                target_plan = plan

            opened = SubscriptionDomain.open_subscription(
                member=member,
                plan=target_plan,
                start_date=today,
                end_date=get_last_day_of_month(today),
                paid=comp,
                auto_renew=True,
                origin=origin,
            )

            if comp:
                SubscriptionDomain._neutralize_comp_package_balances(member)
            else:
                SubscriptionDomain._restore_comp_package_balances(member)

            return opened

    @staticmethod
    def _proration_days(subscription, today, comp):
        """Return (billable_days, period_days) for a courtesy-pass transition.

        Fase 7.1 (P3). The period in course is billed only for the days the
        member spends in the state that is in force *after* the transition,
        and the day of the transition counts towards the new state:

        - comp=True (pass granted): what was already served before today, so
          the days are ``today - start_date``.
        - comp=False (pass removed): what is left, so the days are
          ``end_date - today + 1`` (today included).

        The denominator is the real length of the period, which for a regular
        calendar month equals the days in the month.

        Args:
            subscription: The Subscription covering the transition.
            today: The transition date.
            comp: The state the member is moving into.

        Returns:
            A (billable, period_days) tuple of ints, both clamped so that
            billable never leaves [0, period_days].
        """
        period_days = (subscription.end_date - subscription.start_date).days + 1
        if period_days <= 0:
            period_days = 1

        if comp:
            billable = (today - subscription.start_date).days
        else:
            billable = (subscription.end_date - today).days + 1

        return max(0, min(billable, period_days)), period_days

    @staticmethod
    def _item_contract_price(item):
        """Return the full contract price of an item, whatever its state.

        Proration starts from the contract price, never from the current
        ``price_snapshot``: snapshots may already be prorated, and prorating
        one of those compounds the factor when the pass is toggled twice in
        the same period.

        Args:
            item: A SubscriptionItem with its related objects selected.

        Returns:
            A Decimal, 0 when the item has no related object to bill.
        """
        if item.item_type == "plan":
            return item.plan.price if item.plan is not None else Decimal("0")
        if item.item_type == "activity":
            if item.activity is None:
                return Decimal("0")
            return item.activity.monthly_price
        if item.item_type == "outing":
            if item.outing is None:
                return Decimal("0")
            return item.outing.monthly_price
        if item.item_type == "personal_training":
            if item.personal_training is None:
                return Decimal("0")
            return item.personal_training.monthly_price
        return item.price_snapshot

    @staticmethod
    def _prorate(amount, billable, period_days):
        """Return ``amount`` scaled by billable/period_days, half-up to cents.

        A fully billable period returns ``amount`` untouched, so the common
        whole-month case carries no rounding drift.
        """
        if amount is None:
            return Decimal("0")
        if billable >= period_days:
            return amount
        if billable <= 0:
            return Decimal("0")

        prorated = (amount * Decimal(billable)) / Decimal(period_days)
        return prorated.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    @staticmethod
    def _neutralize_comp_package_balances(member):
        """Zero pending package co-pay balances for a courtesy-pass member.

        Courtesy members are never billed, so any active package enrollment
        that still carries a session price or an accumulated payment is reset
        across the three package kinds: activity enrollments, PT assignments
        and outing enrollments.
        """
        from activities.models import Enrollment
        from outings.models import OutingEnrollment
        from personal_training.models import PersonalTrainingAssignment

        for model in (Enrollment, PersonalTrainingAssignment, OutingEnrollment):
            SubscriptionDomain._neutralize_package_fields(
                SubscriptionDomain._package_queryset(model, member)
            )

    @staticmethod
    def _package_queryset(model, member):
        """Active package records of ``member`` that carry a session price."""
        return model.objects.filter(member=member, active=True).exclude(
            modality="monthly", session_price=None
        )

    @staticmethod
    def _neutralize_package_fields(packages):
        """Write session_price and amount_paid to 0 on package records.

        Shared by the three package kinds. Only saves records that actually
        changed, so untouched packages aren't rewritten.
        """
        for package in packages:
            update_fields = []
            if package.session_price is not None and package.session_price != 0:
                package.session_price = Decimal("0")
                update_fields.append("session_price")
            if package.amount_paid is not None and package.amount_paid != 0:
                package.amount_paid = Decimal("0")
                update_fields.append("amount_paid")
            if update_fields:
                package.save(update_fields=update_fields)

    @staticmethod
    def _restore_comp_package_balances(member):
        """Bring package co-pay balances back when a member leaves the courtesy pass.

        The twin of ``_neutralize_comp_package_balances``. ``amount_paid`` is
        recomputed from the session payments (its canonical source), and
        ``session_price`` is refreshed from the member's current insurance the
        same way ``renew_package`` does; with no insurance the co-pay is 0
        ("sin cargo"), matching the backfill convention.

        Edge to be aware of (documented in the plan): a co-pay that was set by
        staff to a value different from ``insurance.session_price`` (or a
        member with no insurance) is restored to the insurance rate, not to
        the hand-written original. The Fase 7 real-money impact is $0.
        """
        from activities.models import Enrollment
        from outings.models import OutingEnrollment
        from personal_training.models import PersonalTrainingAssignment

        session_price = Decimal("0")
        insurance = getattr(member, "insurance", None)
        if insurance is not None:
            session_price = insurance.session_price or Decimal("0")

        from payments.services import (
            sync_assignment_paid,
            sync_enrollment_paid,
            sync_outing_paid,
        )

        for enrollment in SubscriptionDomain._package_queryset(
            Enrollment, member
        ):
            enrollment.session_price = session_price
            enrollment.save(update_fields=["session_price"])
            sync_enrollment_paid(enrollment)

        for assignment in SubscriptionDomain._package_queryset(
            PersonalTrainingAssignment, member
        ):
            assignment.session_price = session_price
            assignment.save(update_fields=["session_price"])
            sync_assignment_paid(assignment)

        for enrollment in SubscriptionDomain._package_queryset(
            OutingEnrollment, member
        ):
            enrollment.session_price = session_price
            enrollment.save(update_fields=["session_price"])
            sync_outing_paid(enrollment)

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
