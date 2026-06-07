from rest_framework import serializers

from .models import (
    Exercise,
    RoutineTemplate,
    RoutineAssignment,
    RoutineExercise,
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
            }
            for exercise in obj.routine_template.routine_exercises.all()
        ]


class ActiveRoutineSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()

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
            "member_id",
            "member_name",
            "routine_id",
            "routine_name",
        ]

    def get_member_name(self, obj):
        return (
            f"{obj.member.first_name} "
            f"{obj.member.last_name}"
        )

class MemberPortalSerializer(serializers.Serializer):
    member = serializers.DictField()
    gym = serializers.DictField()
    subscription = serializers.DictField(
        allow_null=True
    )
    schedules = serializers.ListField()
    routine = serializers.DictField()