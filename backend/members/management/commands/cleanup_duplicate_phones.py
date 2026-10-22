"""Limpieza de teléfonos duplicados (Fase K5 · ACC-19).

El teléfono identifica al socio dentro del gym, pero la base permitía
duplicados: en producción había 12 grupos (37 socios con teléfonos 1..15 en
el gym de pruebas y 3 socios de test con 000-0000).

El comando no borra socios (muchos tienen pagos y suscripciones
protegidas): le devuelve el teléfono a cada uno. El más antiguo conserva
el teléfono; los demás quedan con el sufijo ``-<id>``, que los mantiene
trazables.

Uso:

    python manage.py cleanup_duplicate_phones --dry-run
    python manage.py cleanup_duplicate_phones --apply
    python manage.py cleanup_duplicate_phones --apply --gym 12
"""

from django.core.management.base import BaseCommand

from members.phone_cleanup import apply_phone_dedupe, plan_phone_dedupe


class Command(BaseCommand):
    help = "Devuelve un teléfono único a los socios con teléfono duplicado en su gym."

    def add_arguments(self, parser):
        parser.add_argument(
            "--gym",
            type=int,
            help="ID del gym a limpiar (por defecto, todos).",
        )
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Aplica los cambios. Sin este flag sólo se informa (dry-run).",
        )

    def handle(self, *args, **options):
        gym = options.get("gym")
        apply = options.get("apply")

        changes = (
            apply_phone_dedupe(gym=gym)
            if apply
            else plan_phone_dedupe(gym=gym)
        )

        if not changes:
            self.stdout.write(self.style.SUCCESS("No hay teléfonos duplicados."))
            return

        for change in changes:
            self.stdout.write(
                f"gym {change['gym_id']} · socio {change['member_id']}: "
                f"{change['old_phone']} → {change['new_phone']} "
                f"(el {change['keeper_id']} conserva {change['old_phone']})"
            )

        prefix = "Aplicados" if apply else "Pendientes"
        self.stdout.write(
            self.style.SUCCESS(f"{prefix}: {len(changes)} teléfono(s) a cambiar.")
        )
