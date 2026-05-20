from django.db import models

from members.models import Member
from plans.models import MembershipPlan


class Subscription(models.Model):

    member = models.ForeignKey(
        Member,
        on_delete=models.CASCADE,
        related_name="subscriptions"
    )

    plan = models.ForeignKey(
        MembershipPlan,
        on_delete=models.PROTECT
    )

    start_date = models.DateField()

    end_date = models.DateField()

    paid = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    