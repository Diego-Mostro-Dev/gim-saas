from django.apps import AppConfig


class MembersConfig(AppConfig):
    name = "members"

    def ready(self):
        # Conecta los receivers de members/signals.py (re-enlace de obra
        # social, Fase K5 · ACC-23).
        from . import signals  # noqa: F401
