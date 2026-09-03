"""
MemberEligibility — single source of truth for member access decisions.

Every operation that asks "can this member do X?" must route through this
service. The service exposes two levels of queries:

1. **can_operate(member)** — the universal gate. Returns True when the
   member's subscription is in good standing and the member is active.
   Used as the pre-condition for: check-in, enrollment, schedule changes,
   plan changes, photo upload, workout logging, and auto-renewal toggling.

2. **has_active_subscription_for_service(member, service)** — a tighter
   check that additionally verifies the subscription date range covers
   today. Used specifically for activity enrollment, where the system
   must confirm the member is paying for the current period.

All subscription-level business logic is delegated to
`subscriptions.domain.SubscriptionDomain`. This module remains the
public API for eligibility checks so that call-sites don't need to
know about the subscription domain directly.
"""

from django.utils import timezone


class MemberEligibility:
    """Central eligibility service for member operations."""

    # -- primary gate -------------------------------------------------------

    @staticmethod
    def can_operate(member) -> bool:
        """Return True if the member is allowed to perform system operations.

        Checks:
        - Member.active is True.
        - The member has a currently-valid Subscription
          (start_date <= today <= end_date).
        - The subscription's payment status is neither "blocked" nor
          "initial_pending" (a member cannot operate until their first
          payment is recorded; see INVARIANT INV-008).

        This is the single function that should guard every member-facing
        write operation (check-in, enrollment, schedule/plan changes, etc.).
        """
        if not member.active:
            return False

        from subscriptions.domain import SubscriptionDomain

        subscription = SubscriptionDomain.get_current_subscription(member)
        if not subscription:
            return False

        status = SubscriptionDomain.get_payment_status(subscription)
        return status not in ("blocked", "initial_pending")

    # -- subscription date-range check --------------------------------------

    @staticmethod
    def has_active_subscription_for_service(member, service) -> bool:
        """Return True if member has a currently-active subscription for *service*.

        Stricter than can_operate: the subscription's date range must
        include today AND the subscription must actually cover the given
        service.

        Membership to a service is materialised through SubscriptionItems:
        a plan item whose MembershipPlan.service matches the service, or an
        activity item whose Activity.service matches. Activities are billed
        as activity items that are created when the member registers or
        enrolls, so a member who pays for activities already has an item
        from registration. This closes the bug where any active
        subscription — e.g. a bare gym or base plan — was enough to enroll
        in unpaid activities.

        Currently used by EnrollmentService to gate activity enrollment.
        """
        from django.db.models import Q
        from subscriptions.models import SubscriptionItem

        now = timezone.localdate()

        return SubscriptionItem.objects.filter(
            subscription__member=member,
            subscription__start_date__lte=now,
            subscription__end_date__gte=now,
            status="active",
        ).filter(
            Q(item_type="plan", plan__service=service)
            | Q(item_type="activity", activity__service=service)
        ).exists()

    # -- subscription data access -------------------------------------------

    @staticmethod
    def get_payment_status(member) -> str:
        """Return the payment-status string for the member's latest subscription.

        Possible values: 'paid', 'initial_pending', 'pending',
        'overdue', 'blocked', or 'none' when no subscription exists.
        """
        from subscriptions.domain import SubscriptionDomain

        return SubscriptionDomain.get_payment_status_for_member(member)

    @staticmethod
    def get_active_subscription(member):
        """Return the member's currently-active Subscription, or the most recent one.

        A subscription is 'active' when start_date <= today <= end_date.
        Falls back to the most-recent subscription of any status when no
        subscription covers today.
        """
        from subscriptions.domain import SubscriptionDomain

        return SubscriptionDomain.get_active_subscription(member)

    @staticmethod
    def get_all_subscriptions(member):
        """Return every subscription for the member, newest first.

        Used by the member portal to display active + upcoming subscriptions.
        """
        from subscriptions.domain import SubscriptionDomain

        return SubscriptionDomain.get_all_subscriptions(member)

    # -- schedule helpers ---------------------------------------------------

    @staticmethod
    def get_schedule_limit(member):
        """Return the weekly-visit limit from the member's plan, or None."""
        from subscriptions.domain import ScheduleDomain

        return ScheduleDomain.get_schedule_limit(member)

    @staticmethod
    def get_active_schedule_count(member):
        """Return the number of active AttendanceSchedule records for the member."""
        from subscriptions.domain import ScheduleDomain

        return ScheduleDomain.get_active_schedule_count(member)
