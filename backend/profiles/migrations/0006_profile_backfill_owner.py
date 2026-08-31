# Generated manually: backfill role=owner for existing gym assignments.
#
# Before staff existed, every user with a gym assigned was a gym owner
# (created through the public onboarding flow). Mark all of them as owners
# so the GymMeView role restriction does not lock anyone out after the field
# is introduced.

from django.db import migrations


def backfill_owners(apps, schema_editor):
    UserProfile = apps.get_model("profiles", "UserProfile")
    UserProfile.objects.filter(gym__isnull=False).update(role="owner")


class Migration(migrations.Migration):

    dependencies = [
        ("profiles", "0005_userprofile_role"),
    ]

    operations = [
        migrations.RunPython(
            backfill_owners,
            migrations.RunPython.noop,
        ),
    ]
