from django.db import migrations


def migrate_extras_to_activities(apps, schema_editor):
    Gym = apps.get_model("gyms", "Gym")
    for gym in Gym.objects.iterator():
        features = gym.features
        if not features:
            continue
        if "extras" in features and "activities" not in features:
            features["activities"] = features["extras"]
        if "extras" in features:
            del features["extras"]
            Gym.objects.filter(pk=gym.pk).update(features=features)


class Migration(migrations.Migration):

    dependencies = [
        ("gyms", "0011_ensure_default_services"),
    ]

    operations = [
        migrations.RunPython(migrate_extras_to_activities),
    ]
