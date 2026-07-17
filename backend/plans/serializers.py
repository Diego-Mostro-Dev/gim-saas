from rest_framework import serializers
from .models import MembershipPlan, Service


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = ["id", "name", "slug", "description", "active"]


class MembershipPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = MembershipPlan
        fields = "__all__"
        read_only_fields = ["gym", "is_base"]

    def validate_weekly_visits(self, value):
        if value is not None and value < 1:
            raise serializers.ValidationError(
                "Las visitas semanales deben ser al menos 1 o dejar vacío para acceso ilimitado."
            )
        return value

    def validate_is_base(self, value):
        if value:
            raise serializers.ValidationError(
                "No se puede crear un plan base desde la API."
            )
        return value