from django.db import models


class Member(models.Model):
    """A member of the gym."""
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)

    phone = models.CharField(max_length=30)
    email = models.EmailField(blank=True)

    active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"
