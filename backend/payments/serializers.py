from rest_framework import serializers
from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = "__all__"
        read_only_fields = ["gym"]

    def create(self, validated_data):
        request = self.context["request"]
        gym = request.user.profile.gym

        return Payment.objects.create(gym=gym, **validated_data)