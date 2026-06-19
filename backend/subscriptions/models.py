from django.db import models
from django.db.models import Q
from gyms.models import Gym
from members.models import Member
from plans.models import MembershipPlan


class Subscription(models.Model):
    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="subscriptions",
        verbose_name="Gimnasio",
    )

    member = models.ForeignKey(Member, on_delete=models.CASCADE, verbose_name="Miembro")
    plan = models.ForeignKey(MembershipPlan, on_delete=models.CASCADE, verbose_name="Plan")

    start_date = models.DateField(verbose_name="Fecha de inicio")
    end_date = models.DateField(db_index=True, verbose_name="Fecha de vencimiento")

    paid = models.BooleanField(default=False, db_index=True, verbose_name="Pagado")

    auto_renew = models.BooleanField(
        default=True,
        verbose_name="Renovación automática",
        help_text="Si la suscripción se renueva automáticamente al próximo mes",
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de creación")

    class Meta:
        verbose_name = "Suscripción"
        verbose_name_plural = "Suscripciones"
        indexes = [
            models.Index(fields=["gym", "end_date"]),
            models.Index(fields=["gym", "paid"]),
            models.Index(fields=["gym", "-created_at"]),
        ]


class PlanChangeRequest(models.Model):
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
        related_name="plan_change_requests",
        verbose_name="Gimnasio",
    )

    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="plan_change_requests",
        verbose_name="Miembro",
    )

    requested_plan = models.ForeignKey(
        MembershipPlan,
        on_delete=models.PROTECT,
        related_name="change_requests",
        verbose_name="Plan solicitado",
    )

    current_schedules_snapshot = models.JSONField(verbose_name="Horarios actuales")

    target_schedules_snapshot = models.JSONField(verbose_name="Horarios objetivo")

    current_plan_name_snapshot = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="Nombre del plan actual",
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
        verbose_name="Estado",
    )

    effective_date = models.DateField(
        null=True,
        blank=True,
        verbose_name="Fecha de efecto",
        help_text="Fecha en que el cambio de plan se hará efectivo. Calculada automáticamente al aprobar.",
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
        verbose_name = "Solicitud de cambio de plan"
        verbose_name_plural = "Solicitudes de cambio de plan"
        ordering = ["-requested_at"]
        indexes = [
            models.Index(fields=["gym", "status"]),
            models.Index(fields=["member", "status"]),
            models.Index(fields=["status", "effective_date"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["member"],
                condition=Q(status="pending"),
                name="unique_pending_plan_change_per_member",
            ),
        ]

    def __str__(self):
        return (
            f"{self.member} → "
            f"{self.requested_plan.name} "
            f"({self.status})"
        )


class PlannedSchedule(models.Model):
    gym = models.ForeignKey(
        Gym,
        on_delete=models.CASCADE,
        related_name="planned_schedules",
        verbose_name="Gimnasio",
    )

    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="planned_schedules",
        verbose_name="Miembro",
    )

    plan_change = models.ForeignKey(
        PlanChangeRequest,
        on_delete=models.CASCADE,
        related_name="planned_schedules",
        verbose_name="Cambio de plan",
    )

    slot = models.ForeignKey(
        "attendance.ScheduleSlot",
        on_delete=models.PROTECT,
        related_name="planned_schedules",
        verbose_name="Horario",
    )

    slot_name = models.CharField(
        max_length=50,
        verbose_name="Nombre del horario",
        help_text="Snapshot del nombre del horario (ej: Lunes 10:00)",
    )

    day = models.CharField(
        max_length=20,
        verbose_name="Día",
        help_text="Snapshot del día del horario (ej: monday)",
    )

    hour = models.CharField(
        max_length=10,
        verbose_name="Hora",
        help_text="Snapshot de la hora del horario (ej: 10:00)",
    )

    activated = models.BooleanField(
        default=False,
        verbose_name="Activado",
        help_text="Indica si las agendas ya fueron activadas tras la ejecución",
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Fecha de creación")

    class Meta:
        verbose_name = "Horario planificado"
        verbose_name_plural = "Horarios planificados"
        unique_together = ("member", "slot", "plan_change")
        indexes = [
            models.Index(fields=["gym", "activated"]),
        ]

    def __str__(self):
        return f"{self.member} → {self.slot_name} ({self.plan_change.status})"