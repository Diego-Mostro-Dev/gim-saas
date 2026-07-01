from django.db import migrations, models
import django.db.models.deletion


def create_subscription_items(apps, schema_editor):
    Subscription = apps.get_model("subscriptions", "Subscription")
    SubscriptionItem = apps.get_model("subscriptions", "SubscriptionItem")

    existing_sub_ids = set(
        SubscriptionItem.objects.values_list("subscription_id", flat=True)
    )

    items = []
    for sub in Subscription.objects.all().select_related("plan").iterator():
        if sub.id in existing_sub_ids:
            continue
        if sub.plan is None:
            continue
        items.append(SubscriptionItem(
            subscription=sub,
            plan=sub.plan,
            status="active",
            price_snapshot=sub.plan.price,
            start_date=sub.start_date,
            end_date=sub.end_date,
        ))

    SubscriptionItem.objects.bulk_create(items)


class Migration(migrations.Migration):

    dependencies = [
        ("subscriptions", "0011_phase8a_request_statuses"),
        ("plans", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="SubscriptionItem",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("active", "Activo"),
                            ("cancelled", "Cancelado"),
                            ("expired", "Vencido"),
                        ],
                        default="active",
                        max_length=20,
                        verbose_name="Estado",
                    ),
                ),
                (
                    "price_snapshot",
                    models.DecimalField(
                        decimal_places=2,
                        max_digits=10,
                        verbose_name="Precio al momento de contratación",
                    ),
                ),
                (
                    "start_date",
                    models.DateField(verbose_name="Fecha de inicio"),
                ),
                (
                    "end_date",
                    models.DateField(verbose_name="Fecha de vencimiento"),
                ),
                (
                    "created_at",
                    models.DateTimeField(
                        auto_now_add=True,
                        verbose_name="Fecha de creación",
                    ),
                ),
                (
                    "plan",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="subscription_items",
                        to="plans.membershipplan",
                        verbose_name="Plan",
                    ),
                ),
                (
                    "subscription",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="items",
                        to="subscriptions.subscription",
                        verbose_name="Suscripción",
                    ),
                ),
            ],
            options={
                "verbose_name": "Item de suscripción",
                "verbose_name_plural": "Items de suscripción",
                "constraints": [
                    models.UniqueConstraint(
                        condition=models.Q(("status", "active")),
                        fields=("subscription", "plan"),
                        name="unique_active_item_per_subscription",
                    ),
                ],
            },
        ),
        migrations.RunPython(
            create_subscription_items,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
