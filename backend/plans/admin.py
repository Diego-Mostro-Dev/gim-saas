from django.contrib import admin
from .models import MembershipPlan


@admin.register(MembershipPlan)
class MembershipPlanAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "price", "gym")
    list_filter = ("gym",)
    search_fields = ("name",)

    def get_queryset(self, request):
        qs = super().get_queryset(request)

        if request.user.is_superuser:
            return qs

        return qs.filter(gym=request.user.profile.gym)