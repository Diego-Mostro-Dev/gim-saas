import logging
import re
import unicodedata

from django.contrib.auth.models import User
from django.db import transaction

from activities.models import Activity, ActivitySchedule
from attendance.models import ScheduleSlot
from gyms.models import Discount, Gym, GymClosedDate
from members.models import HealthInsurance
from plans.models import MembershipPlan, Service
from plans.services import ensure_base_plan_for_gym
from profiles.models import UserProfile

logger = logging.getLogger(__name__)


def slugify(name):
    """Slug ASCII-friendly a partir de un nombre (ej: "Box Crossfit" -> box-crossfit)."""
    normalized = unicodedata.normalize(
        "NFKD", name
    ).encode("ascii", "ignore").decode()
    raw = re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")
    return raw[:80] or "servicio"


def _resolve_service(gym, name):
    """Obtiene o crea el Service del gym por slug (reutilizando defaults de gym)."""
    slug = slugify(name)
    service, created = Service.objects.get_or_create(
        gym=gym,
        slug=slug,
        defaults={
            "name": name.strip(),
            "description": "",
            "active": True,
        },
    )
    if created:
        logger.info("Admin gym %s: servicio creado '%s'", gym.slug, service.name)
    return service


@transaction.atomic
def create_gym_with_config(data):
    """Crea un gimnasio completo a partir del payload validado del panel admin.

    Corre dentro de una transacción: si algo falla a mitad de camino, no queda
    ningún gimnasio ni entidad creada a medias.
    """
    slug = (data.get("slug") or slugify(data["name"])).strip()

    gym = Gym(
        name=data["name"].strip(),
        slug=slug,
        active=data.get("active", True),
        whatsapp=data.get("whatsapp", ""),
        phone=data.get("phone", ""),
        email=data.get("email", ""),
        qr_attendance_message=data.get("qr_attendance_message", ""),
        qr_registration_message=data.get("qr_registration_message", ""),
        default_schedule_capacity=data.get("default_schedule_capacity"),
        payment_due_day=data.get("payment_due_day", 10),
        access_block_day=data.get("access_block_day", 16),
        allow_plan_changes=data.get("allow_plan_changes", True),
        allow_schedule_changes=data.get("allow_schedule_changes", True),
        schedule_change_cooldown_hours=data.get("schedule_change_cooldown_hours", 168),
        max_schedule_changes_per_month=data.get("max_schedule_changes_per_month", 4),
        allow_session_recovery=data.get("allow_session_recovery", False),
        max_session_recoveries_per_month=data.get("max_session_recoveries_per_month", 2),
        features=data.get("features", {}),
        seo_title=data.get("seo_title", ""),
        seo_description=data.get("seo_description", ""),
        seo_keywords=data.get("seo_keywords", ""),
        seo_city=data.get("seo_city", ""),
        seo_address=data.get("seo_address", ""),
        seo_hours=data.get("seo_hours", ""),
    )

    logo = data.get("logo")
    if logo:
        gym.logo = _upload_image(logo, "gyms")
    app_icon = data.get("app_icon")
    if app_icon:
        gym.app_icon = _upload_image(app_icon, "gyms")

    gym.full_clean()
    gym.save()

    # Servicios declarados en el wizard + defaults ("Gimnasio").
    for service in data.get("services", []):
        _resolve_service(gym, service["name"])

    default_service = Service.get_default_for_gym(gym)
    ensure_base_plan_for_gym(gym)

    # Planes
    for plan_data in data.get("plans", []):
        service = _resolve_service(gym, plan_data["service"])
        if MembershipPlan.objects.filter(gym=gym, name=plan_data["name"].strip()).exists():
            continue
        MembershipPlan.objects.create(
            gym=gym,
            service=service,
            name=plan_data["name"].strip(),
            description=plan_data.get("description", ""),
            price=plan_data.get("price", 0),
            duration_days=plan_data.get("duration_days", 30),
            weekly_visits=plan_data.get("weekly_visits"),
            active=plan_data.get("active", True),
            is_base=False,
        )

    # Actividades (si la feature está activa)
    activities_payload = data.get("activities", [])
    if activities_payload:
        for act in activities_payload:
            service = _resolve_service(gym, act.get("service") or "Actividades")
            activity = Activity(
                service=service,
                name=act["name"].strip(),
                description=act.get("description", ""),
                instructor_name=act.get("instructor_name", ""),
                monthly_price=act.get("monthly_price", 0),
                billing_mode=act.get("billing_mode", "monthly"),
                active=act.get("active", True),
            )
            activity.save()
            for sched in act.get("schedules", []):
                ActivitySchedule.objects.create(
                    activity=activity,
                    day=sched["day"],
                    start_time=sched["start_time"],
                    end_time=sched["end_time"],
                    capacity=sched["capacity"],
                    active=sched.get("active", True),
                )

    # Franjas horarias
    for slot in data.get("slots", []):
        ScheduleSlot.objects.create(
            gym=gym,
            day=slot["day"],
            hour=slot["hour"],
            capacity=slot.get("capacity"),
        )

    # Descuentos
    for disc in data.get("discounts", []):
        Discount.objects.create(
            gym=gym,
            name=disc["name"].strip(),
            discount_percent=disc["discount_percent"],
            active=disc.get("active", True),
        )

    # Obras sociales
    for hi in data.get("health_insurances", []):
        HealthInsurance.objects.create(
            gym=gym,
            name=hi["name"].strip(),
            session_price=hi.get("session_price", 0),
            sellado_amount=hi.get("sellado_amount"),
            active=hi.get("active", True),
        )

    # Fechas cerradas
    for cd in data.get("closed_dates", []):
        GymClosedDate.objects.create(
            gym=gym,
            date=cd["date"],
            reason=cd.get("reason", ""),
        )

    # Owner
    owner_created = False
    owner = data.get("owner") or {}
    if owner.get("mode") == "credentials":
        user = User.objects.create_user(
            username=owner["username"].strip(),
            email=owner.get("email") or "",
            password=owner["password"],
        )
        profile = user.profile
        profile.gym = gym
        profile.role = UserProfile.ROLE_OWNER
        profile.save()
        owner_created = True

    logger.info(
        "Admin gym creado: %s [%s] (activities=%s, owner_created=%s)",
        gym.name,
        gym.slug,
        gym.features.get("activities", False),
        owner_created,
    )

    return gym, owner_created


def _upload_image(url, folder):
    from cloudinary import uploader

    try:
        result = uploader.upload(
            file=url,
            folder=folder,
            resource_type="image",
            overwrite=False,
        )
    except Exception as exc:  # noqa: BLE001 - propagamos como error legible
        raise ValueError(
            f"No se pudo cargar la imagen '{url}': {exc}"
        ) from exc

    return result["public_id"]