from django.contrib import admin

from .models import AttendanceSchedule


@admin.register(AttendanceSchedule)
class AttendanceScheduleAdmin(admin.ModelAdmin):
    list_display = ("member", "day")
    list_filter = ("day",)
    search_fields = (
        "member__first_name",
        "member__last_name",
    )