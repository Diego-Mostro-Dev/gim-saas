from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("activities", "0003_populate_activity_service"),
    ]

    operations = [
        migrations.AlterField(
            model_name="activity",
            name="service",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="activities",
                to="plans.service",
                verbose_name="Servicio",
            ),
        ),
    ]
