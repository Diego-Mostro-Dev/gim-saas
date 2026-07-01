from django.db import migrations


def ensure_default_services(apps, schema_editor):
    Gym = apps.get_model("gyms", "Gym")
    Service = apps.get_model("plans", "Service")
    for gym in Gym.objects.all():
        Service.objects.get_or_create(
            gym=gym,
            slug="gym",
            defaults={
                "name": "Gimnasio",
                "description": "Acceso al gimnasio",
                "active": True,
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("gyms", "0010_feature_flags_v1"),
    ]

    operations = [
        migrations.RunPython(ensure_default_services, migrations.RunPython.noop),
    ]
