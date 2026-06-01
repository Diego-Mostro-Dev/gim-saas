from django.db import models

from members.models import Member


class AttendanceSchedule(models.Model):
    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="schedules",
    )

    active = models.BooleanField(
        default=True,
    )

    DAY_CHOICES = [
        ("monday", "Lunes"),
        ("tuesday", "Martes"),
        ("wednesday", "Miércoles"),
        ("thursday", "Jueves"),
        ("friday", "Viernes"),
        ("saturday", "Sábado"),
    ]

    day = models.CharField(
        max_length=20,
        choices=DAY_CHOICES,
    )

    hour = models.TimeField()

    class Meta:
        unique_together = (
            "member",
            "day",
            "hour",
        )

    def __str__(self):
        return (
            f"{self.member} - "
            f"{self.day} - "
            f"{self.hour}"
        )


class Attendance(models.Model):
    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="attendances",
    )

    schedule = models.ForeignKey(
        AttendanceSchedule,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendances",
    )

    date = models.DateField(
        auto_now_add=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
    )

    class Meta:
        unique_together = (
            "schedule",
            "date",
        )

    def __str__(self):
        return f"{self.member} - {self.date}"