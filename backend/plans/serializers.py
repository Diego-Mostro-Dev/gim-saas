from rest_framework import serializers
from .models import MembershipPlan


class MembershipPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = MembershipPlan
        fields = "__all__"
        read_only_fields = ["gym"]

    def validate_weekly_visits(self, value):
        if value is not None and value < 1:
            raise serializers.ValidationError(
                "Las visitas semanales deben ser al menos 1 o dejar vacío para acceso ilimitado."
            )
        return value