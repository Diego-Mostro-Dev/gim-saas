from django.db import models

from gyms.models import Gym
from members.models import Member


class Exercise(models.Model):
    CATEGORY_CHOICES = [
        ("pecho", "Pecho"),
        ("espalda", "Espalda"),
        ("piernas", "Piernas"),
        ("hombros", "Hombros"),
        ("biceps", "Bíceps"),
        ("triceps", "Tríceps"),
        ("core", "Core"),
        ("cardio", "Cardio"),
        ("movilidad", "Movilidad"),
    ]

    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="exercises",
    )

    name = models.CharField(max_length=100)

    description = models.TextField(
        blank=True,
        null=True,
    )

    category = models.CharField(
        max_length=20,
        choices=CATEGORY_CHOICES,
        blank=True,
        null=True,
    )

    def __str__(self):
        return self.name


class RoutineTemplate(models.Model):
    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="routine_templates",
    )

    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class RoutineExercise(models.Model):
    EXERCISE_TYPE_CHOICES = [
        ("strength", "Fuerza"),
        ("bodyweight", "Peso corporal"),
        ("cardio", "Cardio"),
    ]

    REST_MODE_CHOICES = [
        ("between_sets", "Entre series"),
        ("after_exercise", "Al finalizar ejercicio"),
        ("none", "Sin descanso"),
    ]

    routine_template = models.ForeignKey(
        RoutineTemplate,
        on_delete=models.CASCADE,
        related_name="routine_exercises",
    )

    exercise = models.ForeignKey(
        Exercise,
        on_delete=models.CASCADE,
    )

    order = models.PositiveIntegerField(
        default=1,
    )

    sets = models.PositiveIntegerField(
        default=3,
    )

    reps = models.CharField(
        max_length=50,
        blank=True,
    )

    weight = models.CharField(
        max_length=50,
        blank=True,
    )

    notes = models.TextField(
        blank=True,
    )

    rest_seconds = models.PositiveIntegerField(
        default=60,
    )

    exercise_type = models.CharField(
        max_length=20,
        choices=EXERCISE_TYPE_CHOICES,
        default="strength",
    )

    rest_mode = models.CharField(
        max_length=20,
        choices=REST_MODE_CHOICES,
        default="between_sets",
    )

    next_exercise_rest_seconds = models.PositiveIntegerField(
        default=0,
    )

    class Meta:
        ordering = ["order"]


class RoutineAssignment(models.Model):
    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="routine_assignments",
    )

    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="routine_assignments",
    )

    routine_template = models.ForeignKey(
        RoutineTemplate,
        on_delete=models.CASCADE,
    )

    assigned_at = models.DateTimeField(
        auto_now_add=True,
    )

    active = models.BooleanField(
        default=True,
    )


class WorkoutSet(models.Model):
    routine_assignment = models.ForeignKey(
        RoutineAssignment,
        on_delete=models.CASCADE,
        related_name="workout_sets",
    )

    routine_exercise = models.ForeignKey(
        RoutineExercise,
        on_delete=models.CASCADE,
    )

    set_number = models.PositiveIntegerField()

    completed = models.BooleanField(default=False)

    completed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    class Meta:
        unique_together = [
            "routine_assignment",
            "routine_exercise",
            "set_number",
        ]