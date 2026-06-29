from rest_framework import serializers

from members.models import Member

from .models import Activity, ActivitySchedule, Enrollment


class MemberBasicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Member
        fields = ["id", "first_name", "last_name", "entry_mode"]


class ActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Activity
        fields = [
            "id",
            "gym",
            "name",
            "description",
            "active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["gym", "created_at", "updated_at"]

    def validate_name(self, value):
        gym = self._get_gym()
        if gym is None:
            return value
        qs = Activity.objects.filter(name=value, gym=gym)
        instance = getattr(self, "instance", None)
        if instance:
            qs = qs.exclude(id=instance.id)
        if qs.exists():
            raise serializers.ValidationError(
                "Ya existe una actividad con ese nombre."
            )
        return value

    def _get_gym(self):
        gym = self.context.get("gym")
        if gym is None:
            request = self.context.get("request")
            if request and hasattr(request.user, "profile"):
                gym = request.user.profile.gym
        return gym


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
                return Activity.objects.get(id=activity_id, gym=gym)
            except Activity.DoesNotExist:
                raise serializers.ValidationError("La actividad no existe.")
        if self.instance:
            return self.instance.activity
        return None

    def _validate_no_overlap(self, activity, day, start_time, end_time):
        qs = ActivitySchedule.objects.filter(activity=activity, day=day)
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


class PublicEnrollmentSerializer(serializers.ModelSerializer):
    activity_name = serializers.CharField(source="schedule.activity.name", read_only=True)
    activity_id = serializers.IntegerField(source="schedule.activity_id", read_only=True)
    day = serializers.CharField(source="schedule.day", read_only=True)
    start_time = serializers.TimeField(source="schedule.start_time", read_only=True)
    end_time = serializers.TimeField(source="schedule.end_time", read_only=True)

    class Meta:
        model = Enrollment
        fields = [
            "id",
            "activity_name",
            "activity_id",
            "schedule",
            "day",
            "start_time",
            "end_time",
            "active",
            "enrolled_at",
        ]
