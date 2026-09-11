from django.db import migrations, models


def migrate_available_to_scheduled(apps, schema_editor):
    SessionRecovery = apps.get_model("attendance", "SessionRecovery")
    SessionRecovery.objects.filter(status="available").update(status="scheduled")


class Migration(migrations.Migration):

    dependencies = [
        ("attendance", "0023_add_scheduled_recovery_status"),
    ]

    operations = [
        migrations.RunPython(
            migrate_available_to_scheduled,
            migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name="sessionrecovery",
            name="status",
            field=models.CharField(
                choices=[
                    ("scheduled", "Programada"),
                    ("used", "Usada"),
                    ("cancelled", "Cancelada"),
                    ("expired", "Expirada"),
                ],
                default="scheduled",
                max_length=20,
                verbose_name="Estado",
            ),
        ),
    ]