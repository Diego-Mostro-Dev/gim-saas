import re
import unicodedata

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError

from gyms.models import Gym
from profiles.models import UserProfile


def slugify(name):
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")
    return slug or "gimnasio"


class Command(BaseCommand):
    help = "Crea un gimnasio nuevo y su primer usuario owner (creación centralizada)."

    def add_arguments(self, parser):
        parser.add_argument(
            "name",
            help="Nombre del gimnasio (ej: 'Atlas Gym Rosario')",
        )
        parser.add_argument(
            "--slug",
            help="Slug único (default: derivado del nombre).",
        )
        parser.add_argument(
            "--owner-username",
            required=True,
            help="Nombre de usuario del owner.",
        )
        parser.add_argument(
            "--owner-email",
            default="",
            help="Email del owner (opcional).",
        )
        parser.add_argument(
            "--owner-password",
            required=True,
            help="Contraseña inicial del owner.",
        )

    def handle(self, *args, **options):
        name = options["name"].strip()
        if not name:
            raise CommandError("El nombre del gimnasio es obligatorio.")

        slug = (options.get("slug") or slugify(name)).strip()
        if not re.match(r"^[a-z0-9-]+$", slug):
            raise CommandError("El slug solo puede contener letras, números y guiones.")

        if Gym.objects.filter(slug=slug).exists():
            raise CommandError(f"Ya existe un gimnasio con slug '{slug}'.")

        username = options["owner_username"].strip()
        password = options["owner_password"]
        email = (options.get("owner_email") or "").strip() or None

        if User.objects.filter(username=username).exists():
            raise CommandError(f"El usuario '{username}' ya existe.")

        gym = Gym.objects.create(name=name, slug=slug)
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
        )
        profile = user.profile
        profile.gym = gym
        profile.role = UserProfile.ROLE_OWNER
        profile.save()

        self.stdout.write(self.style.SUCCESS(f"Gimnasio creado: {gym.name} [{slug}]"))
        self.stdout.write(f"Owner: {user.username}")
        self.stdout.write(
            f"URL onboarding (configuración del owner): {gym.get_onboarding_url()}"
        )
        self.stdout.write(
            f"URL registro públicos de socios: {gym.get_public_register_url()}"
        )