from rest_framework import serializers

from members.models import Member
from plans.models import Service as PlanService

from .models import Activity, ActivitySchedule, Enrollment
from .services import ActivityService


class MemberBasicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Member
        fields = ["id", "first_name", "last_name", "entry_mode"]


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

    class Meta:
        model = Enrollment
        fields = [
            "id",
            "gym",
            "member",
            "schedule",
            "active",
            "enrolled_at",
        ]
        read_only_fields = ["gym", "enrolled_at"]

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

    class Meta:
        model = Enrollment
        fields = [
            "id",
            "activity_name",
            "activity_id",
            "activity_active",
            "monthly_price",
            "schedule_active",
            "schedule",
            "day",
            "start_time",
            "end_time",
            "active",
            "enrolled_at",
        ]
