from rest_framework import serializers

from .labels import get_gym_labels
from .models import Discount, Gym, GymClosedDate


class DiscountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Discount
        fields = ["id", "name", "discount_percent", "active", "created_at"]
        read_only_fields = ["gym", "created_at"]

    def validate_discount_percent(self, value):
        if value < 1 or value > 100:
            raise serializers.ValidationError(
                "El porcentaje debe estar entre 1 y 100."
            )
        return value


class GymClosedDateSerializer(serializers.ModelSerializer):
    class Meta:
        model = GymClosedDate
        fields = ["id", "date", "reason"]


class GymSerializer(serializers.ModelSerializer):
    onboarding_url = serializers.SerializerMethodField()
    register_url = serializers.SerializerMethodField()
    logo_url = serializers.SerializerMethodField()
    app_icon_url = serializers.SerializerMethodField()
    app_icon_favicon_url = serializers.SerializerMethodField()
    labels = serializers.SerializerMethodField()

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
            "qr_attendance_message",
            "qr_registration_message",
            "seo_title",
            "seo_description",
            "seo_keywords",
            "seo_city",
            "seo_address",
            "seo_hours",
            "labels",
            "created_at",
        ]
        read_only_fields = [
            "features",
        ]

    def validate(self, attrs):
        payment_due_day = attrs.get(
            "payment_due_day", getattr(self.instance, "payment_due_day", None)
        )
        access_block_day = attrs.get(
            "access_block_day", getattr(self.instance, "access_block_day", None)
        )

        if payment_due_day is not None and access_block_day is not None:
            if access_block_day <= payment_due_day:
                raise serializers.ValidationError({
                    "access_block_day": (
                        "El día de bloqueo debe ser posterior al día de vencimiento."
                    )
                })

        return attrs

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

    def get_labels(self, obj):
        return get_gym_labels(obj)