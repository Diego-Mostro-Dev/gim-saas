from rest_framework import serializers

from .models import AttendanceSchedule


class AttendanceScheduleSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()

    class Meta:
        model = AttendanceSchedule
        fields = [
            "id",
            "member",
            "member_name",
            "day",
        ]

    def get_member_name(self, obj):
        return f"{obj.member.first_name} {obj.member.last_name}"