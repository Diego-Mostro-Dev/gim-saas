from django.db import migrations


def backfill_enrollment_subscription_item(apps, schema_editor):
    Enrollment = apps.get_model("activities", "Enrollment")
    SubscriptionItem = apps.get_model("subscriptions", "SubscriptionItem")

    for enrollment in Enrollment.objects.filter(
        subscription_item__isnull=True
    ).select_related("schedule__activity"):
        activity = enrollment.schedule.activity

        # Step 1: active SubscriptionItem for this gym, member, activity.
        item = SubscriptionItem.objects.filter(
            subscription__gym=enrollment.gym,
            subscription__member=enrollment.member,
            activity=activity,
            item_type="activity",
            status="active",
        ).order_by(
            "-subscription__created_at", "-pk"
        ).first()

        # Step 2: any historical SubscriptionItem (same gym, member, activity).
        if item is None:
            item = SubscriptionItem.objects.filter(
                subscription__gym=enrollment.gym,
                subscription__member=enrollment.member,
                activity=activity,
            ).order_by(
                "-subscription__created_at", "-pk"
            ).first()

        # Step 3: leave NULL if none found.
        if item is not None:
            enrollment.subscription_item = item
            enrollment.save(update_fields=["subscription_item"])


def reverse_noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
    ("activities", "0008_add_subscription_item_fk_to_enrollment"),
    ("subscriptions", "0012_create_subscriptionitem"),
    ]

    operations = [
        migrations.RunPython(backfill_enrollment_subscription_item, reverse_noop),
    ]
