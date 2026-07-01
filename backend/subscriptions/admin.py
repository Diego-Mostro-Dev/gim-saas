from django.contrib import admin
from .models import Subscription, SubscriptionItem, PlanChangeRequest


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


@admin.register(SubscriptionItem)
class SubscriptionItemAdmin(admin.ModelAdmin):
    list_display = (
        "subscription",
        "plan",
        "status",
        "start_date",
        "end_date",
        "price_snapshot",
    )

    list_filter = ("status", "plan")

    search_fields = (
        "subscription__member__first_name",
        "subscription__member__last_name",
        "plan__name",
    )

    readonly_fields = ("created_at",)