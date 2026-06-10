from datetime import timedelta

from django.db.models import Count, Q, Sum
from django.utils.timezone import now

from rest_framework.response import Response
from rest_framework.views import APIView

from members.models import Member
from payments.models import Payment
from subscriptions.models import Subscription
from attendance.models import Attendance


class DashboardSummaryView(APIView):

    def get(self, request):
        gym = request.user.profile.gym
        today = now().date()

        current_month_start = today.replace(day=1)

        if current_month_start.month == 1:
            previous_month_start = current_month_start.replace(
                year=current_month_start.year - 1,
                month=12,
            )
        else:
            previous_month_start = current_month_start.replace(
                month=current_month_start.month - 1
            )

        # -------------------------
        # Active Members
        # -------------------------
        active_members = Member.objects.filter(
            gym=gym,
            active=True,
        ).count()

        # -------------------------
        # Revenues
        # -------------------------
        revenues = Payment.objects.filter(gym=gym).aggregate(
            current_month=Sum(
                "amount",
                filter=Q(
                    paid_at__date__gte=current_month_start
                ),
            ),
            previous_month=Sum(
                "amount",
                filter=Q(
                    paid_at__date__gte=previous_month_start,
                    paid_at__date__lt=current_month_start,
                ),
            ),
        )

        current_month_revenue = revenues["current_month"] or 0
        previous_month_revenue = revenues["previous_month"] or 0

        # -------------------------
        # Subscriptions
        # -------------------------
        all_subscriptions = list(
            Subscription.objects.filter(
                gym=gym
            ).select_related(
                "member",
                "plan",
            )
        )

        expiring_subs = [
            s for s in all_subscriptions
            if today <= s.end_date <= today + timedelta(days=7)
        ]

        expiring_soon = len(expiring_subs)

        upcoming_expirations_data = [
            {
                "id": sub.id,
                "member_name": f"{sub.member.first_name} {sub.member.last_name}",
                "plan_name": sub.plan.name,
                "days_remaining": (sub.end_date - today).days,
            }
            for sub in sorted(
                expiring_subs,
                key=lambda s: s.end_date,
            )[:5]
        ]

        recent_activity_data = [
            {
                "id": sub.id,
                "description": (
                    f"{sub.member.first_name} "
                    f"{sub.member.last_name} "
                    f"adquirió el plan {sub.plan.name}"
                ),
                "created_at": sub.created_at.strftime("%d/%m/%Y"),
            }
            for sub in sorted(
                all_subscriptions,
                key=lambda s: s.created_at,
                reverse=True,
            )[:5]
        ]

        pending_payments_data = [
            {
                "id": sub.id,
                "member_name": f"{sub.member.first_name} {sub.member.last_name}",
                "plan_name": sub.plan.name,
                "plan_price": float(sub.plan.price),
                "end_date": sub.end_date.strftime("%d/%m/%Y"),
            }
            for sub in sorted(
                [s for s in all_subscriptions if not s.paid],
                key=lambda s: s.end_date,
            )[:10]
        ]

        # -------------------------
        # Attendance
        # -------------------------
        attendance_counts = dict(
            Attendance.objects.filter(
                gym=gym,
                date__gte=today - timedelta(days=6),
                date__lte=today,
            )
            .values("date")
            .annotate(count=Count("id"))
            .values_list("date", "count")
        )

        day_labels = [
            "Lun",
            "Mar",
            "Mié",
            "Jue",
            "Vie",
            "Sáb",
            "Dom",
        ]

        weekly_attendance = []

        for days_ago in range(6, -1, -1):
            day = today - timedelta(days=days_ago)

            weekly_attendance.append({
                "day": day_labels[day.weekday()],
                "count": attendance_counts.get(day, 0),
            })

        return Response({
            "activeMembers": active_members,
            "currentMonthRevenue": float(current_month_revenue),
            "previousMonthRevenue": float(previous_month_revenue),
            "expiringSoon": expiring_soon,
            "upcomingExpirations": upcoming_expirations_data,
            "recentActivity": recent_activity_data,
            "pendingPayments": pending_payments_data,
            "weeklyAttendance": weekly_attendance,
        })
