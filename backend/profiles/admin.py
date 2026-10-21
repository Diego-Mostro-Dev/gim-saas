# profiles/admin.py
from django.contrib import admin

from core.admin import GymScopedAdminMixin
from .models import UserProfile


@admin.register(UserProfile)
class UserProfileAdmin(GymScopedAdminMixin, admin.ModelAdmin):
    list_display = ("user", "gym", "role")