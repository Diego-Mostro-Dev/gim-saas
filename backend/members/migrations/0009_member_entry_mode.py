# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("members", "0008_alter_member_options_alter_member_access_token_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="member",
            name="entry_mode",
            field=models.CharField(
                choices=[("GYM", "Gimnasio"), ("ACTIVITY_ONLY", "Solo actividades")],
                default="GYM",
                max_length=20,
                verbose_name="Modo de ingreso",
            ),
        ),
    ]
