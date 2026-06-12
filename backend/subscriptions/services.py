from datetime import date

from .models import Subscription


def get_member_active_subscription(member):
    today = date.today()

    active = Subscription.objects.filter(
        member=member,
        start_date__lte=today,
        end_date__gte=today,
    ).order_by("-created_at").first()

    if active:
        return active

    return Subscription.objects.filter(
        member=member,
    ).order_by("-created_at").first()


def get_member_schedule_limit(member):
    subscription = get_member_active_subscription(member)
    if subscription is None:
        return None
    return subscription.plan.weekly_visits


def get_member_active_schedule_count(member):
    return member.schedules.filter(active=True).count()
