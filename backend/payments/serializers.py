from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from rest_framework import serializers

from plans.services import public_plan_name

from subscriptions.models import Subscription
from subscriptions.services import calculate_subscription_total

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
            public_plan_name(subscription.plan)
        )
        validated_data["subscription_end_date"] = (
            subscription.end_date
        )
        validated_data["member"] = subscription.member

        with transaction.atomic():
            sub = Subscription.objects.select_for_update().get(
                pk=subscription.pk
            )
            payment = super().create(validated_data)
            if not sub.paid:
                paid_total = Payment.objects.filter(subscription=sub).aggregate(
                    total=Sum("amount")
                )["total"] or Decimal("0")
                if paid_total >= calculate_subscription_total(sub):
                    sub.paid = True
                    sub.save(update_fields=["paid"])

        return payment