from django.db import migrations


def populate_service(apps, schema_editor):
    Gym = apps.get_model("gyms", "Gym")
    Service = apps.get_model("plans", "Service")
    Activity = apps.get_model("activities", "Activity")

    for gym in Gym.objects.iterator():
        service, created = Service.objects.get_or_create(
            gym=gym,
            slug="gym",
            defaults={"name": "Gimnasio", "description": "Acceso al gimnasio", "active": True},
        )
        Activity.objects.filter(gym=gym, service__isnull=True).update(service=service)


class Migration(migrations.Migration):

    dependencies = [
        ("activities", "0002_alter_activity_options_activity_service"),
    ]

    operations = [
        migrations.RunPython(populate_service, reverse_code=migrations.RunPython.noop),
    ]
