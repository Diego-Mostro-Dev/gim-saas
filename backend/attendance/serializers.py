from datetime import date

from rest_framework import serializers

from .models import (
    Attendance,
    AttendanceSchedule,
    ScheduleSlot,
)


class AttendanceScheduleSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    slot_id = serializers.IntegerField(
        source="slot_id",
        read_only=True,
    )
    capacity = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceSchedule

        fields = [
            "id",
            "member",
            "member_name",
            "day",
            "hour",
            "slot_id",
            "capacity",
        ]

    def get_member_name(self, obj):
        return (
            f"{obj.member.first_name} "
            f"{obj.member.last_name}"
        )

    def get_capacity(self, obj):
        if obj.slot_id and obj.slot.capacity is not None:
            return obj.slot.capacity

        return obj.gym.default_schedule_capacity


class AttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attendance
        fields = "__all__"
        read_only_fields = [
            "gym",
            "member",
        ]

    def validate(self, attrs):
        request = self.context["request"]
        gym = request.user.profile.gym

        schedule = attrs.get("schedule")

        if schedule is None:
            raise serializers.ValidationError({
                "schedule": "Debe seleccionar un horario."
            })

        if schedule.gym != gym:
            raise serializers.ValidationError({
                "schedule": "El horario no pertenece a este gimnasio."
            })

        already_registered = Attendance.objects.filter(
            gym=gym,
            schedule=schedule,
            date=date.today(),
        ).exists()

        if already_registered:
            raise serializers.ValidationError({
                "schedule": "La asistencia ya fue registrada hoy."
            })

        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        gym = request.user.profile.gym

        schedule = validated_data["schedule"]

        return Attendance.objects.create(
            gym=gym,
            member=schedule.member,
            schedule=schedule,
        )