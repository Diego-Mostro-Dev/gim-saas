from rest_framework import serializers

from .models import Member
from attendance.models import AttendanceSchedule


class MemberSerializer(serializers.ModelSerializer):
    schedule_days = serializers.ListField(
        child=serializers.CharField(),
        required=False,
    )

    class Meta:
        model = Member
        fields = [
            "id",
            "first_name",
            "last_name",
            "phone",
            "email",
            "schedule_days",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)

        data["schedule_days"] = list(
            instance.schedules.values_list(
                "day",
                flat=True,
            )
        )

        return data

    def create(self, validated_data):
        schedule_days = validated_data.pop(
            "schedule_days",
            []
        )

        member = Member.objects.create(
            **validated_data
        )

        AttendanceSchedule.objects.bulk_create(
            [
                AttendanceSchedule(
                    member=member,
                    day=day,
                )
                for day in schedule_days
            ]
        )

        return member

    def update(self, instance, validated_data):
        schedule_days = validated_data.pop(
            "schedule_days",
            None
        )

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        if schedule_days is not None:
            AttendanceSchedule.objects.filter(
                member=instance
            ).delete()

            AttendanceSchedule.objects.bulk_create(
                [
                    AttendanceSchedule(
                        member=instance,
                        day=day,
                    )
                    for day in schedule_days
                ]
            )

        return instance