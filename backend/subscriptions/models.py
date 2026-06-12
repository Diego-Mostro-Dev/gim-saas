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
        ("rejected", "Rechazado"),
        ("cancelled", "Cancelado"),
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