from datetime import date

from django.core.management.base import BaseCommand, CommandError
from django.shortcuts import get_object_or_404

from gyms.models import Gym
from seed.base import BaseSeeder


class Command(BaseCommand):
    help = "Seed demo data into a target gym (Phase 1: plans, members, subscriptions, payments)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--gym",
            required=True,
            help="Slug of the target gym (e.g. gym-demo, gym-dev)",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Re-seed even if the gym already has data",
        )
        parser.add_argument(
            "--reference-date",
            type=date.fromisoformat,
            help="Base date for all date calculations (YYYY-MM-DD). Defaults to today.",
        )
        parser.add_argument(
            "--preserve-plans",
            action="store_true",
            help="Skip deleting existing plans during cleanup",
        )

    def handle(self, *args, **options):
        gym = get_object_or_404(Gym, slug=options["gym"])

        seeder = BaseSeeder(
            gym=gym,
            ref_date=options.get("reference_date"),
            force=options["force"],
            preserve_plans=options.get("preserve_plans", False),
        )

        if not seeder.needs_seeding():
            self.stdout.write(
                self.style.WARNING(
                    f"SKIP: {gym.name} already has data. Use --force to re-seed."
                )
            )
            return

        if seeder.force:
            self.stdout.write(f"Cleaning existing data for {gym.name}...")
            seeder.cleanup_phase1()

        self.stdout.write(f"Seeding {gym.name}...")
        seeder.seed_phase1()
        seeder.print_summary(self.stdout)

        self.stdout.write(self.style.SUCCESS("Done."))
