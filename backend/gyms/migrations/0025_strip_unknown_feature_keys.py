import json

from django.db import migrations

KNOWN_FEATURE_KEYS = {"activities"}

SNAPSHOT_PATH = (
    "gyms/migrations/data/features_cleanup_snapshot.json"
)


def strip_unknown_feature_keys(apps, schema_editor):
    Gym = apps.get_model("gyms", "Gym")
    for gym in Gym.objects.iterator():
        features = gym.features or {}
        cleaned = {k: v for k, v in features.items() if k in KNOWN_FEATURE_KEYS}
        if cleaned != features:
            Gym.objects.filter(pk=gym.pk).update(features=cleaned)


def restore_feature_keys(apps, schema_editor):
    Gym = apps.get_model("gyms", "Gym")
    try:
        with open(SNAPSHOT_PATH, encoding="utf-8") as f:
            rows = json.load(f)
    except FileNotFoundError:
        return
    for row in rows:
        Gym.objects.filter(pk=row["pk"]).update(features=row["features"])


class Migration(migrations.Migration):

    dependencies = [
        ("gyms", "0024_remove_gym_session_recovery_expiration_days"),
    ]

    operations = [
        migrations.RunPython(strip_unknown_feature_keys, restore_feature_keys),
    ]