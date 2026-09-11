from rest_framework import serializers

from members.identity import member_identity
from members.models import Member
from plans.models import Service as PlanService

from .models import Activity, ActivitySchedule, Enrollment
from .services import ActivityService


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


class ActivitySerializer(serializers.ModelSerializer):
    service = serializers.PrimaryKeyRelatedField(
        queryset=PlanService.objects.none(),
        required=False,
        allow_null=True,
    )
    enrolled_count = serializers.SerializerMethodField()
    schedule_count = serializers.SerializerMethodField()

    class Meta:
        model = Activity
        fields = [
            "id",
            "service",
            "name",
            "description",
            "instructor_name",
            "monthly_price",
            "billing_mode",
            "active",
            "enrolled_count",
            "schedule_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]
        validators = []

    def get_enrolled_count(self, obj):
        return getattr(obj, "enrolled_count", 0)

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        if request and hasattr(request.user, "profile"):
            fields["service"].queryset = PlanService.objects.filter(
                gym=request.user.profile.gym
            )
        return fields

    def get_schedule_count(self, obj):
        return getattr(obj, "schedule_count", 0)

    def create(self, validated_data):
        gym = validated_data.pop("gym")
        service = validated_data.pop("service", None)
        if service is None:
            service = PlanService.get_default_activities_service(gym)
        return ActivityService.create_activity(
            gym=gym, service=service, validated_data=validated_data
        )

    def update(self, instance, validated_data):
        if validated_data.get("active") is True and not instance.schedules.filter(active=True).exists():
            raise serializers.ValidationError(
                {"active": "La actividad debe tener al menos un horario activo."}
            )
        return ActivityService.update_activity(instance, validated_data)


class ActivityScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivitySchedule
        fields = [
            "id",
            "activity",
            "day",
            "start_time",
            "end_time",
            "capacity",
            "active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["activity", "created_at", "updated_at"]

    def validate(self, attrs):
        activity = self._get_activity()
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

        if activity and day and start_time and end_time:
            self._validate_no_overlap(activity, day, start_time, end_time)

        return attrs

    def _get_activity(self):
        view = self.context.get("view")
        activity_id = view.kwargs.get("activity_id") if view else None
        if activity_id:
            request = self.context.get("request")
            gym = request.user.profile.gym if request else None
            try:
                return Activity.objects.get(id=activity_id, service__gym=gym)
            except Activity.DoesNotExist:
                raise serializers.ValidationError("La actividad no existe.")
        if self.instance:
            return self.instance.activity
        return None

    def _validate_no_overlap(self, activity, day, start_time, end_time):
        qs = ActivitySchedule.objects.filter(activity=activity, day=day, active=True)
        if self.instance:
            qs = qs.exclude(id=self.instance.id)
        for existing in qs:
            if start_time < existing.end_time and existing.start_time < end_time:
                raise serializers.ValidationError(
                    f"El horario se superpone con "
                    f"{existing.start_time:%H:%M}-{existing.end_time:%H:%M}."
                )


class EnrollmentSerializer(serializers.ModelSerializer):
    member = MemberBasicSerializer(read_only=True)
    sessions_total = serializers.SerializerMethodField()
    sessions_used = serializers.SerializerMethodField()
    exhausted = serializers.SerializerMethodField()
    last_session_date = serializers.SerializerMethodField()
    total_amount = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
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
            "sellado_amount",
            "sellado_paid",
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

        if schedule.activity.service.gym_id != gym.id:
            raise serializers.ValidationError(
                "El horario no pertenece al mismo gimnasio que la inscripción."
            )
        return schedule


class PublicEnrollmentSerializer(serializers.ModelSerializer):
    activity_name = serializers.CharField(source="schedule.activity.name", read_only=True)
    activity_id = serializers.IntegerField(source="schedule.activity_id", read_only=True)
    activity_active = serializers.BooleanField(source="schedule.activity.active", read_only=True)
    activity_billing_mode = serializers.CharField(
        source="schedule.activity.billing_mode", read_only=True
    )
    monthly_price = serializers.DecimalField(
        source="schedule.activity.monthly_price",
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )
    schedule_active = serializers.BooleanField(source="schedule.active", read_only=True)
    day = serializers.CharField(source="schedule.day", read_only=True)
    start_time = serializers.TimeField(source="schedule.start_time", read_only=True)
    end_time = serializers.TimeField(source="schedule.end_time", read_only=True)
    sessions_total = serializers.SerializerMethodField()
    sessions_used = serializers.SerializerMethodField()
    exhausted = serializers.SerializerMethodField()
    sellado_amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )
    sellado_paid = serializers.BooleanField(read_only=True)
    session_price = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )
    amount_paid = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )
    total_amount = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
        fields = [
            "id",
            "activity_name",
            "activity_id",
            "activity_active",
            "activity_billing_mode",
            "monthly_price",
            "schedule_active",
            "schedule",
            "day",
            "start_time",
            "end_time",
            "active",
            "modality",
            "sessions_total",
            "sessions_used",
            "exhausted",
            "session_price",
            "amount_paid",
            "total_amount",
            "remaining_amount",
            "sellado_amount",
            "sellado_paid",
            "enrolled_at",
        ]

    def get_total_amount(self, obj):
        total = obj.total_amount
        return str(total) if total is not None else None

    def get_remaining_amount(self, obj):
        remaining = obj.remaining_amount
        return str(remaining) if remaining is not None else None

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
