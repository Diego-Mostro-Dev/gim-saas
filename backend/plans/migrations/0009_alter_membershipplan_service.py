from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("plans", "0008_populate_service_field"),
    ]

    operations = [
        migrations.AlterField(
            model_name="membershipplan",
            name="service",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="plans",
                to="plans.service",
                verbose_name="Servicio",
            ),
        ),
    ]
