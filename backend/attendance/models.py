from django.db import models
from django.db.models import Q
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


class ScheduleSlot(models.Model):
    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="schedule_slots",
    )

    day = models.CharField(max_length=20, choices=DAY_CHOICES)
    hour = models.TimeField()

    capacity = models.PositiveIntegerField(
        null=True,
        blank=True,
    )

    class Meta:
        unique_together = ("gym", "day", "hour")

    def __str__(self):
        return f"{self.gym.name} - {self.day} - {self.hour}"


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

    slot = models.ForeignKey(
        ScheduleSlot,
        on_delete=models.PROTECT,
        related_name="attendance_schedules",
    )

    active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("gym", "member", "slot")

    def __str__(self):
        return (
            f"{self.member} - "
            f"{self.slot.day} - "
            f"{self.slot.hour}"
        )


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


class ScheduleChangeRequest(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pendiente"),
        ("approved", "Aprobado"),
        ("rejected", "Rechazado"),
        ("cancelled", "Cancelado"),
    ]

    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="schedule_change_requests",
    )

    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="schedule_change_requests",
    )

    current_schedule = models.ForeignKey(
        AttendanceSchedule,
        on_delete=models.PROTECT,
        related_name="change_requests_from",
    )

    requested_slot = models.ForeignKey(
        ScheduleSlot,
        on_delete=models.PROTECT,
        related_name="change_requests_to",
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
    )

    requested_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    admin_notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-requested_at"]
        indexes = [
            models.Index(fields=["gym", "status"]),
            models.Index(fields=["member", "status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["member", "current_schedule"],
                condition=Q(status="pending"),
                name="unique_pending_change_request",
            ),
        ]

    def __str__(self):
        return (
            f"{self.member} - "
            f"{self.current_schedule.slot.day} "
            f"{self.current_schedule.slot.hour} → "
            f"{self.requested_slot.day} "
            f"{self.requested_slot.hour} "
            f"({self.status})"
        )