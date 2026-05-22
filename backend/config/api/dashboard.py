from datetime import date, timedelta

from rest_framework.decorators import api_view
from rest_framework.response import Response

from members.models import Member
from subscriptions.models import Subscription


@api_view(["GET"])
def dashboard_summary(request):
    today = date.today()
    next_7_days = today + timedelta(days=7)

    # 👤 miembros activos
    active_members = Member.objects.filter(active=True).count()

    # 💰 ingresos (solo pagos confirmados)
    paid_subscriptions = Subscription.objects.filter(paid=True)
    total_revenue = sum(sub.plan.price for sub in paid_subscriptions)

    # ⏳ vencimientos próximos
    expiring_soon = Subscription.objects.filter(
        end_date__lte=next_7_days,
        end_date__gte=today
    ).count()

    expiring_subscriptions_qs = Subscription.objects.select_related(
    "member",
    "plan"
).filter(
    end_date__lte=next_7_days,
    end_date__gte=today
).order_by("end_date")[:5]
    upcoming_expirations = [
    {
        "member": (
            f"{sub.member.first_name} "
            f"{sub.member.last_name}"
        ),
        "plan": sub.plan.name,
        "days_left": (
            sub.end_date - today
        ).days,
    }
    for sub in expiring_subscriptions_qs
]

    # 🟣 actividad reciente (últimas 5 suscripciones creadas)
    recent_activity_qs = Subscription.objects.select_related(
        "member", "plan"
    ).order_by("-created_at")[:5]

    recent_activity = [
        {
            "member": f"{sub.member.first_name} {sub.member.last_name}",
            "plan": sub.plan.name,
            "paid": sub.paid,
            "created_at": sub.created_at
        }
        for sub in recent_activity_qs
    ]

    return Response({
        "activeMembers": active_members,
        "totalRevenue": float(total_revenue),
        "expiringSoon": expiring_soon,
        "recentActivity": recent_activity,
        "upcomingExpirations": upcoming_expirations,
    })
