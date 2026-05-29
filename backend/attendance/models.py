# attendance/models.py

from django.db import models
from members.models import Member


class AttendanceSchedule(models.Model):
    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="schedules",
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

    class Meta:
        unique_together = ("member", "day")

    def __str__(self):
        return f"{self.member} - {self.day}"