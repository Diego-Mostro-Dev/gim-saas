from django.contrib import admin
from django.utils.html import format_html
from django.conf import settings

from .models import Gym


@admin.register(Gym)
class GymAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "slug",
        "active",
        "created_at",
        "public_register_link",
    )

    readonly_fields = (
        "onboarding_code",
        "created_at",
        "public_register_link",
    )

    fields = (
        "name",
        "slug",
        "active",
        "onboarding_code",
        "created_at",
        "public_register_link",
    )

    search_fields = (
        "name",
        "slug",
    )

    list_filter = (
        "active",
    )

    def public_register_link(self, obj):
        if not obj.pk:
            return "-"

        url = (
            settings.FRONTEND_URL +
            f"/register/{obj.onboarding_code}"
        )

        return format_html(
            '<a href="{}" target="_blank">{}</a>',
            url,
            url,
        )

    public_register_link.short_description = (
        "Link de registro"
    )