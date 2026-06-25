from django.contrib import admin
from django.utils.html import format_html
from django.conf import settings

from .models import Gym


def _features_help_text() -> str:
    lines = ["Formato: {\"feature_name\": true, \"feature_name\": false}"]
    for name, meta in Gym.FEATURE_REGISTRY.items():
        lines.append(f"  • {name} — {meta['label']} (default: {meta['default']})")
    return "\n".join(lines)


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

    fieldsets = [
        (
            None,
            {
                "fields": (
                    "name", "slug", "active",
                    "onboarding_code", "created_at", "public_register_link",
                )
            },
        ),
        (
            "Configuración de Pagos",
            {
                "fields": (
                    "payment_due_day", "access_block_day",
                )
            },
        ),
        (
            "Configuración de Planes y Horarios",
            {
                "fields": (
                    "allow_plan_changes", "allow_schedule_changes",
                    "schedule_change_cooldown_hours",
                    "max_schedule_changes_per_month",
                    "schedule_change_notice_days",
                )
            },
        ),
        (
            "Feature Flags",
            {
                "fields": ("features",),
                "description": _features_help_text(),
            },
        ),
    ]

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