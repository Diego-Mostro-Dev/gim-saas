from rest_framework import serializers

from attendance.models import AttendanceSchedule

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

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

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