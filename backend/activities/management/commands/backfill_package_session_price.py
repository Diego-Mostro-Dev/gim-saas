from django.core.management.base import BaseCommand

from activities.models import Enrollment


class Command(BaseCommand):
    help = (
        "One-off cleanup: sets session_price=0 (sin cargo) on package "
        "enrollments that have no coseguro defined (session_price IS NULL). "
        "These historical records were broken because enrollment once allowed "
        "a package without a coseguro; they now behave as 'sin cargo'. "
        "Idempotent — only touches records that are still NULL."
    )

    def handle(self, *args, **options):
        qs = Enrollment.objects.filter(
            modality="package",
            session_price__isnull=True,
        )

        total = qs.count()
        self.stdout.write(f"Package enrollments without coseguro: {total}")

        if total == 0:
            self.stdout.write(self.style.SUCCESS("Nothing to backfill."))
            return

        updated = qs.update(session_price=0)
        self.stdout.write(
            self.style.SUCCESS(f"Backfilled session_price=0 on {updated} enrollment(s).")
        )
