from django.utils.timezone import now
from datetime import timedelta

from rest_framework.views import APIView
from rest_framework.response import Response

from members.models import Member
from subscriptions.models import Subscription


class DashboardSummaryView(APIView):

    def get(self, request):
        today = now().date()

        active_members = (
            Member.objects.filter(
                active=True
            ).count()
        )

        expiring_soon = (
            Subscription.objects.filter(
                end_date__gte=today,
                end_date__lte=today + timedelta(days=7)
            ).count()
        )

        total_revenue = 0

        subscriptions = (
            Subscription.objects.filter(
                paid=True
            ).select_related("plan")
        )

        for subscription in subscriptions:
            total_revenue += subscription.plan.price

        upcoming_expirations = (
            Subscription.objects.filter(
                end_date__gte=today,
                end_date__lte=today + timedelta(days=7)
            )
            .select_related("member", "plan")
            .order_by("end_date")[:5]
        )

        upcoming_expirations_data = []

        for subscription in upcoming_expirations:
            upcoming_expirations_data.append({
                "id": subscription.id,
                "member_name":
                    f"{subscription.member.first_name} "
                    f"{subscription.member.last_name}",
                "plan_name": subscription.plan.name,
                "days_remaining":
                    (subscription.end_date - today).days,
            })

        recent_activity_data = []

        recent_subscriptions = (
            Subscription.objects
            .select_related("member", "plan")
            .order_by("-created_at")[:5]
        )

        for subscription in recent_subscriptions:
            recent_activity_data.append({
                "id": subscription.id,
                "description":
                    f"{subscription.member.first_name} "
                    f"{subscription.member.last_name} "
                    f"adquirió el plan "
                    f"{subscription.plan.name}",
                "created_at":
                    subscription.created_at.strftime("%d/%m/%Y"),
            })

        return Response({
            "activeMembers": active_members,
            "totalRevenue": float(total_revenue),
            "expiringSoon": expiring_soon,
            "upcomingExpirations":
                upcoming_expirations_data,
            "recentActivity":
                recent_activity_data,
        })