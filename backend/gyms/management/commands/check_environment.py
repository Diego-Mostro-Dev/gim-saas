import os

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connection

from config.neon import neon_endpoint_role


class Command(BaseCommand):
    help = (
        "Muestra a qué base está conectado el entorno y verifica que no "
        "comparta endpoint Neon con otro entorno."
    )

    def handle(self, *args, **options):
        environment = settings.ENVIRONMENT
        db_host = settings.DATABASES["default"].get("HOST", "")
        db_name = settings.DATABASES["default"]["NAME"]

        self.stdout.write(f"ENVIRONMENT: {environment or '(no definido)'}")
        self.stdout.write(f"DB host: {db_host}")
        self.stdout.write(f"DB name: {db_name}")

        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT current_database(), current_user;")
                row = cursor.fetchone()
                self.stdout.write(f"DB actual: {row[0]}  usuario: {row[1]}")
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f"No pude conectar a la DB: {exc}"))

        host_role = neon_endpoint_role(db_host)

        if not environment:
            self.stdout.write(self.style.WARNING(
                "ENVIRONMENT no definido: no puedo verificar nada. En Render "
                "cada servicio debería definirlo (production / staging)."
            ))
            return

        # El nombre de la base no sirve para esto: todas las branches de Neon
        # se llaman neondb. Lo único que distingue una de otra es el endpoint,
        # que es único por branch.
        staging_fragment = os.getenv("NEON_ENDPOINT_STAGING", "green-sea-aqmezbmg")
        production_fragment = os.getenv("NEON_ENDPOINT_PRODUCTION", "round-sunset-aq8oo16v")

        if host_role is None:
            self.stdout.write(self.style.WARNING(
                f"No pude identificar la branch desde el host '{db_host}': no "
                f"contiene '{staging_fragment}' (staging) ni "
                f"'{production_fragment}' (production). Si es un "
                "endpoint nuevo, actualizá NEON_ENDPOINT_STAGING / "
                "NEON_ENDPOINT_PRODUCTION para que este check pueda validar."
            ))
        elif host_role != environment:
            self.stdout.write(self.style.ERROR(
                f"MIX DE BASE: ENVIRONMENT={environment} pero el host es la "
                f"branch de {host_role}. {environment} y {host_role} escriben "
                f"en la misma base. Corregí DATABASE_URL en Render."
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                f"Consistente: ENVIRONMENT={environment} y el host es la "
                f"branch de {host_role}."
            ))