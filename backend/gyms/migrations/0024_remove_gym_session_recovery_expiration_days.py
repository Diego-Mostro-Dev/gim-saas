from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("gyms", "0023_gym_session_recovery_config"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="gym",
            name="session_recovery_expiration_days",
        ),
    ]