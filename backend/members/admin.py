from django.contrib import admin
from .models import Member


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ("first_name", "last_name", "gym", "active")
    list_filter = ("gym", "active")
    search_fields = ("first_name", "last_name", "phone")

    def get_queryset(self, request):
        qs = super().get_queryset(request)

        if request.user.is_superuser:
            return qs

        return qs.filter(gym=request.user.profile.gym)