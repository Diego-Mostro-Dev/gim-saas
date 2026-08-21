from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from rest_framework import serializers

from plans.services import public_plan_name

from subscriptions.models import Subscription
from subscriptions.services import (
    calculate_subscription_total,
    sync_subscription_paid,
)

from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = "__all__"
        read_only_fields = ["gym"]

    def validate_member(self, member):
        if member is None:
            return member

        gym = self.context["request"].user.profile.gym

        if member.gym_id != gym.id:
            raise serializers.ValidationError(
                "El miembro no pertenece a este gimnasio."
            )

        return member

    def validate_subscription(self, subscription):
        gym = self.context["request"].user.profile.gym

        if subscription.gym_id != gym.id:
            raise serializers.ValidationError(
                "La suscripción no pertenece a este gimnasio."
            )

        return subscription

    def _paid_total_excluding(self, subscription, exclude_pk=None):
        return (
            Payment.objects.filter(subscription=subscription)
            .exclude(pk=exclude_pk)
            .aggregate(paid=Sum("amount"))["paid"]
            or Decimal("0")
        )

    def _validate_amount(self, subscription, amount):
        if amount <= 0:
            raise serializers.ValidationError(
                {"amount": "El monto debe ser mayor a 0."}
            )

        remaining = (
            calculate_subscription_total(subscription)
            - self._paid_total_excluding(
                subscription, getattr(self.instance, "pk", None)
            )
        )

        if amount > remaining:
            raise serializers.ValidationError(
                {
                    "amount": (
                        f"El monto no puede superar el saldo pendiente de "
                        f"${remaining:,.2f}."
                    )
                }
            )

    def validate(self, attrs):
        attrs = super().validate(attrs)

        # Only validate the amount when this request actually sets it
        # (always on create and on the form's full PUT updates).
        if "amount" not in attrs:
            return attrs

        subscription = attrs.get(
            "subscription",
            getattr(self.instance, "subscription", None),
        )
        if subscription is None:
            return attrs

        self._validate_amount(subscription, attrs["amount"])

        return attrs

    def _apply_subscription_snapshot(self, validated_data, subscription):
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
        return validated_data

    def create(self, validated_data):
        subscription = validated_data.get("subscription")

        if subscription is not None:
            validated_data = self._apply_subscription_snapshot(
                validated_data,
                subscription,
            )

        with transaction.atomic():
            if subscription is not None:
                sub = Subscription.objects.select_for_update().get(
                    pk=subscription.pk
                )
                # Re-validate under the row lock so two concurrent payments
                # can never push the accumulated amount above the contracted
                # total.
                self._validate_amount(sub, validated_data["amount"])
            else:
                sub = None

            payment = super().create(validated_data)

            if sub is not None:
                sync_subscription_paid(sub)

        return payment

    def update(self, instance, validated_data):
        subscription = validated_data.get(
            "subscription",
            instance.subscription,
        )
        old_subscription_id = instance.subscription_id

        if subscription is not None:
            validated_data = self._apply_subscription_snapshot(
                validated_data,
                subscription,
            )

        with transaction.atomic():
            if subscription is not None:
                new_sub = Subscription.objects.select_for_update().get(
                    pk=subscription.pk
                )
                if "amount" in validated_data:
                    self._validate_amount(new_sub, validated_data["amount"])
            else:
                new_sub = None

            payment = super().update(instance, validated_data)

            if new_sub is not None:
                sync_subscription_paid(new_sub)

            if (
                new_sub is not None
                and old_subscription_id is not None
                and old_subscription_id != new_sub.pk
            ):
                old_sub = Subscription.objects.select_for_update().get(
                    pk=old_subscription_id
                )
                sync_subscription_paid(old_sub)

        return payment
