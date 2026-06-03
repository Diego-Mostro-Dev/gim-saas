from rest_framework import serializers
from datetime import timedelta
from .models import Subscription


class SubscriptionSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    plan_name = serializers.CharField(source="plan.name", read_only=True)

    class Meta:
        model = Subscription
        fields = "__all__"
        read_only_fields = ["gym", "end_date"]

    def get_member_name(self, obj):
        return f"{obj.member.first_name} {obj.member.last_name}"

    def validate(self, attrs):
        gym = self.context["request"].user.profile.gym

        member = attrs["member"]
        plan = attrs["plan"]

        if member.gym != gym:
            raise serializers.ValidationError(
                {"member": "El socio no pertenece a este gimnasio."}
            )

        if plan.gym != gym:
            raise serializers.ValidationError(
                {"plan": "El plan no pertenece a este gimnasio."}
            )

        return attrs

    def create(self, validated_data):
        plan = validated_data["plan"]
        start_date = validated_data["start_date"]

        validated_data["end_date"] = (
            start_date + timedelta(days=plan.duration_days)
        )

        return super().create(validated_data)