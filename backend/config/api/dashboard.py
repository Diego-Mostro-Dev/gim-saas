from datetime import timedelta

from django.db.models import Sum
from django.utils.timezone import now

from rest_framework.response import Response
from rest_framework.views import APIView

from members.models import Member
from payments.models import Payment
from subscriptions.models import Subscription


class DashboardSummaryView(APIView):

    def get(self, request):
        gym = request.user.profile.gym
        today = now().date()

        active_members = Member.objects.filter(
            gym=gym,
            active=True
        ).count()

        expiring_soon = Subscription.objects.filter(
            gym=gym,
            end_date__gte=today,
            end_date__lte=today + timedelta(days=7)
        ).count()

        total_revenue = (
            Payment.objects.filter(
                gym=gym
            ).aggregate(
                total=Sum("amount")
            )["total"]
            or 0
        )

        upcoming_expirations = Subscription.objects.filter(
            gym=gym,
            end_date__gte=today,
            end_date__lte=today + timedelta(days=7)
        ).select_related(
            "member",
            "plan"
        ).order_by(
            "end_date"
        )[:5]

        upcoming_expirations_data = [
            {
                "id": sub.id,
                "member_name": (
                    f"{sub.member.first_name} "
                    f"{sub.member.last_name}"
                ),
                "plan_name": sub.plan.name,
                "days_remaining": (
                    sub.end_date - today
                ).days,
            }
            for sub in upcoming_expirations
        ]

        recent_subscriptions = Subscription.objects.filter(
            gym=gym
        ).select_related(
            "member",
            "plan"
        ).order_by(
            "-created_at"
        )[:5]

        recent_activity_data = [
            {
                "id": sub.id,
                "description": (
                    f"{sub.member.first_name} "
                    f"{sub.member.last_name} "
                    f"adquirió el plan "
                    f"{sub.plan.name}"
                ),
                "created_at": sub.created_at.strftime(
                    "%d/%m/%Y"
                ),
            }
            for sub in recent_subscriptions
        ]

        pending_payments = Subscription.objects.filter(
            gym=gym,
            paid=False,
        ).select_related(
            "member",
            "plan",
        ).order_by(
            "end_date"
        )[:10]

        pending_payments_data = [
            {
                "id": sub.id,
                "member_name": (
                    f"{sub.member.first_name} "
                    f"{sub.member.last_name}"
                ),
                "plan_name": sub.plan.name,
                "plan_price": float(
                    sub.plan.price
                ),
                "end_date": sub.end_date.strftime(
                    "%d/%m/%Y"
                ),
            }
            for sub in pending_payments
        ]

        return Response({
            "activeMembers": active_members,
            "totalRevenue": float(total_revenue),
            "expiringSoon": expiring_soon,
            "upcomingExpirations": upcoming_expirations_data,
            "recentActivity": recent_activity_data,
            "pendingPayments": pending_payments_data,
        })