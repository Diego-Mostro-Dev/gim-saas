from django.core.management.base import BaseCommand

from subscriptions.services import run_scheduled_tasks


class Command(BaseCommand):
    help = (
        "Auto-renews eligible subscriptions. "
        "Creates the subscription that immediately follows each member's "
        "latest subscription for members with auto_renew=True. "
        "Safe to run on any day of the month; pending renewals are caught up. "
        "Goes through the scheduled runner (claim + TaskRun) instead of "
        "calling auto_renew_subscriptions() directly, so it never skips the "
        "concurrency guard."
    )

    def handle(self, *args, **options):
        result = run_scheduled_tasks(force=True)

        if not result["ran"]:
            self.stdout.write(f"Skipped: {result['reason']}")
            return

        task_result = result.get("result") or {}
        self.stdout.write(f"Created: {task_result.get('renewed', 0)}")
        self.stdout.write(
            f"Skipped already renewed: {task_result.get('skipped_already', 0)}"
        )
        self.stdout.write(f"Failed: {task_result.get('failed', 0)}")
        self.stdout.write(
            f"Plan changes applied: {task_result.get('plan_changes_applied', 0)}"
        )
        self.stdout.write(
            f"Plan changes failed: {task_result.get('plan_changes_failed', 0)}"
        )
        if status := result.get("status"):
            self.stdout.write(f"Status: {status}")
