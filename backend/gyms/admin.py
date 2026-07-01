from django import forms
from django.contrib import admin
from django.utils.html import format_html
from django.conf import settings

from .models import Gym


class GymAdminForm(forms.ModelForm):
    activities = forms.BooleanField(required=False, label="Actividades extra")

    class Meta:
        model = Gym
        exclude = ("features",)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk:
            initial = self.instance.features.get("activities", False)
            self.fields["activities"].initial = initial

    def save(self, commit=True):
        instance = super().save(commit=False)
        features = instance.features or {}
        features["activities"] = self.cleaned_data.get("activities", False)
        instance.features = features
        if commit:
            instance.save()
        return instance


@admin.register(Gym)
class GymAdmin(admin.ModelAdmin):
    form = GymAdminForm

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
            "Características",
            {
                "fields": ("activities",),
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
