from django.db import models
from gyms.models import Gym
from members.models import Member


class AttendanceSchedule(models.Model):
    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="attendance_schedules",
    )

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

    day = models.CharField(max_length=20, choices=DAY_CHOICES)
    hour = models.TimeField()

    active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("gym", "member", "day", "hour")

    def __str__(self):
        return f"{self.member} - {self.day} - {self.hour}"


class Attendance(models.Model):
    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="attendances",
    )

    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="attendances",
    )

    schedule = models.ForeignKey(
        AttendanceSchedule,
        on_delete=models.SET_NULL,
        null=True,
        related_name="attendances",
    )

    date = models.DateField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("gym", "schedule", "date")

    def __str__(self):
        return f"{self.member} - {self.date}"