from django.core.management.base import BaseCommand

from subscriptions.services import auto_renew_subscriptions


class Command(BaseCommand):
    help = (
        "Auto-renews eligible subscriptions. "
        "Creates the subscription that immediately follows each member's "
        "latest subscription for members with auto_renew=True."
    )

    def handle(self, *args, **options):
        result = auto_renew_subscriptions()

        self.stdout.write(f"Created: {result['renewed']}")
        self.stdout.write(f"Skipped auto_renew=False: {result['skipped_auto_renew']}")
        self.stdout.write(f"Skipped already renewed: {result['skipped_already']}")
        self.stdout.write(f"Skipped no previous subscription: {result['skipped_no_prev']}")
        self.stdout.write(f"Skipped initial pending: {result['skipped_initial_pending']}")
