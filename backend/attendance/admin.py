from django.contrib import admin

from .models import AttendanceSchedule, Attendance, ScheduleSlot


@admin.register(ScheduleSlot)
class ScheduleSlotAdmin(admin.ModelAdmin):
    list_display = (
        "gym",
        "day",
        "hour",
        "capacity",
    )

    list_filter = (
        "day",
        "hour",
    )


@admin.register(AttendanceSchedule)
class AttendanceScheduleAdmin(admin.ModelAdmin):
    list_display = (
        "member",
        "day",
        "hour",
        "slot",
    )

    list_filter = (
        "day",
        "hour",
    )

    search_fields = (
        "member__first_name",
        "member__last_name",
    )


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = (
        "member",
        "schedule",
        "date",
        "created_at",
    )

    list_filter = (
        "date",
    )

    search_fields = (
        "member__first_name",
        "member__last_name",
    )