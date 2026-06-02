from datetime import date

from rest_framework import serializers

from .models import (
    Attendance,
    AttendanceSchedule,
)


class AttendanceScheduleSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceSchedule

        fields = [
            "id",
            "member",
            "member_name",
            "day",
            "hour",
        ]

    def get_member_name(self, obj):
        return (
            f"{obj.member.first_name} "
            f"{obj.member.last_name}"
        )


class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = "__all__"
        read_only_fields = ["gym"]

    def validate(self, attrs):
        request = self.context["request"]
        gym = request.user.profile.gym

        schedule = attrs.get("schedule")

        if schedule.gym != gym:
            raise serializers.ValidationError("Invalid schedule for this gym")

        if schedule.member.gym != gym:
            raise serializers.ValidationError("Invalid member for this gym")

        return attrs