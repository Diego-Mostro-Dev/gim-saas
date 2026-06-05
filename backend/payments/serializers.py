from rest_framework import serializers

from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = "__all__"
        read_only_fields = ["gym"]

    def validate_subscription(self, subscription):
        gym = self.context["request"].user.profile.gym

        if subscription.gym_id != gym.id:
            raise serializers.ValidationError(
                "La suscripción no pertenece a este gimnasio."
            )

        return subscription

    def create(self, validated_data):
        payment = super().create(validated_data)

        subscription = payment.subscription

        if not subscription.paid:
            subscription.paid = True
            subscription.save(update_fields=["paid"])

        return payment