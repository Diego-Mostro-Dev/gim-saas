from django.db import models
from gyms.models import Gym
from members.models import Member
from plans.models import MembershipPlan
from datetime import timedelta

class Subscription(models.Model):

    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="subscriptions"
    )
    gym = models.ForeignKey(
    Gym,
    on_delete=models.CASCADE,
    null=True,
    blank=True,
    related_name="subscriptions",
)

    plan = models.ForeignKey(
        MembershipPlan,
        on_delete=models.PROTECT
    )

    start_date = models.DateField()

    end_date = models.DateField(blank=True)

    paid = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        self.end_date = (
            self.start_date +
            timedelta(days=self.plan.duration_days)
        )

        super().save(*args, **kwargs)

    def __str__(self):
        return (
            f"{self.member.first_name} "
            f"{self.member.last_name} - "
            f"{self.plan.name}"
        )
