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

        member = attrs.get("member")
        schedule = attrs.get("schedule")

        if member.gym != gym:
            raise serializers.ValidationError({
                "member": "El socio no pertenece a este gimnasio."
            })

        if schedule.gym != gym:
            raise serializers.ValidationError({
                "schedule": "El horario no pertenece a este gimnasio."
            })

        if schedule.member.gym != gym:
            raise serializers.ValidationError({
                "schedule": "El socio del horario no pertenece a este gimnasio."
            })

        if schedule.member != member:
            raise serializers.ValidationError({
                "member": "El socio no coincide con el horario seleccionado."
            })

        return attrs