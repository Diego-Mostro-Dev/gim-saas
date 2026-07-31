from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("subscriptions", "0016_backfill_plan_change_request_subscription"),
    ]

    operations = [
        migrations.AddField(
            model_name="subscription",
            name="origin",
            field=models.CharField(
                choices=[
                    ("onboarding", "Alta"),
                    ("manual_renewal", "Renovación manual"),
                    ("auto_renewal", "Renovación automática"),
                    ("plan_change", "Cambio de plan"),
                ],
                default="onboarding",
                help_text="Flujo que originó esta suscripción (auditoría).",
                max_length=20,
                verbose_name="Origen",
            ),
        ),
    ]
