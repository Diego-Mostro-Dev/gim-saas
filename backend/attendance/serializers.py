from datetime import date, datetime, timedelta

from django.utils import timezone

from rest_framework import serializers

from .models import (
    Attendance,
    AttendanceSchedule,
    ScheduleSlot,
    ScheduleChangeRequest,
)


class AttendanceScheduleSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    slot_id = serializers.IntegerField(read_only=True)
    capacity = serializers.SerializerMethodField()
    day = serializers.SerializerMethodField()
    hour = serializers.SerializerMethodField()

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

    def get_day(self, obj):
        return obj.slot.day

    def get_hour(self, obj):
        return obj.slot.hour


class ScheduleSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScheduleSlot
        fields = ["id", "day", "hour", "capacity", "gym"]
        read_only_fields = ["gym"]
        validators = []

    def validate(self, attrs):
        request = self.context.get("request")
        gym = request.user.profile.gym if request else None

        if gym:
            qs = ScheduleSlot.objects.filter(
                gym=gym,
                day=attrs.get("day"),
                hour=attrs.get("hour"),
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    "Ya existe un horario con ese día y hora."
                )

        return attrs


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


DAY_INDEX = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}


def compute_next_occurrence(slot_day, slot_time):
    now = timezone.localtime(timezone.now())
    days_ahead = (DAY_INDEX[slot_day] - now.weekday()) % 7
    slot_dt = now.replace(
        hour=slot_time.hour,
        minute=slot_time.minute,
        second=0,
        microsecond=0,
    ) + timedelta(days=days_ahead)
    if days_ahead == 0 and slot_dt <= now:
        slot_dt += timedelta(days=7)
    return slot_dt


class ScheduleChangeRequestSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    current_day = serializers.SerializerMethodField()
    current_hour = serializers.SerializerMethodField()
    requested_day = serializers.SerializerMethodField()
    requested_hour = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()
    effective_date = serializers.SerializerMethodField()

    class Meta:
        model = ScheduleChangeRequest
        fields = [
            "id",
            "gym",
            "member",
            "member_name",
            "current_schedule",
            "current_day",
            "current_hour",
            "requested_slot",
            "requested_day",
            "requested_hour",
            "effective_date",
            "status",
            "requested_at",
            "reviewed_at",
            "reviewed_by",
            "reviewed_by_name",
            "admin_notes",
        ]
        read_only_fields = [
            "gym",
            "status",
            "requested_at",
            "reviewed_at",
            "reviewed_by",
        ]

    def get_member_name(self, obj):
        return f"{obj.member.first_name} {obj.member.last_name}"

    def get_current_day(self, obj):
        return obj.current_schedule.slot.day

    def get_current_hour(self, obj):
        return obj.current_schedule.slot.hour.strftime("%H:%M")

    def get_requested_day(self, obj):
        return obj.requested_slot.day

    def get_requested_hour(self, obj):
        return obj.requested_slot.hour.strftime("%H:%M")

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            return obj.reviewed_by.get_full_name() or obj.reviewed_by.username
        return None

    def validate_gym_allows_changes(self, gym):
        if not gym.allow_member_schedule_changes:
            raise serializers.ValidationError(
                "El gimnasio no permite cambios de horario."
            )

    def validate_current_schedule(self, value):
        if not value.active:
            raise serializers.ValidationError(
                "El horario actual no está activo."
            )
        return value

    def validate(self, attrs):
        gym = self.context["request"].user.profile.gym
        current_schedule = attrs.get("current_schedule")
        requested_slot = attrs.get("requested_slot")

        self.validate_gym_allows_changes(gym)

        if current_schedule and requested_slot:
            if current_schedule.gym != gym:
                raise serializers.ValidationError({
                    "current_schedule": "El horario actual no pertenece a este gimnasio."
                })

            if requested_slot.gym != gym:
                raise serializers.ValidationError({
                    "requested_slot": "El horario solicitado no pertenece a este gimnasio."
                })

            if current_schedule.slot_id == requested_slot.id:
                raise serializers.ValidationError(
                    "El horario solicitado es el mismo que el actual."
                )

            member = current_schedule.member
            if AttendanceSchedule.objects.filter(
                gym=gym,
                member=member,
                slot=requested_slot,
                active=True,
            ).exists():
                raise serializers.ValidationError(
                    "Ya tienes asignado ese horario."
                )

            cap = requested_slot.capacity or gym.default_schedule_capacity
            if cap is not None:
                current_count = AttendanceSchedule.objects.filter(
                    gym=gym,
                    slot=requested_slot,
                    active=True,
                ).count()
                if current_count >= cap:
                    raise serializers.ValidationError(
                        "El horario solicitado está completo."
                    )

            slot_dt = compute_next_occurrence(requested_slot.day, requested_slot.hour)
            notice_hours = gym.schedule_change_notice_hours
            if (slot_dt - timezone.now()).total_seconds() < notice_hours * 3600:
                raise serializers.ValidationError(
                    f"Debes solicitar el cambio con al menos {notice_hours} horas de anticipación."
                )

        return attrs

    def get_effective_date(self, obj):
        if obj.requested_slot_id:
            return compute_next_occurrence(
                obj.requested_slot.day, obj.requested_slot.hour
            )
        return None

    def create(self, validated_data):
        request = self.context["request"]
        gym = request.user.profile.gym
        validated_data["gym"] = gym
        return super().create(validated_data)


class ScheduleChangeRequestActionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScheduleChangeRequest
        fields = ["status", "admin_notes"]

    def validate_status(self, value):
        if value not in ("approved", "rejected"):
            raise serializers.ValidationError(
                "El estado debe ser 'approved' o 'rejected'."
            )
        return value

    def validate(self, attrs):
        instance = self.instance

        if instance.status != "pending":
            raise serializers.ValidationError(
                f"No se puede modificar una solicitud con estado '{instance.status}'."
            )

        if attrs.get("status") == "approved":
            gym = instance.gym
            requested_slot = instance.requested_slot

            cap = requested_slot.capacity or gym.default_schedule_capacity
            if cap is not None:
                current_count = AttendanceSchedule.objects.filter(
                    gym=gym,
                    slot=requested_slot,
                    active=True,
                ).count()
                if current_count >= cap:
                    raise serializers.ValidationError(
                        "El horario solicitado ya está completo."
                    )

        return attrs


class PublicScheduleChangeRequestSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    current_day = serializers.SerializerMethodField()
    current_hour = serializers.SerializerMethodField()
    requested_day = serializers.SerializerMethodField()
    requested_hour = serializers.SerializerMethodField()
    effective_date = serializers.SerializerMethodField()

    class Meta:
        model = ScheduleChangeRequest
        fields = [
            "id",
            "gym",
            "member",
            "member_name",
            "current_schedule",
            "current_day",
            "current_hour",
            "requested_slot",
            "requested_day",
            "requested_hour",
            "effective_date",
            "status",
            "requested_at",
            "reviewed_at",
            "admin_notes",
        ]
        read_only_fields = [
            "gym",
            "member",
            "status",
            "requested_at",
            "reviewed_at",
        ]

    def get_member_name(self, obj):
        return f"{obj.member.first_name} {obj.member.last_name}"

    def get_current_day(self, obj):
        return obj.current_schedule.slot.day

    def get_current_hour(self, obj):
        return obj.current_schedule.slot.hour.strftime("%H:%M")

    def get_requested_day(self, obj):
        return obj.requested_slot.day

    def get_requested_hour(self, obj):
        return obj.requested_slot.hour.strftime("%H:%M")

    def validate_gym_allows_changes(self, gym):
        if not gym.allow_member_schedule_changes:
            raise serializers.ValidationError(
                "El gimnasio no permite cambios de horario."
            )

    def validate_current_schedule(self, value):
        if not value.active:
            raise serializers.ValidationError(
                "El horario actual no está activo."
            )
        return value

    def validate(self, attrs):
        member = self.context["member"]
        gym = member.gym
        current_schedule = attrs.get("current_schedule")
        requested_slot = attrs.get("requested_slot")

        self.validate_gym_allows_changes(gym)

        if current_schedule and requested_slot:
            if current_schedule.gym != gym:
                raise serializers.ValidationError({
                    "current_schedule": "El horario actual no pertenece a este gimnasio."
                })

            if requested_slot.gym != gym:
                raise serializers.ValidationError({
                    "requested_slot": "El horario solicitado no pertenece a este gimnasio."
                })

            if current_schedule.slot_id == requested_slot.id:
                raise serializers.ValidationError(
                    "El horario solicitado es el mismo que el actual."
                )

            if AttendanceSchedule.objects.filter(
                gym=gym,
                member=member,
                slot=requested_slot,
                active=True,
            ).exists():
                raise serializers.ValidationError(
                    "Ya tienes asignado ese horario."
                )

            cap = requested_slot.capacity or gym.default_schedule_capacity
            if cap is not None:
                current_count = AttendanceSchedule.objects.filter(
                    gym=gym,
                    slot=requested_slot,
                    active=True,
                ).count()
                if current_count >= cap:
                    raise serializers.ValidationError(
                        "El horario solicitado está completo."
                    )

            slot_dt = compute_next_occurrence(requested_slot.day, requested_slot.hour)
            notice_hours = gym.schedule_change_notice_hours
            if (slot_dt - timezone.now()).total_seconds() < notice_hours * 3600:
                raise serializers.ValidationError(
                    f"Debes solicitar el cambio con al menos {notice_hours} horas de anticipación."
                )

        return attrs

    def get_effective_date(self, obj):
        if obj.requested_slot_id:
            return compute_next_occurrence(
                obj.requested_slot.day, obj.requested_slot.hour
            )
        return None

    def create(self, validated_data):
        member = self.context["member"]
        validated_data["gym"] = member.gym
        validated_data["member"] = member
        return super().create(validated_data)