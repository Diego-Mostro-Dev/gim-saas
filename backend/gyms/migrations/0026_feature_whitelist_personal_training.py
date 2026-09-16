from django.db import migrations

KNOWN_FEATURE_KEYS = {"activities", "personal_training"}


def strip_unknown_feature_keys(apps, schema_editor):
    Gym = apps.get_model("gyms", "Gym")
    for gym in Gym.objects.iterator():
        features = gym.features or {}
        cleaned = {k: v for k, v in features.items() if k in KNOWN_FEATURE_KEYS}
        if cleaned != features:
            Gym.objects.filter(pk=gym.pk).update(features=cleaned)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("gyms", "0025_strip_unknown_feature_keys"),
    ]

    operations = [
        migrations.RunPython(strip_unknown_feature_keys, noop),
    ]
