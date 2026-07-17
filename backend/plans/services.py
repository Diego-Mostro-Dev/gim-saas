from .models import MembershipPlan, Service


BASE_PLAN_NAME = "Base Access"


def ensure_base_plan_for_gym(gym):
    """Ensure a hidden Base Plan exists for the given gym.

    Returns the Base Plan instance. Creates one if it doesn't exist.
    The Base Plan is used for activity-only members who don't purchase
    a gym membership.
    """
    service = Service.get_default_for_gym(gym)
    plan, _created = MembershipPlan.objects.get_or_create(
        gym=gym,
        name=BASE_PLAN_NAME,
        defaults={
            "service": service,
            "description": "Acceso básico para actividades sin membresía.",
            "price": 0,
            "duration_days": 30,
            "weekly_visits": None,
            "active": True,
            "is_base": True,
        },
    )
    return plan


def get_base_plan_for_gym(gym):
    """Return the Base Plan for a gym, or None if it doesn't exist."""
    try:
        return MembershipPlan.objects.get(gym=gym, is_base=True)
    except MembershipPlan.DoesNotExist:
        return None
