from datetime import date

from django.db import migrations


def backfill_subscription_fk(apps, schema_editor):
    AttendanceSchedule = apps.get_model("attendance", "AttendanceSchedule")
    Subscription = apps.get_model("subscriptions", "Subscription")

    today = date.today()

    for aSchedule in AttendanceSchedule.objects.filter(subscription__isnull=True):
        # Step 1: find subscription that covers today.
        sub = Subscription.objects.filter(
            gym=aSchedule.gym,
            member=aSchedule.member,
            start_date__lte=today,
            end_date__gte=today,
        ).order_by("-created_at", "-pk").first()

        # Step 2: fallback to most recent subscription at this gym.
        if sub is None:
            sub = Subscription.objects.filter(
                gym=aSchedule.gym,
                member=aSchedule.member,
            ).order_by("-created_at", "-pk").first()

        # Step 3: leave NULL if no subscription exists.
        if sub is not None:
            aSchedule.subscription = sub
            aSchedule.save(update_fields=["subscription"])


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("attendance", "0018_add_subscription_fk_to_attendance_schedule"),
        ("subscriptions", "0016_backfill_plan_change_request_subscription"),
    ]

    operations = [
        migrations.RunPython(backfill_subscription_fk, reverse_noop),
    ]
