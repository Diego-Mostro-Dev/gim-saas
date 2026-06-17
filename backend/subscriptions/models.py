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
    )

    member = models.ForeignKey(Member, on_delete=models.CASCADE)
    plan = models.ForeignKey(MembershipPlan, on_delete=models.CASCADE)

    start_date = models.DateField()
    end_date = models.DateField(db_index=True)

    paid = models.BooleanField(default=False, db_index=True)

    auto_renew = models.BooleanField(
        default=True,
        help_text="Si la suscripción se renueva automáticamente al próximo mes",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
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
    )

    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="plan_change_requests",
    )

    requested_plan = models.ForeignKey(
        MembershipPlan,
        on_delete=models.PROTECT,
        related_name="change_requests",
    )

    current_schedules_snapshot = models.JSONField()

    target_schedules_snapshot = models.JSONField()

    current_plan_name_snapshot = models.CharField(
        max_length=100,
        null=True,
        blank=True,
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="pending",
    )

    effective_date = models.DateField(
        null=True,
        blank=True,
        help_text="Fecha en que el cambio de plan se hará efectivo. Calculada automáticamente al aprobar.",
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
    )

    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="planned_schedules",
    )

    plan_change = models.ForeignKey(
        PlanChangeRequest,
        on_delete=models.CASCADE,
        related_name="planned_schedules",
    )

    slot = models.ForeignKey(
        "attendance.ScheduleSlot",
        on_delete=models.PROTECT,
        related_name="planned_schedules",
    )

    slot_name = models.CharField(
        max_length=50,
        help_text="Snapshot del nombre del horario (ej: Lunes 10:00)",
    )

    day = models.CharField(
        max_length=20,
        help_text="Snapshot del día del horario (ej: monday)",
    )

    hour = models.CharField(
        max_length=10,
        help_text="Snapshot de la hora del horario (ej: 10:00)",
    )

    activated = models.BooleanField(
        default=False,
        help_text="Indica si las agendas ya fueron activadas tras la ejecución",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("member", "slot", "plan_change")
        indexes = [
            models.Index(fields=["gym", "activated"]),
        ]

    def __str__(self):
        return f"{self.member} → {self.slot_name} ({self.plan_change.status})"