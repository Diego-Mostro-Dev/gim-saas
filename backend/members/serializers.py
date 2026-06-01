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
        ]

    def get_schedules(self, obj):
        return [
            {
                "day": schedule.day,
                "hour": (
                    schedule.hour.strftime("%H:%M")
                    if schedule.hour
                    else None
                ),
            }
            for schedule in obj.schedules.filter(active=True)
        ]

    def create(self, validated_data):
        request = self.context.get("request")

        schedules = request.data.get(
            "schedules",
            []
        )

        member = Member.objects.create(
            **validated_data
        )

        AttendanceSchedule.objects.bulk_create(
            [
                AttendanceSchedule(
                    member=member,
                    day=schedule["day"],
                    hour=schedule.get("hour"),
                )
                for schedule in schedules
            ]
        )

        return member

    def update(self, instance, validated_data):
        request = self.context.get("request")

        schedules = request.data.get(
            "schedules",
            None
        )

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        if schedules is not None:

            existing = {
                (
                    schedule.day,
                    schedule.hour.strftime("%H:%M"),
                ): schedule
                for schedule in instance.schedules.all()
            }

            incoming = {
                (
                    schedule["day"],
                    schedule["hour"],
                )
                for schedule in schedules
            }

            # Reactivar horarios existentes
            for key in incoming:
                if key in existing:
                    schedule = existing[key]

                    if not schedule.active:
                        schedule.active = True
                        schedule.save()

            # Crear horarios nuevos
            for day, hour in incoming - existing.keys():
                AttendanceSchedule.objects.create(
                    member=instance,
                    day=day,
                    hour=hour,
                    active=True,
                )

            # Desactivar horarios eliminados
            for key, schedule in existing.items():
                if key not in incoming:
                    schedule.active = False
                    schedule.save()

        return instance