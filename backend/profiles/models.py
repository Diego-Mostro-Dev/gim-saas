from django.db import models
from django.contrib.auth.models import User
from gyms.models import Gym


class UserProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile"
    )

    gym = models.ForeignKey(
    Gym,
    on_delete=models.CASCADE,
    related_name="users",
    null=True,
    blank=True
)

    def __str__(self):
        return self.user.username