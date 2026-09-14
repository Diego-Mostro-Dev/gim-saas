from django.core.management.base import BaseCommand
from django.conf import settings
from django.db import connection


class Command(BaseCommand):
    help = (
        "Muestra a qué base está conectado el entorno y verifica si apunta "
        "a una branch Neon compartida con otro entorno."
    )

    def handle(self, *args, **options):
        environment = settings.ENVIRONMENT
        db_host = settings.DATABASES["default"]["HOST"]
        db_name = settings.DATABASES["default"]["NAME"]

        self.stdout.write(f"ENVIRONMENT: {environment or '(no definido)'}")
        self.stdout.write(f"DB host: {db_host}")
        self.stdout.write(f"DB name: {db_name}")

        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT current_database(), current_user, inet_server_addr();")
                row = cursor.fetchone()
                self.stdout.write(f"DB actual: {row[0]}  usuario: {row[1]}  server: {row[2]}")
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f"No pude conectar a la DB: {exc}"))

        if environment == "staging" and db_name == "neondb":
            self.stdout.write(self.style.WARNING(
                "ADVERTENCIA: staging apunta a 'neondb'. Si esto comparte el "
                "endpoint con producción, ambos entornos escriben en la misma "
                "base. Revisá DATABASE_URL del servicio staging en Render."
            ))
        elif environment == "production" and db_name != "neondb":
            self.stdout.write(self.style.WARNING(
                "ADVERTENCIA: producción no apunta a una DB 'neondb'."
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                "Config de entorno/db parece consistente."
            ))