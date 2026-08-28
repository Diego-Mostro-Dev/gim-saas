from django.db import migrations


def enable_activity_without_membership(apps, schema_editor):
    """Force the flag on so base-plan (activity-only) members always renew.

    The staff-facing toggle was removed from the settings UI. Today the
    intended behaviour is that activity-only members renew automatically
    like any other member, so existing gyms with the flag off are flipped
    on. The field stays for potential future re-exposure.
    """
    Gym = apps.get_model("gyms", "Gym")
    Gym.objects.filter(allow_activity_without_membership=False).update(
        allow_activity_without_membership=True
    )


class Migration(migrations.Migration):

    dependencies = [
        ("gyms", "0013_gym_allow_activity_without_membership"),
    ]

    operations = [
        migrations.RunPython(
            enable_activity_without_membership,
            migrations.RunPython.noop,
        ),
    ]
