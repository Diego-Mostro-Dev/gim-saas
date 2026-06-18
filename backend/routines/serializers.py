from rest_framework import serializers

from .models import (
    Exercise,
    RoutineTemplate,
    RoutineAssignment,
    RoutineExercise,
    WorkoutSet,
)


class ExerciseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exercise
        fields = "__all__"
        read_only_fields = ["gym"]


class RoutineTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoutineTemplate
        fields = "__all__"
        read_only_fields = ["gym"]


class RoutineAssignmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoutineAssignment
        fields = "__all__"
        read_only_fields = ["gym"]


class RoutineExerciseSerializer(serializers.ModelSerializer):
    exercise_name = serializers.CharField(
        source="exercise.name",
        read_only=True,
    )

    exercise_category = serializers.CharField(
        source="exercise.category",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = RoutineExercise
        fields = "__all__"


class MemberRoutineSerializer(serializers.ModelSerializer):
    member_id = serializers.IntegerField(
        source="member.id",
        read_only=True,
    )

    member_name = serializers.SerializerMethodField()

    routine_name = serializers.CharField(
        source="routine_template.name",
        read_only=True,
    )

    exercises = serializers.SerializerMethodField()

    class Meta:
        model = RoutineAssignment

        fields = [
            "id",
            "member_id",
            "member",
            "member_name",
            "routine_template",
            "routine_name",
            "assigned_at",
            "active",
            "exercises",
        ]

    def get_member_name(self, obj):
        return (
            f"{obj.member.first_name} "
            f"{obj.member.last_name}"
        )

    def get_exercises(self, obj):
        return [
            {
                "id": exercise.id,
                "name": exercise.exercise.name,
                "sets": exercise.sets,
                "reps": exercise.reps,
                "weight": exercise.weight,
                "notes": exercise.notes,
                "order": exercise.order,
                "rest_seconds": exercise.rest_seconds,
                "exercise_type": exercise.exercise_type,
                "rest_mode": exercise.rest_mode,
                "next_exercise_rest_seconds": exercise.next_exercise_rest_seconds,
            }
            for exercise in obj.routine_template.routine_exercises.all()
        ]


class ActiveRoutineSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    member_photo = serializers.SerializerMethodField()

    routine_name = serializers.CharField(
        source="routine_template.name",
        read_only=True,
    )

    routine_id = serializers.IntegerField(
        source="routine_template.id",
        read_only=True,
    )

    member_id = serializers.IntegerField(
        source="member.id",
        read_only=True,
    )

    class Meta:
        model = RoutineAssignment

        fields = [
            "id",
            "member_id",
            "member_name",
            "member_photo",
            "routine_id",
            "routine_name",
            "assigned_at",
            "active",
        ]

    def get_member_name(self, obj):
        return (
            f"{obj.member.first_name} "
            f"{obj.member.last_name}"
        )

    def get_member_photo(self, obj):
        if obj.member.photo:
            try:
                return obj.member.photo.url
            except Exception:
                return str(obj.member.photo)
        return None

class MemberPortalSerializer(serializers.Serializer):
    member = serializers.DictField()
    gym = serializers.DictField()
    subscription = serializers.DictField(
        allow_null=True
    )
    upcoming_subscription = serializers.DictField(
        allow_null=True,
        required=False,
    )
    schedules = serializers.ListField()
    attendance_history = serializers.ListField(
        required=False
    )
    routine = serializers.DictField()
    last_payment = serializers.DictField(
        allow_null=True,
        required=False,
    )
    payments = serializers.ListField(
        required=False,
    )
    active_plans = serializers.ListField(
        required=False,
    )


class WorkoutSetSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkoutSet
        fields = [
            "id",
            "routine_exercise",
            "set_number",
            "completed",
            "completed_at",
        ]
        read_only_fields = ["id", "completed_at"]