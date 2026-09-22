from rest_framework import serializers

from django.contrib.auth import get_user_model

from members.identity import member_identity
from members.models import Member
from plans.models import Service as PlanService
from profiles.models import UserProfile

from .models import (
    Outing,
    OutingEnrollment,
    OutingEnrollmentRequest,
    OutingSchedule,
)


class MemberBasicSerializer(serializers.ModelSerializer):
    insurance_name = serializers.SerializerMethodField()

    class Meta:
        model = Member
        fields = [
            "id",
            "first_name",
            "last_name",
            "entry_mode",
            "is_comp",
            "phone",
            "document_number",
            "insurance_name",
            "affiliate_number",
        ]

    def get_insurance_name(self, obj):
        return member_identity(obj)["insurance_name"]


class OutingSerializer(serializers.ModelSerializer):
    service = serializers.PrimaryKeyRelatedField(
        queryset=PlanService.objects.none(),
        required=False,
        allow_null=True,
    )
    enrolled_count = serializers.SerializerMethodField()
    schedule_count = serializers.SerializerMethodField()
    trainer_name = serializers.SerializerMethodField()

    class Meta:
        model = Outing
        fields = [
            "id",
            "service",
            "name",
            "description",
            "trainer",
            "trainer_name",
            "meeting_place",
            "duration_minutes",
            "monthly_price",
            "billing_mode",
            "active",
            "enrolled_count",
            "schedule_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "trainer_name",
            "created_at",
            "updated_at",
        ]
        validators = []

    def get_enrolled_count(self, obj):
        return getattr(obj, "enrolled_count", 0)

    def get_schedule_count(self, obj):
        return getattr(obj, "schedule_count", 0)

    def get_trainer_name(self, obj):
        if obj.trainer_id is None:
            return None
        return obj.trainer.get_full_name() or obj.trainer.username

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        if request and hasattr(request.user, "profile"):
            gym = request.user.profile.gym
            fields["service"].queryset = PlanService.objects.filter(gym=gym)
            fields["trainer"].queryset = get_user_model().objects.filter(
                profile__gym=gym,
                profile__role=UserProfile.ROLE_TRAINER,
            )
        return fields

    def create(self, validated_data):
        gym = validated_data.pop("gym")
        service = validated_data.pop("service", None)
        from plans.models import Service as PlanServiceModel

        if service is None:
            service = PlanServiceModel.get_default_outings_service(gym)
        return Outing.objects.create(gym=gym, service=service, **validated_data)

    def update(self, instance, validated_data):
        if (
            validated_data.get("active") is True
            and not instance.schedules.filter(active=True).exists()
        ):
            raise serializers.ValidationError(
                {"active": "La salida debe tener al menos un horario activo."}
            )
        return super().update(instance, validated_data)


class OutingScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = OutingSchedule
        fields = [
            "id",
            "outing",
            "day",
            "start_time",
            "end_time",
            "capacity",
            "active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["outing", "created_at", "updated_at"]

    def validate(self, attrs):
        outing = self._get_outing()
        day = attrs.get("day")
        start_time = attrs.get("start_time")
        end_time = attrs.get("end_time")

        if day is None and self.instance:
            day = self.instance.day
        if start_time is None and self.instance:
            start_time = self.instance.start_time
        if end_time is None and self.instance:
            end_time = self.instance.end_time

        if start_time and end_time:
            if end_time <= start_time:
                raise serializers.ValidationError(
                    "La hora de fin debe ser posterior a la hora de inicio."
                )

        if outing and day and start_time and end_time:
            self._validate_no_overlap(outing, day, start_time, end_time)

        return attrs

    def _get_outing(self):
        view = self.context.get("view")
        outing_id = view.kwargs.get("outing_id") if view else None
        if outing_id:
            request = self.context.get("request")
            gym = request.user.profile.gym if request else None
            try:
                return Outing.objects.get(id=outing_id, gym=gym)
            except Outing.DoesNotExist:
                raise serializers.ValidationError("La salida no existe.")
        if self.instance:
            return self.instance.outing
        return None

    def _validate_no_overlap(self, outing, day, start_time, end_time):
        qs = OutingSchedule.objects.filter(outing=outing, day=day, active=True)
        if self.instance:
            qs = qs.exclude(id=self.instance.id)
        for existing in qs:
            if start_time < existing.end_time and existing.start_time < end_time:
                raise serializers.ValidationError(
                    f"El horario se superpone con "
                    f"{existing.start_time:%H:%M}-{existing.end_time:%H:%M}."
                )


class OutingEnrollmentSerializer(serializers.ModelSerializer):
    member = MemberBasicSerializer(read_only=True)
    sessions_total = serializers.SerializerMethodField()
    sessions_used = serializers.SerializerMethodField()
    exhausted = serializers.SerializerMethodField()
    last_session_date = serializers.SerializerMethodField()
    total_amount = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()

    class Meta:
        model = OutingEnrollment
        fields = [
            "id",
            "gym",
            "member",
            "schedule",
            "active",
            "modality",
            "package_total_sessions",
            "sessions_total",
            "sessions_used",
            "exhausted",
            "session_price",
            "amount_paid",
            "total_amount",
            "remaining_amount",
            "last_session_date",
            "enrolled_at",
        ]
        read_only_fields = ["gym", "enrolled_at", "amount_paid"]
        validators = []

    def get_sessions_total(self, obj):
        if obj.modality != "package":
            return 0
        return obj.package_total_sessions or 0

    def get_sessions_used(self, obj):
        used = getattr(obj, "used_sessions_count", None)
        if used is None:
            used = obj.used_sessions
        return used

    def get_exhausted(self, obj):
        if obj.modality != "package":
            return False
        total = obj.package_total_sessions
        return total is not None and self.get_sessions_used(obj) >= total

    def get_last_session_date(self, obj):
        if obj.modality != "package":
            return None
        last = getattr(obj, "last_session_date", None)
        if last is None:
            last_record = obj.session_records.order_by("-date").first()
            last = last_record.date if last_record else None
        return last.isoformat() if last else None

    def get_total_amount(self, obj):
        total = obj.total_amount
        return str(total) if total is not None else None

    def get_remaining_amount(self, obj):
        remaining = obj.remaining_amount
        return str(remaining) if remaining is not None else None

    def validate_session_price(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError(
                "El precio por sesión no puede ser negativo."
            )
        return value

    def validate_schedule(self, schedule):
        if self.instance is not None:
            gym = self.instance.gym
        else:
            request = self.context.get("request")
            profile = getattr(request.user, "profile", None) if request else None
            gym = getattr(profile, "gym", None)
            if gym is None:
                return schedule

        if schedule.outing.gym_id != gym.id:
            raise serializers.ValidationError(
                "El horario no pertenece a este gimnasio."
            )
        return schedule


class PublicOutingEnrollmentSerializer(serializers.ModelSerializer):
    outing_id = serializers.SerializerMethodField()
    outing = serializers.SerializerMethodField()
    meeting_place = serializers.SerializerMethodField()
    duration_minutes = serializers.SerializerMethodField()
    day = serializers.SerializerMethodField()
    start_time = serializers.SerializerMethodField()
    end_time = serializers.SerializerMethodField()
    trainer_name = serializers.SerializerMethodField()
    trainer_phone = serializers.SerializerMethodField()
    trainer_whatsapp = serializers.SerializerMethodField()
    trainer_email = serializers.SerializerMethodField()
    sessions_total = serializers.SerializerMethodField()
    sessions_used = serializers.SerializerMethodField()
    exhausted = serializers.SerializerMethodField()

    class Meta:
        model = OutingEnrollment
        fields = [
            "id",
            "outing_id",
            "outing",
            "meeting_place",
            "duration_minutes",
            "day",
            "start_time",
            "end_time",
            "trainer_name",
            "trainer_phone",
            "trainer_whatsapp",
            "trainer_email",
            "modality",
            "sessions_total",
            "sessions_used",
            "exhausted",
            "active",
        ]
        read_only_fields = ["id", "modality", "active"]

    def get_outing_id(self, obj):
        return obj.schedule.outing_id

    def get_outing(self, obj):
        return obj.schedule.outing.name

    def get_meeting_place(self, obj):
        return obj.schedule.outing.meeting_place or None

    def get_duration_minutes(self, obj):
        return obj.schedule.outing.duration_minutes

    def get_day(self, obj):
        return obj.schedule.day

    def get_start_time(self, obj):
        return obj.schedule.start_time

    def get_end_time(self, obj):
        return obj.schedule.end_time

    def get_trainer_name(self, obj):
        trainer = obj.schedule.outing.trainer
        if trainer is None:
            return None
        return trainer.get_full_name() or trainer.username

    def get_trainer_phone(self, obj):
        profile = getattr(obj.schedule.outing.trainer, "profile", None)
        return profile.phone or None if profile else None

    def get_trainer_whatsapp(self, obj):
        profile = getattr(obj.schedule.outing.trainer, "profile", None)
        return profile.whatsapp or None if profile else None

    def get_trainer_email(self, obj):
        trainer = obj.schedule.outing.trainer
        return trainer.email or None if trainer else None

    def get_sessions_total(self, obj):
        if obj.modality != "package":
            return 0
        return obj.package_total_sessions or 0

    def get_sessions_used(self, obj):
        return obj.used_sessions

    def get_exhausted(self, obj):
        if obj.modality != "package":
            return False
        total = obj.package_total_sessions
        return total is not None and obj.used_sessions >= total


class PublicOutingEnrollmentRequestSerializer(serializers.ModelSerializer):
    outing_name = serializers.SerializerMethodField()
    day = serializers.SerializerMethodField()
    start_time = serializers.SerializerMethodField()
    end_time = serializers.SerializerMethodField()
    trainer_name = serializers.SerializerMethodField()

    class Meta:
        model = OutingEnrollmentRequest
        fields = [
            "id",
            "request_type",
            "outing_name",
            "day",
            "start_time",
            "end_time",
            "trainer_name",
            "status",
            "requested_at",
            "admin_notes",
        ]
        read_only_fields = fields

    def get_outing_name(self, obj):
        if obj.schedule is None:
            return ""
        return obj.schedule.outing.name

    def get_day(self, obj):
        return obj.schedule.day if obj.schedule else None

    def get_start_time(self, obj):
        return obj.schedule.start_time if obj.schedule else None

    def get_end_time(self, obj):
        return obj.schedule.end_time if obj.schedule else None

    def get_trainer_name(self, obj):
        trainer = obj.schedule.outing.trainer if obj.schedule else None
        if trainer is None:
            return None
        return trainer.get_full_name() or trainer.username


class StaffOutingEnrollmentRequestSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    member_identity = serializers.SerializerMethodField()
    outing_name = serializers.SerializerMethodField()
    day = serializers.SerializerMethodField()
    start_time = serializers.SerializerMethodField()
    end_time = serializers.SerializerMethodField()
    trainer_name = serializers.SerializerMethodField()

    class Meta:
        model = OutingEnrollmentRequest
        fields = [
            "id",
            "request_type",
            "member_name",
            "member_identity",
            "outing_name",
            "day",
            "start_time",
            "end_time",
            "trainer_name",
            "status",
            "requested_at",
            "reviewed_at",
            "admin_notes",
        ]
        read_only_fields = fields

    def get_member_name(self, obj):
        name = f"{obj.member.first_name} {obj.member.last_name}".strip()
        return name or obj.member.document_number or "Socio"

    def get_member_identity(self, obj):
        return member_identity(obj.member)

    def get_outing_name(self, obj):
        if obj.schedule is None:
            return ""
        return obj.schedule.outing.name

    def get_day(self, obj):
        return obj.schedule.day if obj.schedule else None

    def get_start_time(self, obj):
        return obj.schedule.start_time if obj.schedule else None

    def get_end_time(self, obj):
        return obj.schedule.end_time if obj.schedule else None

    def get_trainer_name(self, obj):
        trainer = obj.schedule.outing.trainer if obj.schedule else None
        if trainer is None:
            return None
        return trainer.get_full_name() or trainer.username