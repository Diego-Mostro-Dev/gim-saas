from django.conf import settings
from django.utils import timezone

from rest_framework import viewsets, status

from core.viewsets import GymModelViewSet
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import RoutineAssignment, WorkoutSet
from members.models import Member
from django.shortcuts import get_object_or_404
from .serializers import MemberRoutineSerializer, WorkoutSetSerializer
from attendance.models import Attendance
from subscriptions.models import Subscription
from subscriptions.services import (
    get_first_day_of_next_month,
    get_subscription_payment_status,
)
from attendance.models import AttendanceSchedule
from payments.models import Payment
from plans.models import MembershipPlan
from config.api.throttles import PublicMemberRateThrottle
from .models import (
    Exercise,
    RoutineTemplate,
    RoutineExercise,
)



from .serializers import (
    ExerciseSerializer,
    RoutineTemplateSerializer,
    RoutineAssignmentSerializer,
    RoutineExerciseSerializer,
    ActiveRoutineSerializer,
    MemberRoutineSerializer,
    MemberPortalSerializer,
)


class ExerciseViewSet(GymModelViewSet):
    queryset = Exercise.objects.all()
    serializer_class = ExerciseSerializer
    pagination_class = None


class RoutineTemplateViewSet(GymModelViewSet):
    queryset = RoutineTemplate.objects.all()
    serializer_class = RoutineTemplateSerializer
    pagination_class = None


class RoutineAssignmentViewSet(GymModelViewSet):
    queryset = RoutineAssignment.objects.all()
    serializer_class = RoutineAssignmentSerializer


class RoutineExerciseViewSet(viewsets.ModelViewSet):
    queryset = RoutineExercise.objects.all()
    serializer_class = RoutineExerciseSerializer
    pagination_class = None

    def get_queryset(self):
        gym = self.request.user.profile.gym

        return RoutineExercise.objects.filter(
            routine_template__gym=gym
        ).select_related("exercise")


class MemberRoutineView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, member_id):
        gym = request.user.profile.gym

        assignment = (
            RoutineAssignment.objects
            .select_related(
                "member",
                "routine_template",
            )
            .prefetch_related(
                "routine_template__routine_exercises__exercise"
            )
            .filter(
                gym=gym,
                member_id=member_id,
                active=True,
            )
            .first()
        )

        if not assignment:
            return Response(
                {"detail": "No active routine assigned"},
                status=404,
            )

        serializer = MemberRoutineSerializer(
            assignment
        )

        return Response(serializer.data)


class MemberRoutineWhatsappView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, member_id):
        gym = request.user.profile.gym

        assignment = (
            RoutineAssignment.objects
            .select_related(
                "member",
                "routine_template",
            )
            .prefetch_related(
                "routine_template__routine_exercises__exercise"
            )
            .filter(
                gym=gym,
                member_id=member_id,
                active=True,
            )
            .first()
        )

        if not assignment:
            return Response(
                {"detail": "No active routine assigned"},
                status=404,
            )

        routine_url = (
            f"{settings.FRONTEND_URL}/routine/"
            f"{assignment.member.access_token}"
        )

        lines = [
            f"🏋️‍♂️ *{gym.name}*",
            "",
            f"Hola *{assignment.member.first_name}* 👋",
            "",
            "Te damos la bienvenida a tu portal de socio.",
            "",
            "📲 *Accedé a tu información acá:*",
            routine_url,
            "",
            f"📋 *{assignment.routine_template.name}*",
            "",
        ]

        exercises = (
            assignment
            .routine_template
            .routine_exercises
            .all()
            .order_by("order")
        )

        for item in exercises:
            lines.append(
                f"🔹 *{item.exercise.name}*"
            )

            if item.exercise_type == "cardio":
                if item.reps:
                    lines.append(f"   🏃 {item.reps} minutos")
                lines.append("   Descanso libre")
            else:
                reps_str = f" × {item.reps}" if item.reps else ""
                lines.append(
                    f"   {item.sets} series{reps_str}"
                )

                if item.exercise_type == "bodyweight":
                    lines.append("   🏋️ Peso corporal")
                elif item.weight and item.weight != "0":
                    lines.append(f"   🏋️ Peso: {item.weight} kg")

                rest_min = item.rest_seconds // 60
                rest_sec = item.rest_seconds % 60
                if rest_min > 0:
                    rest_str = f"{rest_min}min" + (f" {rest_sec}s" if rest_sec else "")
                else:
                    rest_str = f"{rest_sec}s"

                rest_mode_str = {
                    "between_sets": "entre series",
                    "after_exercise": "al finalizar",
                    "none": "sin descanso",
                }.get(item.rest_mode, "entre series")
                lines.append(f"   ⏱ {rest_str} descanso ({rest_mode_str})")

                if item.next_exercise_rest_seconds:
                    next_min = item.next_exercise_rest_seconds // 60
                    next_sec = item.next_exercise_rest_seconds % 60
                    if next_min > 0:
                        next_str = f"{next_min}min" + (f" {next_sec}s" if next_sec else "")
                    else:
                        next_str = f"{next_sec}s"
                    lines.append(f"   🔄 {next_str} antes del próximo")

            if item.notes:
                lines.append(
                    f"   📝 {item.notes}"
                )

            lines.append("")

        lines.extend([
            "🔥 ¡A entrenar fuerte!",
            f"Nos vemos en *{gym.name}* 💪",
        ])

        return Response({
            "phone": assignment.member.phone,
            "message": "\n".join(lines),
        })

    
class ActiveRoutinesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        gym = request.user.profile.gym

        assignments = (
            RoutineAssignment.objects
            .select_related(
                "member",
                "routine_template",
            )
            .filter(
                gym=gym,
                active=True,
            )
        )

        serializer = ActiveRoutineSerializer(
            assignments,
            many=True,
        )

        return Response(serializer.data)




class BulkAssignRoutineView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        gym = request.user.profile.gym

        member_ids = request.data.get(
            "member_ids",
            []
        )

        routine_template_id = request.data.get(
            "routine_template"
        )

        if not member_ids:
            return Response(
                {
                    "detail": "member_ids required"
                },
                status=400,
            )

        routine = RoutineTemplate.objects.filter(
            id=routine_template_id,
            gym=gym,
        ).first()

        if not routine:
            return Response(
                {
                    "detail": "Routine not found"
                },
                status=404,
            )

        members = Member.objects.filter(
            gym=gym,
            id__in=member_ids,
        )

        created = 0

        for member in members:

            RoutineAssignment.objects.filter(
                gym=gym,
                member=member,
                active=True,
            ).update(
                active=False
            )

            RoutineAssignment.objects.create(
                gym=gym,
                member=member,
                routine_template=routine,
                active=True,
            )

            created += 1

        return Response({
            "assigned_members": created,
            "routine": routine.name,
        })


