from rest_framework import serializers

from attendance.models import AttendanceSchedule, ScheduleSlot

from .models import Member

import json


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
            "photo",
        ]

        read_only_fields = ["gym"]

    def validate_phone(self, value):
        gym = self.context.get("gym")

        if gym is None:
            request = self.context.get("request")

            if (
                request
                and hasattr(request.user, "profile")
            ):
                gym = request.user.profile.gym

        if gym is None:
            return value

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

    def to_representation(self, instance):
        data = super().to_representation(instance)

        if instance.photo:
            try:
                data["photo"] = instance.photo.url
            except Exception:
                data["photo"] = str(instance.photo)
        else:
            data["photo"] = None

        return data

    def create(self, validated_data):
        schedules = self.initial_data.get(
            "schedules",
            [],
        )

        if isinstance(schedules, str):
            try:
                schedules = json.loads(schedules)
            except Exception:
                schedules = []

        member = Member.objects.create(
            **validated_data
        )

        schedule_slots = []

        for s in schedules:
            slot, _ = ScheduleSlot.objects.get_or_create(
                gym=member.gym,
                day=s["day"],
                hour=s["hour"],
            )

            schedule_slots.append(
                AttendanceSchedule(
                    member=member,
                    gym=member.gym,
                    slot=slot,
                    day=s["day"],
                    hour=s["hour"],
                )
            )

        AttendanceSchedule.objects.bulk_create(schedule_slots)

        return member

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        if "schedules" in self.initial_data:
            schedules = self.initial_data.get(
                "schedules",
                [],
            )

            if isinstance(schedules, str):
                try:
                    schedules = json.loads(schedules)
                except Exception:
                    schedules = []

            current = {
                (s.day, s.hour.strftime("%H:%M")): s
                for s in AttendanceSchedule.objects.filter(
                    member=instance,
                )
            }

            new_set = {
                (s["day"], s["hour"])
                for s in schedules
            }

            # Soft-delete removed active schedules
            for key, schedule in current.items():
                if schedule.active and key not in new_set:
                    schedule.active = False
                    schedule.save(update_fields=["active"])

            # Create or reactivate
            for day, hour in new_set:
                key = (day, hour)

                if key in current:
                    schedule = current[key]

                    if not schedule.active:
                        schedule.active = True
                        schedule.save(update_fields=["active"])
                else:
                    slot, _ = ScheduleSlot.objects.get_or_create(
                        gym=instance.gym,
                        day=day,
                        hour=hour,
                    )

                    AttendanceSchedule.objects.create(
                        member=instance,
                        gym=instance.gym,
                        slot=slot,
                        day=day,
                        hour=hour,
                        active=True,
                    )

        return instance


class MemberPhotoSerializer(serializers.ModelSerializer):

    class Meta:
        model = Member
        fields = ["photo"]

    def to_representation(self, instance):
        data = super().to_representation(instance)

        if instance.photo:
            try:
                data["photo"] = instance.photo.url
            except Exception:
                data["photo"] = str(instance.photo)
        else:
            data["photo"] = None

        return data