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

    def create(self, validated_data):
        request = self.context["request"]
        gym = request.user.profile.gym

        plan = validated_data["plan"]
        start_date = validated_data["start_date"]

        validated_data["end_date"] = start_date + timedelta(days=plan.duration_days)

        return Subscription.objects.create(gym=gym, **validated_data)