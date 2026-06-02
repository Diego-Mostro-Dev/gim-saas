from rest_framework import serializers
from .models import MembershipPlan


class MembershipPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = MembershipPlan
        fields = "__all__"
        read_only_fields = ["gym"]

    def create(self, validated_data):
        request = self.context["request"]
        gym = request.user.profile.gym

        return MembershipPlan.objects.create(gym=gym, **validated_data)