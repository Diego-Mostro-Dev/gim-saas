from django.utils.timezone import now
from datetime import timedelta

from rest_framework.views import APIView
from rest_framework.response import Response

from members.models import Member
from subscriptions.models import Subscription


class DashboardSummaryView(APIView):

    def get(self, request):
        gym = request.user.profile.gym
        today = now().date()

        # 👇 FILTRO BASE OBLIGATORIO
        active_members = Member.objects.filter(
            gym=gym,
            active=True
        ).count()

        expiring_soon = Subscription.objects.filter(
            gym=gym,
            end_date__gte=today,
            end_date__lte=today + timedelta(days=7)
        ).count()

        subscriptions = Subscription.objects.filter(
            gym=gym,
            paid=True
        ).select_related("plan", "member")

        total_revenue = sum(
            sub.plan.price for sub in subscriptions
        )

        upcoming_expirations = Subscription.objects.filter(
            gym=gym,
            end_date__gte=today,
            end_date__lte=today + timedelta(days=7)
        ).select_related("member", "plan").order_by("end_date")[:5]

        upcoming_expirations_data = [
            {
                "id": sub.id,
                "member_name": f"{sub.member.first_name} {sub.member.last_name}",
                "plan_name": sub.plan.name,
                "days_remaining": (sub.end_date - today).days,
            }
            for sub in upcoming_expirations
        ]

        recent_subscriptions = Subscription.objects.filter(
            gym=gym
        ).select_related("member", "plan").order_by("-created_at")[:5]

        recent_activity_data = [
            {
                "id": sub.id,
                "description": f"{sub.member.first_name} {sub.member.last_name} adquirió el plan {sub.plan.name}",
                "created_at": sub.created_at.strftime("%d/%m/%Y"),
            }
            for sub in recent_subscriptions
        ]

        return Response({
            "activeMembers": active_members,
            "totalRevenue": float(total_revenue),
            "expiringSoon": expiring_soon,
            "upcomingExpirations": upcoming_expirations_data,
            "recentActivity": recent_activity_data,
        })