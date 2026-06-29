from django.db import models
from django.db.models import Q
from django.db.models import UniqueConstraint, CheckConstraint
from gyms.models import Gym
from members.models import Member


DAY_CHOICES = [
    ("monday", "Lunes"),
    ("tuesday", "Martes"),
    ("wednesday", "Miércoles"),
    ("thursday", "Jueves"),
    ("friday", "Viernes"),
    ("saturday", "Sábado"),
]


class Activity(models.Model):
    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="activities",
        verbose_name="Gimnasio",
    )
    name = models.CharField(max_length=100, verbose_name="Nombre")
    description = models.TextField(blank=True, verbose_name="Descripción")
    active = models.BooleanField(default=True, verbose_name="Activo")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Creado")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Actualizado")

    class Meta:
        verbose_name = "Actividad"
        verbose_name_plural = "Actividades"
        unique_together = ("gym", "name")
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.gym.name})"


class ActivitySchedule(models.Model):
    activity = models.ForeignKey(
        Activity,
        on_delete=models.CASCADE,
        related_name="schedules",
        verbose_name="Actividad",
    )
    day = models.CharField(max_length=20, choices=DAY_CHOICES, verbose_name="Día")
    start_time = models.TimeField(verbose_name="Hora inicio")
    end_time = models.TimeField(verbose_name="Hora fin")
    capacity = models.PositiveIntegerField(verbose_name="Capacidad")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Creado")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Actualizado")

    class Meta:
        verbose_name = "Horario de actividad"
        verbose_name_plural = "Horarios de actividades"
        unique_together = ("activity", "day", "start_time")
        constraints = [
            CheckConstraint(
                condition=Q(end_time__gt=models.F("start_time")),
                name="activityschedule_end_after_start",
            ),
        ]

    def __str__(self):
        return (
            f"{self.activity.name} - "
            f"{self.get_day_display()} "
            f"{self.start_time:%H:%M}-{self.end_time:%H:%M}"
        )


class Enrollment(models.Model):
    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="activity_enrollments",
        verbose_name="Gimnasio",
    )
    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="activity_enrollments",
        verbose_name="Miembro",
    )
    schedule = models.ForeignKey(
        ActivitySchedule,
        on_delete=models.PROTECT,
        related_name="enrollments",
        verbose_name="Horario",
    )
    active = models.BooleanField(default=True, verbose_name="Activo")
    enrolled_at = models.DateTimeField(auto_now_add=True, verbose_name="Inscripto")

    class Meta:
        verbose_name = "Inscripción"
        verbose_name_plural = "Inscripciones"
        constraints = [
            UniqueConstraint(
                fields=["gym", "member", "schedule"],
                condition=Q(active=True),
                name="unique_active_enrollment",
            ),
        ]

    def __str__(self):
        return (
            f"{self.member.first_name} {self.member.last_name} → "
            f"{self.schedule} "
            f"({'activo' if self.active else 'inactivo'})"
        )