class PublicWorkoutProgressView(APIView):
    permission_classes = []
    throttle_classes = [PublicMemberRateThrottle]

    def get(self, request, token):
        member = get_object_or_404(Member, access_token=token)

        assignment = RoutineAssignment.objects.filter(
            member=member, active=True
        ).first()

        if not assignment:
            return Response([], status=200)

        sets = WorkoutSet.objects.filter(
            routine_assignment=assignment
        )

        serializer = WorkoutSetSerializer(sets, many=True)
        return Response(serializer.data)

    def post(self, request, token):
        member = get_object_or_404(Member, access_token=token)

        assignment = RoutineAssignment.objects.filter(
            member=member, active=True
        ).first()

        if not assignment:
            return Response(
                {"detail": "No active routine"},
                status=400,
            )

        routine_exercise_id = request.data.get("routine_exercise")
        set_number = request.data.get("set_number")
        completed = request.data.get("completed", True)

        ws, created = WorkoutSet.objects.update_or_create(
            routine_assignment=assignment,
            routine_exercise_id=routine_exercise_id,
            set_number=set_number,
            defaults={
                "completed": completed,
                "completed_at": timezone.now() if completed else None,
            },
        )

        serializer = WorkoutSetSerializer(ws)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class PublicRoutineView(APIView):
    permission_classes = []
    throttle_classes = [PublicMemberRateThrottle]

    def get(self, request, token):
        member = get_object_or_404(
            Member,
            access_token=token,
        )

        assignment = (
            RoutineAssignment.objects
            .select_related(
                "member",
                "routine_template",
                "gym",
            )
            .prefetch_related(
                "routine_template__routine_exercises__exercise"
            )
            .filter(
                member=member,
                active=True,
            )
            .first()
        )

        if not assignment:
            return Response(
                {
                    "detail": "No active routine assigned",
                },
                status=404,
            )

        routine_serializer = MemberRoutineSerializer(
            assignment
        )

        today = timezone.localdate()

        active_subscription = (
            Subscription.objects
            .filter(
                member=member,
                start_date__lte=today,
                end_date__gte=today,
            )
            .first()
        )

        upcoming_subscription = None
        subscription = active_subscription

        if not subscription:
            upcoming_subscription = (
                Subscription.objects
                .filter(
                    member=member,
                    start_date__gt=today,
                )
                .order_by("start_date")
                .first()
            )
            subscription = upcoming_subscription

        subscription_data = None
        upcoming_subscription_data = None

        def _build_sub_data(sub):
            plan = sub.plan
            days_remaining = (
                sub.end_date - today
            ).days
            return {
                "id": sub.id,
                "plan_id": plan.id,
                "plan": plan.name,
                "plan_price": str(plan.price),
                "plan_duration_days": plan.duration_days,
                "plan_weekly_visits": plan.weekly_visits,
                "start_date": sub.start_date,
                "end_date": sub.end_date,
                "paid": sub.paid,
                "payment_status": get_subscription_payment_status(sub),
                "auto_renew": sub.auto_renew,
                "days_remaining": days_remaining,
                "renewal_reminder": (
                    sub.auto_renew
                    and 0 <= days_remaining <= 7
                ),
                "renewal_date": (
                    get_first_day_of_next_month(
                        sub.end_date
                    ).isoformat()
                    if sub.auto_renew
                    and 0 <= days_remaining <= 7
                    else None
                ),
            }

        if active_subscription:
            subscription_data = _build_sub_data(active_subscription)

        if upcoming_subscription:
            upcoming_subscription_data = _build_sub_data(upcoming_subscription)

        schedules = (
            AttendanceSchedule.objects
            .filter(
                member=member,
                active=True,
            )
            .select_related("slot")
            .order_by(
                "slot__day",
                "slot__hour",
            )
        )
        attendances = (
            Attendance.objects
            .filter(member=member)
            .order_by("-date")[:15]
        )

        payments_qs = (
            Payment.objects
            .filter(
                gym=member.gym,
                member=member,
            )
            .order_by("-paid_at")
            .values(
                "id",
                "plan_name",
                "amount",
                "payment_method",
                "paid_at",
            )
        )

        payments_list = list(payments_qs[:10])

        active_plans = (
            MembershipPlan.objects
            .filter(gym=member.gym, active=True)
            .order_by("price")
        )

        data = {
            "active_plans": [
                {
                    "id": p.id,
                    "name": p.name,
                    "description": p.description,
                    "price": str(p.price),
                    "duration_days": p.duration_days,
                    "weekly_visits": p.weekly_visits,
                }
                for p in active_plans
            ],
            "member": {
                    "id": member.id,
                    "first_name": member.first_name,
                    "last_name": member.last_name,
                    "phone": member.phone,
                    "email": member.email,
                    "photo": (
                        member.photo.url
                        if member.photo
                        else None
                    ),
                },
            "gym": {
                "id": assignment.gym.id,
                "name": assignment.gym.name,
                "logo_url": (
                    assignment.gym.logo.url
                    if assignment.gym.logo
                    else None
                ),
                "whatsapp": assignment.gym.whatsapp,
                "phone": assignment.gym.phone,
                "email": assignment.gym.email,
                "allow_member_schedule_changes": assignment.gym.allow_member_schedule_changes,
                "schedule_change_notice_hours": assignment.gym.schedule_change_notice_hours,
                "allow_plan_changes": assignment.gym.allow_plan_changes,
                "allow_schedule_changes": assignment.gym.allow_schedule_changes,
            },
            "subscription": subscription_data,
            "upcoming_subscription": upcoming_subscription_data,
            "schedules": [
                {
                    "id": schedule.id,
                    "day": schedule.slot.day,
                    "hour": schedule.slot.hour.strftime("%H:%M"),
                }
                for schedule in schedules
            ],
            "attendance_history": [
                {
                    "date": attendance.date,
                }
                for attendance in attendances
            ],
            "routine": routine_serializer.data,
            "last_payment": (
                payments_list[0]
                if payments_list
                else None
            ),
            "payments": payments_list,
        }

        serializer = MemberPortalSerializer(
            data
        )

        return Response(
            serializer.data
        )