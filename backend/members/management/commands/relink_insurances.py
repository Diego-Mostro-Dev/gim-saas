"""Re-enlace de las obras sociales de un gym (Fase K5 · ACC-23).

Los socios que escribieron una obra social que el gym todavía no tenía
configurada quedaron con texto y sin vínculo: el coseguro por sesión no
tenía de dónde salir. Cuando el gym configura esa obra social, el signal
``post_save`` los reenlaza uno por uno; este comando hace lo mismo para
todo el gym de una vez, para el caso de las obras que ya estaban
configuradas (o para recuperar el enlace después de una corrección de
datos).

Uso:

    python manage.py relink_insurances --gym <gym_id>
    python manage.py relink_insurances --all
"""

from django.core.management.base import BaseCommand, CommandError

from gyms.models import Gym
from members.insurance import relink_insurances_for_gym
from members.models import Member


class Command(BaseCommand):
    help = "Enlaza los socios con la obra social configurada que ya tienen escrita."

    def add_arguments(self, parser):
        parser.add_argument(
            "--gym",
            type=int,
            help="ID del gym a reenlazar.",
        )
        parser.add_argument(
            "--all",
            action="store_true",
            help="Reenlaza en todos los gyms.",
        )

    def handle(self, *args, **options):
        gym_id = options.get("gym")
        run_all = options.get("all")

        if not gym_id and not run_all:
            raise CommandError("Pasá --gym <id> o --all.")

        if gym_id:
            gyms = list(Gym.objects.filter(pk=gym_id))
            if not gyms:
                raise CommandError(f"No existe el gym {gym_id}.")
        else:
            gyms = list(Gym.objects.all())

        total_linked = 0
        for gym in gyms:
            pending = (
                Member.objects.filter(gym=gym, insurance__isnull=True)
                .exclude(health_insurance="")
                .count()
            )
            linked = relink_insurances_for_gym(gym)
            total_linked += linked
            self.stdout.write(
                f"{gym.name}: {linked} socio(s) enlazados "
                f"({pending} con obra social sin verificar antes)."
            )

        self.stdout.write(self.style.SUCCESS(f"Total: {total_linked} socio(s) enlazados."))
