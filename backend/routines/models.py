from django.db import models

from gyms.models import Gym
from members.models import Member


class Exercise(models.Model):
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