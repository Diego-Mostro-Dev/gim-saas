from datetime import date, datetime, timedelta

from django.utils import timezone
from rest_framework import serializers

from .models import (
    Attendance,
    AttendanceSchedule,
    ScheduleSlot,
    ScheduleChangeRequest,
    ScheduleSwapRequest,
)
from .utils import compute_effective_occupancy


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
    swap_request = serializers.PrimaryKeyRelatedField(
        queryset=ScheduleSwapRequest.objects.all(),
        required=False,
        allow_null=True,
    )

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
        swap_request = attrs.get("swap_request")

        if swap_request:
            if swap_request.gym != gym:
                raise serializers.ValidationError({
                    "swap_request": "El intercambio no pertenece a este gimnasio."
                })

            if swap_request.status != "approved":
                raise serializers.ValidationError({
                    "swap_request": "El intercambio no está aprobado."
                })

            if swap_request.swap_date != date.today():
                raise serializers.ValidationError({
                    "swap_request": "El intercambio no corresponde a hoy."
                })

            if Attendance.objects.filter(
                swap_request=swap_request,
                date=date.today(),
            ).exists():
                raise serializers.ValidationError({
                    "swap_request": "La asistencia para este intercambio ya fue registrada."
                })

            attrs["schedule"] = swap_request.origin_schedule

            slot = swap_request.destination_slot
        else:
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
                swap_request__isnull=True,
            ).exists()

            if already_registered:
                raise serializers.ValidationError({
                    "schedule": "La asistencia ya fue registrada hoy."
                })

            slot = schedule.slot

        if slot is not None:
            cap = slot.capacity or gym.default_schedule_capacity
            if cap is not None:
                effective = compute_effective_occupancy(slot, timezone.localdate())
                if effective >= cap:
                    raise serializers.ValidationError(
                        "El horario está completo."
                    )

        attrs["_slot"] = slot
        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        gym = request.user.profile.gym

        schedule = validated_data["schedule"]
        swap_request = validated_data.get("swap_request")
        slot = validated_data.pop("_slot", None)

        return Attendance.objects.create(
            gym=gym,
            member=schedule.member,
            schedule=schedule,
            swap_request=swap_request,
            slot=slot,
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
    member_photo = serializers.SerializerMethodField()
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
            "member_photo",
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

    def get_member_photo(self, obj):
        if obj.member.photo:
            try:
                return obj.member.photo.url
            except Exception:
                return str(obj.member.photo)
        return None

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
        if not gym.allow_schedule_changes:
            raise serializers.ValidationError(
                "El gimnasio no permite cambios permanentes de horario."
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
        if value not in ("executed", "rejected", "cancelled_by_staff"):
            raise serializers.ValidationError(
                "El estado debe ser 'executed', 'rejected' o 'cancelled_by_staff'."
            )
        return value

    def validate(self, attrs):
        instance = self.instance

        if instance.status != "pending":
            raise serializers.ValidationError(
                f"No se puede modificar una solicitud con estado '{instance.status}'."
            )

        if attrs.get("status") == "executed":
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
    member_photo = serializers.SerializerMethodField()
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
            "member_photo",
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

    def get_member_photo(self, obj):
        if obj.member.photo:
            try:
                return obj.member.photo.url
            except Exception:
                return str(obj.member.photo)
        return None

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
        if not gym.allow_schedule_changes:
            raise serializers.ValidationError(
                "El gimnasio no permite cambios permanentes de horario."
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

        cooldown_hours = gym.schedule_change_cooldown_hours
        latest = ScheduleChangeRequest.objects.filter(
            member=member,
        ).order_by("-requested_at").first()
        if latest:
            elapsed = (timezone.now() - latest.requested_at).total_seconds()
            if elapsed < cooldown_hours * 3600:
                remaining_hours = int((cooldown_hours * 3600 - elapsed) / 3600)
                raise serializers.ValidationError(
                    f"Debes esperar {remaining_hours} hora(s) antes de solicitar otro cambio."
                )

        month_start = date.today().replace(day=1)
        monthly_count = ScheduleChangeRequest.objects.filter(
            member=member,
            status__in=["pending", "approved", "executed"],
            requested_at__gte=month_start,
        ).count()
        if monthly_count >= gym.max_schedule_changes_per_month:
            raise serializers.ValidationError(
                f"Has alcanzado el límite de {gym.max_schedule_changes_per_month} cambios de horario este mes."
            )

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


class ScheduleSwapRequestSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    member_photo = serializers.SerializerMethodField()
    origin_day = serializers.SerializerMethodField()
    origin_hour = serializers.SerializerMethodField()
    destination_day = serializers.SerializerMethodField()
    destination_hour = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ScheduleSwapRequest
        fields = [
            "id",
            "gym",
            "member",
            "member_name",
            "member_photo",
            "origin_schedule",
            "origin_day",
            "origin_hour",
            "destination_slot",
            "destination_day",
            "destination_hour",
            "swap_date",
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

    def get_member_photo(self, obj):
        if obj.member.photo:
            try:
                return obj.member.photo.url
            except Exception:
                return str(obj.member.photo)
        return None

    def get_origin_day(self, obj):
        return obj.origin_schedule.slot.day

    def get_origin_hour(self, obj):
        return obj.origin_schedule.slot.hour.strftime("%H:%M")

    def get_destination_day(self, obj):
        return obj.destination_slot.day

    def get_destination_hour(self, obj):
        return obj.destination_slot.hour.strftime("%H:%M")

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            return obj.reviewed_by.get_full_name() or obj.reviewed_by.username
        return None

    def validate_origin_schedule(self, value):
        if not value.active:
            raise serializers.ValidationError(
                "El horario de origen no está activo."
            )
        return value

    def validate(self, attrs):
        gym = self.context["request"].user.profile.gym
        origin_schedule = attrs.get("origin_schedule")
        destination_slot = attrs.get("destination_slot")
        swap_date = attrs.get("swap_date")

        if not gym.allow_member_schedule_changes:
            raise serializers.ValidationError(
                "El gimnasio no permite cambios de horario."
            )
        if not gym.allow_schedule_changes:
            raise serializers.ValidationError(
                "El gimnasio no permite cambios permanentes de horario."
            )

        if origin_schedule and destination_slot and swap_date:
            if origin_schedule.gym != gym:
                raise serializers.ValidationError({
                    "origin_schedule": "El horario de origen no pertenece a este gimnasio."
                })

            if destination_slot.gym != gym:
                raise serializers.ValidationError({
                    "destination_slot": "El horario de destino no pertenece a este gimnasio."
                })

            if origin_schedule.slot_id == destination_slot.id:
                raise serializers.ValidationError(
                    "El horario de destino es el mismo que el actual."
                )

            if AttendanceSchedule.objects.filter(
                gym=gym,
                member=origin_schedule.member,
                slot=destination_slot,
                active=True,
            ).exists():
                raise serializers.ValidationError(
                    "Ya tienes asignado ese horario."
                )

            DAY_INDEX_MAP = {
                "monday": 0,
                "tuesday": 1,
                "wednesday": 2,
                "thursday": 3,
                "friday": 4,
                "saturday": 5,
                "sunday": 6,
            }
            if DAY_INDEX_MAP.get(destination_slot.day) != swap_date.weekday():
                raise serializers.ValidationError(
                    "La fecha seleccionada no corresponde al día del horario de destino."
                )

            if swap_date <= timezone.localdate():
                raise serializers.ValidationError(
                    "La fecha debe ser posterior a hoy."
                )

            swap_datetime = timezone.make_aware(
                datetime.combine(swap_date, destination_slot.hour),
                timezone.get_current_timezone(),
            )
            notice_hours = gym.schedule_change_notice_hours
            if (swap_datetime - timezone.now()).total_seconds() < notice_hours * 3600:
                raise serializers.ValidationError(
                    f"Debes solicitar el intercambio con al menos "
                    f"{notice_hours} horas de anticipación."
                )

            member = origin_schedule.member

            if ScheduleSwapRequest.objects.filter(
                member=member,
                swap_date=swap_date,
            ).exclude(status="cancelled").exists():
                raise serializers.ValidationError(
                    "El socio ya tiene un intercambio pendiente para esta fecha."
                )

            if ScheduleChangeRequest.objects.filter(
                member=member,
                status="pending",
                current_schedule__slot__day=destination_slot.day,
            ).exists():
                raise serializers.ValidationError(
                    "El socio tiene un cambio de horario pendiente que afecta el mismo día."
                )

        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        gym = request.user.profile.gym
        validated_data["gym"] = gym

        return super().create(validated_data)


class ScheduleSwapRequestActionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScheduleSwapRequest
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

        return attrs


class PublicScheduleSwapRequestSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    member_photo = serializers.SerializerMethodField()
    origin_day = serializers.SerializerMethodField()
    origin_hour = serializers.SerializerMethodField()
    destination_day = serializers.SerializerMethodField()
    destination_hour = serializers.SerializerMethodField()

    class Meta:
        model = ScheduleSwapRequest
        fields = [
            "id",
            "gym",
            "member",
            "member_name",
            "member_photo",
            "origin_schedule",
            "origin_day",
            "origin_hour",
            "destination_slot",
            "destination_day",
            "destination_hour",
            "swap_date",
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

    def get_member_photo(self, obj):
        if obj.member.photo:
            try:
                return obj.member.photo.url
            except Exception:
                return str(obj.member.photo)
        return None

    def get_origin_day(self, obj):
        return obj.origin_schedule.slot.day

    def get_origin_hour(self, obj):
        return obj.origin_schedule.slot.hour.strftime("%H:%M")

    def get_destination_day(self, obj):
        return obj.destination_slot.day

    def get_destination_hour(self, obj):
        return obj.destination_slot.hour.strftime("%H:%M")

    def validate_origin_schedule(self, value):
        if not value.active:
            raise serializers.ValidationError(
                "El horario de origen no está activo."
            )
        return value

    def validate(self, attrs):
        member = self.context["member"]
        gym = member.gym
        origin_schedule = attrs.get("origin_schedule")
        destination_slot = attrs.get("destination_slot")
        swap_date = attrs.get("swap_date")

        if not gym.allow_member_schedule_changes:
            raise serializers.ValidationError(
                "El gimnasio no permite cambios de horario."
            )
        if not gym.allow_schedule_changes:
            raise serializers.ValidationError(
                "El gimnasio no permite cambios permanentes de horario."
            )

        if origin_schedule and destination_slot and swap_date:
            if origin_schedule.gym != gym:
                raise serializers.ValidationError({
                    "origin_schedule": "El horario de origen no pertenece a este gimnasio."
                })

            if destination_slot.gym != gym:
                raise serializers.ValidationError({
                    "destination_slot": "El horario de destino no pertenece a este gimnasio."
                })

            if origin_schedule.slot_id == destination_slot.id:
                raise serializers.ValidationError(
                    "El horario de destino es el mismo que el actual."
                )

            if AttendanceSchedule.objects.filter(
                gym=gym,
                member=member,
                slot=destination_slot,
                active=True,
            ).exists():
                raise serializers.ValidationError(
                    "Ya tienes asignado ese horario."
                )

            DAY_INDEX_MAP = {
                "monday": 0,
                "tuesday": 1,
                "wednesday": 2,
                "thursday": 3,
                "friday": 4,
                "saturday": 5,
                "sunday": 6,
            }
            if DAY_INDEX_MAP.get(destination_slot.day) != swap_date.weekday():
                raise serializers.ValidationError(
                    "La fecha seleccionada no corresponde al día del horario de destino."
                )

            if swap_date <= timezone.localdate():
                raise serializers.ValidationError(
                    "La fecha debe ser posterior a hoy."
                )

            swap_datetime = timezone.make_aware(
                datetime.combine(swap_date, destination_slot.hour),
                timezone.get_current_timezone(),
            )
            notice_hours = gym.schedule_change_notice_hours
            if (swap_datetime - timezone.now()).total_seconds() < notice_hours * 3600:
                raise serializers.ValidationError(
                    f"Debes solicitar el intercambio con al menos "
                    f"{notice_hours} horas de anticipación."
                )

            if ScheduleSwapRequest.objects.filter(
                member=member,
                swap_date=swap_date,
            ).exclude(status="cancelled").exists():
                raise serializers.ValidationError(
                    "Ya tienes un intercambio pendiente para esta fecha."
                )

            if ScheduleChangeRequest.objects.filter(
                member=member,
                status="pending",
                current_schedule__slot__day=destination_slot.day,
            ).exists():
                raise serializers.ValidationError(
                    "Tienes un cambio de horario pendiente que afecta el mismo día."
                )

        return attrs

    def create(self, validated_data):
        member = self.context["member"]
        validated_data["gym"] = member.gym
        validated_data["member"] = member

        return super().create(validated_data)