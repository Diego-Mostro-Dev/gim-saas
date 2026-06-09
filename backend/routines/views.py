from django.conf import settings
from django.utils import timezone

from rest_framework import viewsets

from core.viewsets import GymModelViewSet
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import RoutineAssignment
from members.models import Member
from django.shortcuts import get_object_or_404
from .serializers import MemberRoutineSerializer
from attendance.models import Attendance
from subscriptions.models import Subscription
from attendance.models import AttendanceSchedule
from payments.models import Payment
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


class RoutineTemplateViewSet(GymModelViewSet):
    queryset = RoutineTemplate.objects.all()
    serializer_class = RoutineTemplateSerializer


class RoutineAssignmentViewSet(GymModelViewSet):
    queryset = RoutineAssignment.objects.all()
    serializer_class = RoutineAssignmentSerializer


class RoutineExerciseViewSet(viewsets.ModelViewSet):
    queryset = RoutineExercise.objects.all()
    serializer_class = RoutineExerciseSerializer

    def get_queryset(self):
        gym = self.request.user.profile.gym

        return RoutineExercise.objects.filter(
            routine_template__gym=gym
        )


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

            lines.append(
                f"   {item.sets} series × {item.reps}"
            )

            if item.weight:
                lines.append(
                    f"   🏋️ Peso: {item.weight} kg"
                )

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


class PublicRoutineView(APIView):
    permission_classes = []

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

        subscription = (
            Subscription.objects
            .filter(
                member=member,
            )
            .order_by("-end_date")
            .first()
        )

        subscription_data = None

        if subscription:
            subscription_data = {
                "plan": subscription.plan.name,
                "start_date": subscription.start_date,
                "end_date": subscription.end_date,
                "paid": subscription.paid,
                "days_remaining": (
                    subscription.end_date - today
                ).days,
            }

        schedules = (
            AttendanceSchedule.objects
            .filter(
                member=member,
                active=True,
            )
            .order_by(
                "day",
                "hour",
            )
        )
        attendances = (
            Attendance.objects
            .filter(member=member)
            .order_by("-date")[:15]
        )

        member_name = (
            f"{member.first_name} "
            f"{member.last_name}"
        )

        payments_qs = (
            Payment.objects
            .filter(
                gym=member.gym,
                member_name__iexact=member_name,
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

        data = {
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
            },
            "subscription": subscription_data,
            "schedules": [
                {
                    "day": schedule.day,
                    "hour": schedule.hour.strftime("%H:%M"),
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