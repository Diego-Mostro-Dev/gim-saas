from django.contrib import admin
from .models import MembershipPlan, Service


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "slug", "gym", "active")
    list_filter = ("gym", "active")
    search_fields = ("name",)


@admin.register(MembershipPlan)
class MembershipPlanAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "service", "price", "duration_days", "weekly_visits", "active", "gym")
    list_filter = ("gym", "service", "active")
    search_fields = ("name",)

    def get_queryset(self, request):
        qs = super().get_queryset(request)

        if request.user.is_superuser:
            return qs

        return qs.filter(gym=request.user.profile.gym)