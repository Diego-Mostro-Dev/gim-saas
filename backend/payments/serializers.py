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
        subscription = validated_data["subscription"]

        validated_data["member_name"] = (
            f"{subscription.member.first_name} "
            f"{subscription.member.last_name}"
        )

        validated_data["plan_name"] = (
            subscription.plan.name
        )
        validated_data["subscription_end_date"] = (
            subscription.end_date
        )

        payment = super().create(validated_data)

        if not subscription.paid:
            subscription.paid = True
            subscription.save(
                update_fields=["paid"]
            )

        return payment