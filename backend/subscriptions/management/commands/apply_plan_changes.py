import logging

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.timezone import now

from subscriptions.models import PlanChangeRequest
from subscriptions.services import apply_plan_change

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Activates approved plan changes whose effective_date has arrived"

    def handle(self, *args, **options):
        today = now().date()

        pending = PlanChangeRequest.objects.filter(
            status="approved",
            effective_date__lte=today,
        ).select_related("member").order_by("requested_at")

        count = 0
        failed = 0
        for pcr in pending:
            try:
                with transaction.atomic():
                    pcr.refresh_from_db()
                    if pcr.status != "approved":
                        continue
                    apply_plan_change(pcr)
                count += 1
            except Exception:
                failed += 1
                logger.exception("Failed to apply plan change %s", pcr.pk)

        self.stdout.write(
            self.style.SUCCESS(
                f"Applied {count} plan change(s)."
            )
        )
        if failed:
            self.stdout.write(
                self.style.WARNING(
                    f"Failed {failed} plan change(s)."
                )
            )
