from datetime import date

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Max

from subscriptions.models import PlanChangeRequest, Subscription
from subscriptions.services import get_first_day_of_next_month, get_last_day_of_month


class Command(BaseCommand):
    help = (
        "Auto-renews eligible subscriptions for the next calendar month. "
        "Creates a subscription for the month following today for members "
        "with auto_renew=True."
    )

    def handle(self, *args, **options):
        today = date.today()
        next_month_start = get_first_day_of_next_month(today)
        next_month_end = get_last_day_of_month(next_month_start)

        members_with_next = set(
            Subscription.objects.filter(
                start_date=next_month_start,
            ).values_list("member_id", flat=True)
        )

        latest_ids = (
            Subscription.objects.values("member_id")
            .annotate(latest_id=Max("id"))
            .values_list("latest_id", flat=True)
        )

        renewed = 0
        skipped_auto_renew = 0
        skipped_already = 0
        skipped_no_prev = 0
        skipped_initial_pending = 0

        for sub in Subscription.objects.filter(
            id__in=latest_ids,
        ).select_related("member", "plan").iterator():

            if not sub.auto_renew:
                skipped_auto_renew += 1
                continue

            if sub.member_id in members_with_next:
                skipped_already += 1
                continue

            # Do not renew a member whose only subscription is unpaid
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
                effective_date__lte=next_month_start,
            ).first()
            plan = approved_pcr.requested_plan if approved_pcr else sub.plan

            with transaction.atomic():
                Subscription.objects.create(
                    gym=sub.gym,
                    member=sub.member,
                    plan=plan,
                    start_date=next_month_start,
                    end_date=next_month_end,
                    paid=False,
                )
            renewed += 1

        self.stdout.write(f"Created: {renewed}")
        self.stdout.write(f"Skipped auto_renew=False: {skipped_auto_renew}")
        self.stdout.write(f"Skipped already renewed: {skipped_already}")
        self.stdout.write(f"Skipped no previous subscription: {skipped_no_prev}")
        self.stdout.write(f"Skipped initial pending: {skipped_initial_pending}")
