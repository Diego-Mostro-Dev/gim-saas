from rest_framework import serializers
from .models import Subscription


class SubscriptionSerializer(serializers.ModelSerializer):

    member_name = serializers.CharField(
        source='member.first_name',
        read_only=True
    )

    plan_name = serializers.CharField(
        source='plan.name',
        read_only=True
    )

    class Meta:
        model = Subscription
        fields = '__all__'

