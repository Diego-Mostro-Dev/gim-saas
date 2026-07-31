from datetime import date

from django.db import transaction

from rest_framework import serializers

from subscriptions.models import MembershipPlan
from subscriptions.domain import ScheduleDomain, ScheduleError, SubscriptionDomain
from subscriptions.services import get_last_day_of_month
from plans.services import public_plan_name
from members.eligibility import MemberEligibility

from .models import Member

import json


class MemberSerializer(serializers.ModelSerializer):
    schedules = serializers.SerializerMethodField()
    plan_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    subscription_active = serializers.SerializerMethodField()
    plan_name = serializers.SerializerMethodField()
    subscription_days_remaining = serializers.SerializerMethodField()
    member_created_at = serializers.SerializerMethodField()

    class Meta:
        model = Member

        fields = [
            "id",
            "first_name",
            "last_name",
            "phone",
            "email",
            "active",
            "entry_mode",
            "schedules",
            "gym",
            "photo",
            "access_token",
            "plan_id",
            "subscription_active",
            "plan_name",
            "subscription_days_remaining",
            "member_created_at",
        ]

        read_only_fields = ["gym", "access_token"]

    def _active_subscription(self, obj):
        return SubscriptionDomain.get_active_subscription(obj)

    def get_subscription_active(self, obj):
        sub = self._active_subscription(obj)
        if sub is None:
            return False
        today = date.today()
        return sub.start_date <= today <= sub.end_date

    def get_plan_name(self, obj):
        sub = self._active_subscription(obj)
        if sub is None:
            return None
        return public_plan_name(sub.plan)

    def get_subscription_days_remaining(self, obj):
        sub = SubscriptionDomain.get_current_subscription(obj)
        if sub is None:
            return None
        today = date.today()
        return (sub.end_date - today).days

    def get_member_created_at(self, obj):
        return obj.created_at.isoformat() if obj.created_at else None

    def validate_plan_id(self, value):
        if value is None:
            return value
        gym = self.context.get("gym")
        if gym is None:
            request = self.context.get("request")
            if request and hasattr(request.user, "profile"):
                gym = request.user.profile.gym
        if not MembershipPlan.objects.filter(id=value, gym=gym, is_base=False).exists():
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

            limit = MemberEligibility.get_schedule_limit(self.instance)
            if limit is not None:
                current_count = MemberEligibility.get_active_schedule_count(self.instance)
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
            return ScheduleDomain.validate_slot(gym, day, hour)
        except ScheduleError as e:
            raise serializers.ValidationError(str(e))

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

            subscription = None
            if plan_id:
                plan = MembershipPlan.objects.get(id=plan_id, gym=member.gym)
                today = date.today()
                subscription = SubscriptionDomain.open_subscription(
                    member=member,
                    plan=plan,
                    start_date=today,
                    end_date=get_last_day_of_month(today),
                    origin="onboarding",
                )

            try:
                ScheduleDomain.create_bulk(member, member.gym, schedules, subscription=subscription)
            except ScheduleError as e:
                raise serializers.ValidationError(str(e))

        return member

    def update(self, instance, validated_data):
        validated_data.pop("plan_id", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        if "schedules" in self.initial_data:
            schedules = self._parse_schedules()
            subscription = SubscriptionDomain.get_current_subscription(instance)

            try:
                ScheduleDomain.sync_schedules(instance, instance.gym, schedules, subscription=subscription)
            except ScheduleError as e:
                raise serializers.ValidationError(str(e))

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
