from django.contrib import admin
from .models import Gym


@admin.register(Gym)
class GymAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "active", "created_at")
    search_fields = ("name", "slug")
    list_filter = ("active",)