from django.contrib import admin

from .models import Activity, ActivitySchedule, Enrollment


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ("name", "gym", "active", "created_at")
    list_filter = ("active", "gym")
    search_fields = ("name",)


@admin.register(ActivitySchedule)
class ActivityScheduleAdmin(admin.ModelAdmin):
    list_display = ("activity", "day", "start_time", "end_time", "capacity")
    list_filter = ("day",)
    search_fields = ("activity__name",)


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ("member", "schedule", "active", "enrolled_at")
    list_filter = ("active",)
    search_fields = ("member__first_name", "member__last_name", "schedule__activity__name")
