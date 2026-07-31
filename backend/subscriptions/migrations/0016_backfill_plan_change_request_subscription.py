from django.db import migrations


def backfill_subscription_fk(apps, schema_editor):
    PlanChangeRequest = apps.get_model("subscriptions", "PlanChangeRequest")
    Subscription = apps.get_model("subscriptions", "Subscription")

    for pcr in PlanChangeRequest.objects.filter(subscription__isnull=True).select_related("member"):
        if pcr.requested_at is None:
            continue

        requested_date = pcr.requested_at.date()

        # Try to find a subscription whose period covers the requested_at date.
        sub = Subscription.objects.filter(
            gym=pcr.gym,
            member=pcr.member,
            start_date__lte=requested_date,
            end_date__gte=requested_date,
        ).order_by("-created_at", "-pk").first()

        # Fallback: most recent subscription for this member at this gym.
        if sub is None:
            sub = Subscription.objects.filter(
                gym=pcr.gym,
                member=pcr.member,
            ).order_by("-created_at", "-pk").first()

        if sub is not None:
            pcr.subscription = sub
            pcr.save(update_fields=["subscription"])


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("subscriptions", "0015_add_subscription_fk_to_plan_change_request"),
    ]

    operations = [
        migrations.RunPython(backfill_subscription_fk, reverse_noop),
    ]
