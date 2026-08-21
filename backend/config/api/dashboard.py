from collections import Counter
from datetime import timedelta

from django.db.models import Count, Q, Sum
from django.utils.timezone import now

from rest_framework.response import Response
from rest_framework.views import APIView

from members.models import Member
from payments.models import Payment
from plans.services import public_plan_name
from subscriptions.models import Subscription
from subscriptions.services import gym_outstanding_subscriptions, get_subscription_payment_status
from attendance.models import Attendance
from routines.models import RoutineAssignment



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
        expiring_base = Subscription.objects.filter(
            gym=gym,
            end_date__gte=today,
            end_date__lte=today + timedelta(days=7),
        )

        expiring_soon = expiring_base.count()

        expiring_subs_list = list(
            expiring_base.select_related("member", "plan").order_by("end_date")[:5]
        )

        upcoming_expirations_data = [
            {
                "id": sub.id,
                "member_id": sub.member.id,
                "member_name": f"{sub.member.first_name} {sub.member.last_name}",
                "member_photo": sub.member.photo.url if sub.member.photo else None,
                "plan_name": public_plan_name(sub.plan),
                "days_remaining": (sub.end_date - today).days,
            }
            for sub in expiring_subs_list
        ]

        # -------------------------
        # Recent Activity (unified feed)
        # -------------------------
        LIMIT = 10
        events = []

        # 1. Payment events
        for pay in Payment.objects.filter(gym=gym).select_related("member").order_by("-paid_at")[:LIMIT * 5]:
            member_name = (
                f"{pay.member.first_name} {pay.member.last_name}"
                if pay.member else pay.member_name
            )
            events.append((
                pay.paid_at,
                {
                    "id": f"payment-{pay.id}",
                    "description": f"Pago registrado — {member_name} — ${float(pay.amount):,.0f}",
                    "created_at": pay.paid_at.strftime("%d/%m/%Y"),
                },
            ))

        # 2. Subscription events (new subscriptions)
        for sub in Subscription.objects.filter(gym=gym).select_related("member", "plan").order_by("-created_at")[:LIMIT * 5]:
            events.append((
                sub.created_at,
                {
                    "id": f"subscription-{sub.id}",
                    "description": (
                        f"Nueva suscripción — {sub.member.first_name} "
                        f"{sub.member.last_name} — {public_plan_name(sub.plan)}"
                    ),
                    "created_at": sub.created_at.strftime("%d/%m/%Y"),
                },
            ))

        # 3. Member events (new members)
        for member in Member.objects.filter(gym=gym).order_by("-created_at")[:LIMIT * 5]:
            events.append((
                member.created_at,
                {
                    "id": f"member-{member.id}",
                    "description": f"Nuevo miembro — {member.first_name} {member.last_name}",
                    "created_at": member.created_at.strftime("%d/%m/%Y"),
                },
            ))

        # 4. RoutineAssignment events
        for ra in RoutineAssignment.objects.filter(gym=gym).select_related("member").order_by("-assigned_at")[:LIMIT * 5]:
            events.append((
                ra.assigned_at,
                {
                    "id": f"assignment-{ra.id}",
                    "description": f"Rutina asignada — {ra.member.first_name} {ra.member.last_name}",
                    "created_at": ra.assigned_at.strftime("%d/%m/%Y"),
                },
            ))

        events.sort(key=lambda e: e[0], reverse=True)
        recent_activity_data = [item for _, item in events[:LIMIT]]

        outstanding = gym_outstanding_subscriptions(gym)

        def _payment_status(item):
            sub = item["subscription"]
            return get_subscription_payment_status(
                sub,
                remaining=item["remaining"],
                is_first=item["is_first"],
            )

        outstanding_status = {
            item["subscription"].id: _payment_status(item)
            for item in outstanding
        }

        pending_candidates = [
            item
            for item in outstanding
            if item["subscription"].end_date >= today
        ]
        pending_candidates.sort(key=lambda item: item["subscription"].end_date)

        pending_payments_data = []
        for item in pending_candidates[:10]:
            sub = item["subscription"]
            pending_payments_data.append({
                "id": sub.id,
                "member_id": sub.member.id,
                "member_name": f"{sub.member.first_name} {sub.member.last_name}",
                "member_photo": sub.member.photo.url if sub.member.photo else None,
                "plan_name": public_plan_name(sub.plan),
                "remaining": float(item["remaining"]),
                "end_date": sub.end_date.strftime("%d/%m/%Y"),
            })

        # -------------------------
        # Attendance
        # -------------------------
        monday = today - timedelta(days=today.weekday())

        attendance_counts = dict(
            Attendance.objects.filter(
                gym=gym,
                date__gte=monday,
                date__lte=monday + timedelta(days=6),
            )
            .values("date")
            .annotate(count=Count("id"))
            .values_list("date", "count")
        )

        DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

        weekly_attendance = [
            {
                "day": DAY_LABELS[i],
                "count": attendance_counts.get(monday + timedelta(days=i), 0),
            }
            for i in range(7)
        ]

        active_outstanding = [
            item
            for item in outstanding
            if item["subscription"].start_date <= today
            and item["subscription"].end_date >= today
        ]

        payment_due_day = gym.payment_due_day
        access_block_day = gym.access_block_day

        status_counts = Counter(
            outstanding_status[item["subscription"].id]
            for item in active_outstanding
        )

        overdue_count = status_counts["overdue"]
        blocked_count = status_counts["blocked"]
        initial_pending_count = status_counts["initial_pending"]

        return Response({
            "activeMembers": active_members,
            "currentMonthRevenue": float(current_month_revenue),
            "previousMonthRevenue": float(previous_month_revenue),
            "expiringSoon": expiring_soon,
            "overdueCount": overdue_count,
            "blockedCount": blocked_count,
            "initialPendingCount": initial_pending_count,
            "paymentDueDay": payment_due_day,
            "accessBlockDay": access_block_day,
            "upcomingExpirations": upcoming_expirations_data,
            "recentActivity": recent_activity_data,
            "pendingPayments": pending_payments_data,
            "weeklyAttendance": weekly_attendance,
        })
