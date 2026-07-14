from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("subscriptions", "0012_create_subscriptionitem"),
    ]

    operations = [
        # INDEX: auto_renew, end_date — accelerates the renewal algorithm query
        migrations.AddIndex(
            model_name="subscription",
            index=models.Index(
                fields=["auto_renew", "end_date"],
                name="subscriptio_auto_renew_end_date_idx",
            ),
        ),
        # INDEX: member, start_date — accelerates the Phase 2 idempotency check
        migrations.AddIndex(
            model_name="subscription",
            index=models.Index(
                fields=["member", "start_date"],
                name="subscriptio_member_start_date_idx",
            ),
        ),
        # UNIQUE: one subscription per (member, start_date, end_date)
        migrations.AddConstraint(
            model_name="subscription",
            constraint=models.UniqueConstraint(
                fields=["member", "start_date", "end_date"],
                name="unique_subscription_member_period",
            ),
        ),
        # CHECK: end_date >= start_date on Subscription
        migrations.AddConstraint(
            model_name="subscription",
            constraint=models.CheckConstraint(
                condition=models.Q(end_date__gte=models.F("start_date")),
                name="subscription_end_date_gte_start_date",
            ),
        ),
        # CHECK: end_date >= start_date on SubscriptionItem
        migrations.AddConstraint(
            model_name="subscriptionitem",
            constraint=models.CheckConstraint(
                condition=models.Q(end_date__gte=models.F("start_date")),
                name="subscriptionitem_end_date_gte_start_date",
            ),
        ),
    ]
