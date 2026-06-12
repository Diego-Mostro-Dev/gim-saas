from django.contrib import admin
from .models import Subscription, PlanChangeRequest


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = (
        "member",
        "plan",
        "start_date",
        "end_date",
        "paid",
    )

    list_filter = (
        "paid",
        "plan",
    )

    search_fields = (
        "member__first_name",
        "member__last_name",
    )

    readonly_fields = ("end_date",)


@admin.register(PlanChangeRequest)
class PlanChangeRequestAdmin(admin.ModelAdmin):
    list_display = (
        "member",
        "requested_plan",
        "status",
        "requested_at",
        "reviewed_at",
    )

    list_filter = ("status",)

    search_fields = (
        "member__first_name",
        "member__last_name",
    )

    readonly_fields = (
        "gym",
        "member",
        "requested_plan",
        "current_schedules_snapshot",
        "target_schedules_snapshot",
        "status",
        "requested_at",
        "reviewed_at",
        "reviewed_by",
    )