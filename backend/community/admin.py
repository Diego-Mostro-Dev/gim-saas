from django.contrib import admin

from core.admin import GymScopedAdminMixin
from .models import CommunityBusiness


@admin.register(CommunityBusiness)
class CommunityBusinessAdmin(GymScopedAdminMixin, admin.ModelAdmin):
    list_display = ("name", "category", "discount", "gym")
    list_filter = ("gym",)
    search_fields = ("name", "category", "contact")