from django.contrib import admin

from core.admin import GymScopedAdminMixin
from .models import Subscription, SubscriptionItem, PlanChangeRequest


@admin.register(Subscription)
class SubscriptionAdmin(GymScopedAdminMixin, admin.ModelAdmin):
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

    readonly_fields = ("end_date", "paid")

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PlanChangeRequest)
class PlanChangeRequestAdmin(GymScopedAdminMixin, admin.ModelAdmin):
    list_display = (
        "member",
        "subscription",
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
class SubscriptionItemAdmin(GymScopedAdminMixin, admin.ModelAdmin):
    gym_lookup = "subscription__gym"

    list_display = (
        "subscription",
        "item_type",
        "plan",
        "activity",
        "status",
        "start_date",
        "end_date",
        "price_snapshot",
    )

    list_filter = ("status", "item_type", "plan")

    search_fields = (
        "subscription__member__first_name",
        "subscription__member__last_name",
        "plan__name",
        "activity__name",
    )

    readonly_fields = ("created_at", "price_snapshot")