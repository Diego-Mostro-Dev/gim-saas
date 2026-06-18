from datetime import date

from django.db import transaction

from rest_framework import serializers

from attendance.models import AttendanceSchedule, ScheduleSlot
from subscriptions.models import MembershipPlan, Subscription
from subscriptions.services import get_last_day_of_month, get_member_schedule_limit, get_member_active_schedule_count

from .models import Member

import json


class MemberSerializer(serializers.ModelSerializer):
    schedules = serializers.SerializerMethodField()
    plan_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)

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
            "plan_id",
        ]

        read_only_fields = ["gym"]

    def validate_plan_id(self, value):
        if value is None:
            return value
        gym = self.context.get("gym")
        if gym is None:
            request = self.context.get("request")
            if request and hasattr(request.user, "profile"):
                gym = request.user.profile.gym
        if not MembershipPlan.objects.filter(id=value, gym=gym).exists():
            raise serializers.ValidationError("El plan seleccionado no es válido.")
        return value

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

    def validate(self, attrs):
        if self.instance is not None and "schedules" in self.initial_data:
            schedules = self._parse_schedules()
            new_set = {(s["day"], s["hour"]) for s in schedules}
            new_count = len(new_set)

            limit = get_member_schedule_limit(self.instance)
            if limit is not None:
                current_count = get_member_active_schedule_count(self.instance)
                if new_count > limit and new_count > current_count:
                    raise serializers.ValidationError(
                        f"Your plan allows a maximum of {limit} weekly schedules."
                    )
        return attrs

    def get_schedules(self, obj):
        return [
            {
                "day": s.slot.day,
                "hour": s.slot.hour.strftime("%H:%M"),
            }
            for s in obj.schedules.all()
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

    def _validate_schedule_slot(self, gym, day, hour):
        try:
            slot = ScheduleSlot.objects.get(
                gym=gym,
                day=day,
                hour=hour,
            )
        except ScheduleSlot.DoesNotExist:
            raise serializers.ValidationError(
                f"El horario {day} {hour} no está disponible."
            )

        cap = slot.capacity or gym.default_schedule_capacity

        if cap is not None:
            current_count = AttendanceSchedule.objects.filter(
                gym=gym,
                slot=slot,
                active=True,
            ).count()

            if current_count >= cap:
                raise serializers.ValidationError(
                    f"El horario {day} {hour} está completo."
                )

        return slot

    def _parse_schedules(self):
        schedules = self.initial_data.get(
            "schedules",
            [],
        )

        if isinstance(schedules, str):
            try:
                schedules = json.loads(schedules)
            except Exception:
                schedules = []

        return schedules

    def create(self, validated_data):
        plan_id = validated_data.pop("plan_id", None)
        schedules = self._parse_schedules()

        with transaction.atomic():
            member = Member.objects.create(
                **validated_data
            )

            schedule_slots = []

            for s in schedules:
                slot = self._validate_schedule_slot(
                    member.gym, s["day"], s["hour"]
                )

                schedule_slots.append(
                    AttendanceSchedule(
                        member=member,
                        gym=member.gym,
                        slot=slot,
                    )
                )

            AttendanceSchedule.objects.bulk_create(schedule_slots)

            if plan_id:
                plan = MembershipPlan.objects.get(id=plan_id, gym=member.gym)
                today = date.today()
                end_date = get_last_day_of_month(today)
                Subscription.objects.create(
                    gym=member.gym,
                    member=member,
                    plan=plan,
                    start_date=today,
                    end_date=end_date,
                    paid=False,
                    auto_renew=True,
                )

        return member

    def update(self, instance, validated_data):
        validated_data.pop("plan_id", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        if "schedules" in self.initial_data:
            schedules = self._parse_schedules()

            current = {
                (s.slot.day, s.slot.hour.strftime("%H:%M")): s
                for s in AttendanceSchedule.objects.filter(
                    member=instance,
                ).select_related("slot")
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
                    slot = self._validate_schedule_slot(
                        instance.gym, day, hour
                    )

                    AttendanceSchedule.objects.create(
                        member=instance,
                        gym=instance.gym,
                        slot=slot,
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