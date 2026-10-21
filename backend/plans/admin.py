from django.contrib import admin

from core.admin import GymScopedAdminMixin
from .models import MembershipPlan, Service


@admin.register(Service)
class ServiceAdmin(GymScopedAdminMixin, admin.ModelAdmin):
    list_display = ("id", "name", "slug", "gym", "active")
    list_filter = ("gym", "active")
    search_fields = ("name",)


@admin.register(MembershipPlan)
class MembershipPlanAdmin(GymScopedAdminMixin, admin.ModelAdmin):
    list_display = ("id", "name", "service", "price", "duration_days", "weekly_visits", "active", "gym", "is_base")
    list_filter = ("gym", "service", "active", "is_base")
    search_fields = ("name",)

    def has_change_permission(self, request, obj=None):
        if obj and obj.is_base:
            return False
        return super().has_change_permission(request, obj)

    def has_delete_permission(self, request, obj=None):
        if obj and obj.is_base:
            return False
        return super().has_delete_permission(request, obj)