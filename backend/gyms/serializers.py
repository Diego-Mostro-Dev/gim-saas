from rest_framework import serializers

from .models import Gym


class GymSerializer(serializers.ModelSerializer):
    onboarding_url = serializers.SerializerMethodField()
    register_url = serializers.SerializerMethodField()
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = Gym
        fields = [
            "id",
            "name",
            "slug",
            "logo",
            "logo_url",
            "active",
            "whatsapp",
            "phone",
            "email",
            "default_schedule_capacity",
            "onboarding_code",
            "onboarding_url",
            "register_url",
            "created_at",
        ]

    def get_onboarding_url(self, obj):
        return obj.get_onboarding_url()

    def get_register_url(self, obj):
        return obj.get_public_register_url()

    def get_logo_url(self, obj):
        if not obj.logo:
            return None

        return obj.logo.url