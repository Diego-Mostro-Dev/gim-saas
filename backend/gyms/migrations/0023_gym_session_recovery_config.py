from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("gyms", "0022_discount"),
    ]

    operations = [
        migrations.AddField(
            model_name="gym",
            name="allow_session_recovery",
            field=models.BooleanField(default=False, verbose_name="Permitir recuperación de clases"),
        ),
        migrations.AddField(
            model_name="gym",
            name="max_session_recoveries_per_month",
            field=models.PositiveIntegerField(default=2, verbose_name="Máximo de recuperaciones por mes"),
        ),
        migrations.AddField(
            model_name="gym",
            name="session_recovery_expiration_days",
            field=models.PositiveIntegerField(default=30, verbose_name="Días de expiración de la recuperación"),
        ),
    ]