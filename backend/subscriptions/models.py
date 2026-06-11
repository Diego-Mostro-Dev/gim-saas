from django.db import models
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