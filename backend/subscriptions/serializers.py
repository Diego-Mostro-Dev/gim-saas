from rest_framework import serializers

from .models import Subscription

from datetime import timedelta


class SubscriptionSerializer(
    serializers.ModelSerializer
):
    member_name = serializers.SerializerMethodField()

    plan_name = serializers.CharField(
        source="plan.name",
        read_only=True
    )

    class Meta:
        model = Subscription

        fields = "__all__"

        extra_kwargs = {
            "end_date": {
                "required": False
            }
        }

    def get_member_name(
        self,
        obj
    ):
        return (
            f"{obj.member.first_name} "
            f"{obj.member.last_name}"
        )

    def create(
        self,
        validated_data
    ):
        plan = validated_data["plan"]

        start_date = validated_data[
            "start_date"
        ]

        end_date = (
            start_date
            + timedelta(
                days=plan.duration_days
            )
        )

        validated_data[
            "end_date"
        ] = end_date

        return super().create(
            validated_data
        )