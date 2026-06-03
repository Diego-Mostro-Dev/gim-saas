from rest_framework import serializers
from .models import Member
from attendance.models import AttendanceSchedule


class MemberSerializer(serializers.ModelSerializer):
    schedules = serializers.SerializerMethodField()

    class Meta:
        model = Member
        fields = [
            "id",
            "first_name",
            "last_name",
            "phone",
            "email",
            "active",
            "schedules",
            "gym",
        ]
        read_only_fields = ["gym"]

    def validate_phone(self, value):
        request = self.context.get("request")
        gym = request.user.profile.gym

        qs = Member.objects.filter(
            phone=value,
            gym=gym,
        )

        instance = getattr(self, "instance", None)

        if instance:
            qs = qs.exclude(id=instance.id)

        if qs.exists():
            raise serializers.ValidationError(
                "Ya existe un socio con ese teléfono."
            )

        return value

    def get_schedules(self, obj):
        return [
            {
                "day": s.day,
                "hour": (
                    s.hour.strftime("%H:%M")
                    if s.hour
                    else None
                ),
            }
            for s in obj.schedules.filter(active=True)
        ]

    def create(self, validated_data):
        schedules = self.initial_data.get(
            "schedules",
            [],
        )

        member = Member.objects.create(
            **validated_data
        )

        AttendanceSchedule.objects.bulk_create(
            [
                AttendanceSchedule(
                    member=member,
                    gym=member.gym,
                    day=s["day"],
                    hour=s["hour"],
                )
                for s in schedules
            ]
        )

        return member