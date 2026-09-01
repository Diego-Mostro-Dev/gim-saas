from django.core.management.base import BaseCommand

from config.api.backup import run_backup


class Command(BaseCommand):
    help = "Genera un backup de la base de datos y lo sube a Cloudinary (privado)."

    def handle(self, *args, **options):
        self.stdout.write("Generando backup...")
        result = run_backup()

        self.stdout.write(self.style.SUCCESS(
            "Backup subido: {file} ({size:,} bytes, vía {source})".format(
                file=result["file"],
                size=result["size_bytes"],
                source=result["source"],
            )
        ))
        self.stdout.write(f"Public ID: {result['public_id']}")
        self.stdout.write(f"URL firma: {result['download_url']}")
        self.stdout.write(
            f"Retención: {result['retention_kept']} guardados, "
            f"{result['retention_deleted'] or 0} eliminados"
        )