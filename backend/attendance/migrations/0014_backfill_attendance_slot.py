from django.db import migrations


def backfill_attendance_slot(apps, schema_editor):
    Attendance = apps.get_model("attendance", "Attendance")
    AttendanceSchedule = apps.get_model("attendance", "AttendanceSchedule")
    ScheduleSwapRequest = apps.get_model("attendance", "ScheduleSwapRequest")
    db_alias = schema_editor.connection.alias
    updated = []

    # Regular: schedule exists, swap_request is null -> slot = schedule.slot
    qs = Attendance.objects.using(db_alias).filter(
        schedule__isnull=False,
        swap_request__isnull=True,
        slot__isnull=True,
    ).select_related("schedule__slot")
    for att in qs:
        att.slot = att.schedule.slot
        updated.append(att)

    # Swap: swap_request exists -> slot = swap_request.destination_slot
    qs2 = Attendance.objects.using(db_alias).filter(
        swap_request__isnull=False,
        slot__isnull=True,
    ).select_related("swap_request__destination_slot")
    for att in qs2:
        att.slot = att.swap_request.destination_slot
        updated.append(att)

    if updated:
        Attendance.objects.using(db_alias).bulk_update(updated, ["slot"])


class Migration(migrations.Migration):

    dependencies = [
        ("attendance", "0013_attendance_slot"),
    ]

    operations = [
        migrations.RunPython(
            backfill_attendance_slot,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
