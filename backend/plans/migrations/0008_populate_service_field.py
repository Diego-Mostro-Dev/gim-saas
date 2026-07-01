from django.db import migrations


def populate_service(apps, schema_editor):
    Gym = apps.get_model("gyms", "Gym")
    Service = apps.get_model("plans", "Service")
    MembershipPlan = apps.get_model("plans", "MembershipPlan")

    for gym in Gym.objects.iterator():
        service, created = Service.objects.get_or_create(
            gym=gym,
            slug="gym",
            defaults={"name": "Gimnasio", "description": "Acceso al gimnasio", "active": True},
        )
        MembershipPlan.objects.filter(gym=gym, service__isnull=True).update(service=service)


class Migration(migrations.Migration):

    dependencies = [
        ("plans", "0007_alter_membershipplan_options_and_more"),
    ]

    operations = [
        migrations.RunPython(populate_service, reverse_code=migrations.RunPython.noop),
    ]
