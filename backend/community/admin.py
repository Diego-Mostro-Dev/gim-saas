from django.contrib import admin

from .models import CommunityBusiness


@admin.register(CommunityBusiness)
class CommunityBusinessAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "discount", "gym")
    list_filter = ("gym",)
    search_fields = ("name", "category", "contact")