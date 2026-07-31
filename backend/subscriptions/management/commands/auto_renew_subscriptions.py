from django.core.management.base import BaseCommand

from subscriptions.services import auto_renew_subscriptions


class Command(BaseCommand):
    help = (
        "Auto-renews eligible subscriptions. "
        "Creates the subscription that immediately follows each member's "
        "latest subscription for members with auto_renew=True. "
        "Safe to run on any day of the month; pending renewals are caught up."
    )

    def handle(self, *args, **options):
        result = auto_renew_subscriptions()

        self.stdout.write(f"Created: {result['renewed']}")
        self.stdout.write(f"Skipped already renewed: {result['skipped_already']}")
        self.stdout.write(f"Failed: {result['failed']}")
