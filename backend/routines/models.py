from django.db import models
from django.utils import timezone

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
        verbose_name="Gimnasio",
    )

    name = models.CharField(max_length=100, verbose_name="Nombre")

    description = models.TextField(
        blank=True,
        null=True,
        verbose_name="Descripción",
    )

    category = models.CharField(
        max_length=20,
        choices=CATEGORY_CHOICES,
        blank=True,
        null=True,
        verbose_name="Categoría",
    )

    class Meta:
        verbose_name = "Ejercicio"
        verbose_name_plural = "Ejercicios"

    def __str__(self):
        return self.name


class RoutineTemplate(models.Model):
    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="routine_templates",
        verbose_name="Gimnasio",
    )

    name = models.CharField(max_length=100, verbose_name="Nombre de la rutina")

    class Meta:
        verbose_name = "Plantilla de rutina"
        verbose_name_plural = "Plantillas de rutina"

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
        verbose_name="Plantilla de rutina",
    )

    exercise = models.ForeignKey(
        Exercise,
        on_delete=models.CASCADE,
        verbose_name="Ejercicio",
    )

    order = models.PositiveIntegerField(
        default=1,
        verbose_name="Orden",
    )

    sets = models.PositiveIntegerField(
        default=3,
        verbose_name="Series",
    )

    reps = models.CharField(
        max_length=50,
        blank=True,
        verbose_name="Repeticiones",
    )

    weight = models.CharField(
        max_length=50,
        blank=True,
        verbose_name="Peso",
    )

    notes = models.TextField(
        blank=True,
        verbose_name="Notas",
    )

    rest_seconds = models.PositiveIntegerField(
        default=60,
        verbose_name="Descanso (segundos)",
    )

    exercise_type = models.CharField(
        max_length=20,
        choices=EXERCISE_TYPE_CHOICES,
        default="strength",
        verbose_name="Tipo de ejercicio",
    )

    rest_mode = models.CharField(
        max_length=20,
        choices=REST_MODE_CHOICES,
        default="between_sets",
        verbose_name="Modo de descanso",
    )

    next_exercise_rest_seconds = models.PositiveIntegerField(
        default=0,
        verbose_name="Descanso antes del próximo (segundos)",
    )

    class Meta:
        verbose_name = "Ejercicio de rutina"
        verbose_name_plural = "Ejercicios de rutina"
        ordering = ["order"]


class RoutineAssignment(models.Model):
    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="routine_assignments",
        verbose_name="Gimnasio",
    )

    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="routine_assignments",
        verbose_name="Miembro",
    )

    routine_template = models.ForeignKey(
        RoutineTemplate,
        on_delete=models.CASCADE,
        verbose_name="Plantilla de rutina",
    )

    assigned_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Fecha de asignación",
    )

    active = models.BooleanField(
        default=True,
        verbose_name="Activo",
    )

    class Meta:
        verbose_name = "Asignación de rutina"
        verbose_name_plural = "Asignaciones de rutina"


class WorkoutSet(models.Model):
    routine_assignment = models.ForeignKey(
        RoutineAssignment,
        on_delete=models.CASCADE,
        related_name="workout_sets",
        verbose_name="Asignación de rutina",
    )

    routine_exercise = models.ForeignKey(
        RoutineExercise,
        on_delete=models.CASCADE,
        verbose_name="Ejercicio de rutina",
    )

    set_number = models.PositiveIntegerField(verbose_name="Número de serie")

    completed = models.BooleanField(default=False, verbose_name="Completado")

    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Fecha de finalización",
    )

    date = models.DateField(
        default=timezone.localdate,
        verbose_name="Fecha",
    )

    class Meta:
        verbose_name = "Serie de entrenamiento"
        verbose_name_plural = "Series de entrenamiento"
        unique_together = [
            "routine_assignment",
            "routine_exercise",
            "set_number",
            "date",
        ]