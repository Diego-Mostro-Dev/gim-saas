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
    member_name = serializers.SerializerMethodField()

    class Meta:
        model = Attendance

        fields = [
            "id",
            "member",
            "member_name",
            "schedule",
            "date",
            "created_at",
        ]

        read_only_fields = [
            "member",
            "member_name",
            "date",
            "created_at",
        ]

    def validate(self, attrs):
        schedule = attrs["schedule"]

        already_exists = Attendance.objects.filter(
            member=schedule.member,
            date=date.today(),
        ).exists()

        if already_exists:
            raise serializers.ValidationError(
                "El alumno ya tiene asistencia registrada hoy."
            )

        return attrs

    def create(self, validated_data):
        schedule = validated_data["schedule"]

        return Attendance.objects.create(
            member=schedule.member,
            schedule=schedule,
        )

    def get_member_name(self, obj):
        return (
            f"{obj.member.first_name} "
            f"{obj.member.last_name}"
        )