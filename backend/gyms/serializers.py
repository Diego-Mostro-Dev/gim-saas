from rest_framework import serializers

from .models import Gym


class GymSerializer(serializers.ModelSerializer):
    onboarding_url = serializers.SerializerMethodField()
    register_url = serializers.SerializerMethodField()
    logo_url = serializers.SerializerMethodField()
    app_icon_url = serializers.SerializerMethodField()
    app_icon_favicon_url = serializers.SerializerMethodField()

    class Meta:
        model = Gym
        fields = [
            "id",
            "name",
            "slug",
            "logo",
            "logo_url",
            "app_icon",
            "app_icon_url",
            "app_icon_favicon_url",
            "active",
            "whatsapp",
            "phone",
            "email",
            "default_schedule_capacity",
            "allow_member_schedule_changes",
            "schedule_change_notice_hours",
            "payment_due_day",
            "access_block_day",
            "allow_activity_without_membership",
            "allow_plan_changes",
            "allow_schedule_changes",
            "schedule_change_cooldown_hours",
            "max_schedule_changes_per_month",
            "features",
            "onboarding_code",
            "onboarding_url",
            "register_url",
            "created_at",
        ]
        read_only_fields = [
            "features",
        ]

    def get_onboarding_url(self, obj):
        return obj.get_onboarding_url()

    def get_register_url(self, obj):
        return obj.get_public_register_url()

    def get_logo_url(self, obj):
        if not obj.logo:
            return None

        return obj.logo.url

    def get_app_icon_url(self, obj):
        if not obj.app_icon:
            return None

        return obj.app_icon.url

    def get_app_icon_favicon_url(self, obj):
        if not obj.app_icon:
            return None

        return obj.app_icon.build_url(width=64, height=64, crop="fill", format="png")