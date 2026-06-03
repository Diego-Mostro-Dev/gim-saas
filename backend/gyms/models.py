import uuid
from django.db import models


class Gym(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)
    active = models.BooleanField(default=True)

    onboarding_code = models.UUIDField(
    default=uuid.uuid4,
    unique=True,
    editable=False
)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    def get_onboarding_url(self):
        return f"/onboarding/{self.onboarding_code}"

    def get_public_register_url(self):
        return f"/register/{self.onboarding_code}"