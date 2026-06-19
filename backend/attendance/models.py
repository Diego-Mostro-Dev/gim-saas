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
        verbose_name="Gimnasio",
    )

    day = models.CharField(max_length=20, choices=DAY_CHOICES, verbose_name="Día")
    hour = models.TimeField(verbose_name="Hora")

    capacity = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name="Capacidad",
    )

    class Meta:
        verbose_name = "Horario disponible"
        verbose_name_plural = "Horarios disponibles"
        unique_together = ("gym", "day", "hour")

    def __str__(self):
        return f"{self.gym.name} - {self.day} - {self.hour}"


class AttendanceSchedule(models.Model):
    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="attendance_schedules",
        verbose_name="Gimnasio",
    )

    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="schedules",
        verbose_name="Miembro",
    )

    slot = models.ForeignKey(
        ScheduleSlot,
        on_delete=models.PROTECT,
        related_name="attendance_schedules",
        verbose_name="Horario",
    )

    active = models.BooleanField(default=True, db_index=True, verbose_name="Activo")

    class Meta:
        verbose_name = "Agenda de asistencia"
        verbose_name_plural = "Agendas de asistencia"
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
        verbose_name="Gimnasio",
    )

    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="attendances",
        verbose_name="Miembro",
    )

    schedule = models.ForeignKey(
        AttendanceSchedule,
        on_delete=models.SET_NULL,
        null=True,
        related_name="attendances",
        verbose_name="Agenda",
    )

    swap_request = models.ForeignKey(
        "ScheduleSwapRequest",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendances",
        verbose_name="Solicitud de intercambio",
    )

    slot = models.ForeignKey(
        ScheduleSlot,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="attendances",
        verbose_name="Horario",
    )

    date = models.DateField(auto_now_add=True, db_index=True, verbose_name="Fecha")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de creación")

    class Meta:
        verbose_name = "Asistencia"
        verbose_name_plural = "Asistencias"
        unique_together = ("gym", "schedule", "date")
        indexes = [
            models.Index(fields=["gym", "date"]),
        ]

    def __str__(self):
        return f"{self.member} - {self.date}"


class ScheduleChangeRequest(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pendiente"),
        ("approved", "Aprobado"),
        ("executed", "Ejecutado"),
        ("rejected", "Rechazado"),
        ("cancelled_by_member", "Cancelado por el socio"),
        ("cancelled_by_staff", "Cancelado por el staff"),
    ]

    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="schedule_change_requests",
        verbose_name="Gimnasio",
    )

    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="schedule_change_requests",
        verbose_name="Miembro",
    )

    current_schedule = models.ForeignKey(
        AttendanceSchedule,
        on_delete=models.PROTECT,
        related_name="change_requests_from",
        verbose_name="Agenda actual",
    )

    requested_slot = models.ForeignKey(
        ScheduleSlot,
        on_delete=models.PROTECT,
        related_name="change_requests_to",
        verbose_name="Horario solicitado",
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
        verbose_name="Estado",
    )

    requested_at = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de solicitud")
    reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name="Fecha de revisión")
    reviewed_by = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="Revisado por",
    )
    admin_notes = models.TextField(blank=True, verbose_name="Notas del administrador")

    class Meta:
        verbose_name = "Solicitud de cambio de horario"
        verbose_name_plural = "Solicitudes de cambio de horario"
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


class ScheduleSwapRequest(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pendiente"),
        ("approved", "Aprobado"),
        ("rejected", "Rechazado"),
        ("cancelled", "Cancelado"),
    ]

    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="schedule_swap_requests",
        verbose_name="Gimnasio",
    )

    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="schedule_swap_requests",
        verbose_name="Miembro",
    )

    origin_schedule = models.ForeignKey(
        AttendanceSchedule,
        on_delete=models.PROTECT,
        related_name="swap_requests_from",
        verbose_name="Agenda de origen",
    )

    destination_slot = models.ForeignKey(
        ScheduleSlot,
        on_delete=models.PROTECT,
        related_name="swap_requests_to",
        verbose_name="Horario de destino",
    )

    swap_date = models.DateField(verbose_name="Fecha de intercambio")

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
        verbose_name="Estado",
    )

    requested_at = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de solicitud")
    reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name="Fecha de revisión")
    reviewed_by = models.ForeignKey(
        "auth.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name="Revisado por",
    )
    admin_notes = models.TextField(blank=True, verbose_name="Notas del administrador")

    class Meta:
        verbose_name = "Solicitud de intercambio"
        verbose_name_plural = "Solicitudes de intercambio"
        ordering = ["-requested_at"]
        indexes = [
            models.Index(fields=["gym", "status"]),
            models.Index(fields=["member", "status"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["member", "origin_schedule", "swap_date"],
                condition=Q(status="pending"),
                name="unique_pending_swap_request",
            ),
        ]

    def __str__(self):
        return (
            f"{self.member} - "
            f"{self.origin_schedule.slot.day} "
            f"{self.origin_schedule.slot.hour} → "
            f"{self.destination_slot.day} "
            f"{self.destination_slot.hour} "
            f"({self.swap_date}) "
            f"({self.status})"
        )