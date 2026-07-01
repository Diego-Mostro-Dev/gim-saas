from django.contrib import admin

from .models import Activity, ActivitySchedule, Enrollment


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ("name", "service", "active", "created_at")
    list_filter = ("active", "service")
    search_fields = ("name",)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(service__gym=request.user.profile.gym)

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == "service" and not request.user.is_superuser:
            kwargs["queryset"] = db_field.remote_field.model.objects.filter(
                gym=request.user.profile.gym
            )
        return super().formfield_for_foreignkey(db_field, request, **kwargs)


@admin.register(ActivitySchedule)
class ActivityScheduleAdmin(admin.ModelAdmin):
    list_display = ("activity", "day", "start_time", "end_time", "capacity")
    list_filter = ("day",)
    search_fields = ("activity__name",)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(activity__service__gym=request.user.profile.gym)


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ("member", "schedule", "active", "enrolled_at")
    list_filter = ("active",)
    search_fields = ("member__first_name", "member__last_name", "schedule__activity__name")

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(gym=request.user.profile.gym)
