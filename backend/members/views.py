import json

from datetime import time

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny

from django.shortcuts import get_object_or_404
from django.db.models import Prefetch

from activities.models import Activity, Enrollment
from activities.overlap import validate_gym_activity_overlap
from attendance.models import ScheduleSlot
from core.viewsets import GymModelViewSet
from gyms.features import require_activities
from payments.models import Payment

from attendance.models import AttendanceSchedule
from config.api.throttles import (
    PublicMemberRateThrottle,
)
from members.eligibility import MemberEligibility
from plans.models import MembershipPlan
from plans.services import public_plan_name_from_snapshot

from .models import Member
from .serializers import (
    MemberSerializer,
    MemberPhotoSerializer,
)
from .services import RegistrationError, RegistrationService, validate_activity_schedules


class MemberViewSet(GymModelViewSet):
    queryset = Member.objects.all()
    serializer_class = MemberSerializer
    pagination_class = None

    def get_queryset(self):
        return super().get_queryset().prefetch_related(
            Prefetch(
                "schedules",
                queryset=AttendanceSchedule.objects.filter(
                    active=True
                ).select_related("slot"),
            ),
            "subscription_set__plan",
        )

    def create(self, request, *args, **kwargs):
        gym = self.get_gym()

        raw_services = request.data.get("services", [])
        if isinstance(raw_services, str):
            try:
                raw_services = json.loads(raw_services)
            except (json.JSONDecodeError, TypeError):
                raw_services = []

        if not isinstance(raw_services, list) or not raw_services:
            raw_services = ["gym"]

        valid_services = {"gym", "activities"}
        raw_services = [s for s in raw_services if s in valid_services]
        if not raw_services:
            raw_services = ["gym"]

        has_gym = "gym" in raw_services
        has_activities = "activities" in raw_services

        if has_activities:
            require_activities(gym)

        entry_mode = "GYM" if has_gym else "ACTIVITY_ONLY"

        raw_gym_schedules = request.data.get("schedules", [])
        if isinstance(raw_gym_schedules, str):
            try:
                raw_gym_schedules = json.loads(raw_gym_schedules)
            except (json.JSONDecodeError, TypeError):
                raw_gym_schedules = []

        if has_gym and not isinstance(raw_gym_schedules, list):
            raw_gym_schedules = []

        if has_gym and not raw_gym_schedules:
            return Response(
                {"schedules": "Debe seleccionar al menos un horario de gimnasio."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        activity_entries = []
        if has_activities:
            raw = request.data.get("activity_schedules", [])
            if isinstance(raw, str):
                try:
                    raw = json.loads(raw)
                except (json.JSONDecodeError, TypeError):
                    return Response(
                        {"activity_schedules": "Formato inválido."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            if not isinstance(raw, list):
                return Response(
                    {"activity_schedules": "Debe ser una lista."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            try:
                activity_entries = validate_activity_schedules(gym, raw)
            except ValueError as e:
                return Response(
                    {"activity_schedules": str(e)},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if has_gym and has_activities and raw_gym_schedules:
            gym_slots = []
            for s in raw_gym_schedules:
                h, m = map(int, s["hour"].split(":"))
                gym_slot = ScheduleSlot.objects.filter(
                    gym=gym, day=s["day"],
                    hour=time(h, m),
                ).first()
                if gym_slot:
                    gym_slots.append(gym_slot)

            if gym_slots:
                try:
                    validate_gym_activity_overlap(
                        gym_slots,
                        [e["schedule"] for e in activity_entries],
                    )
                except ValueError as e:
                    return Response(
                        {"activity_schedules": str(e)},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

        member_data = request.data.copy()
        member_data.pop("services", None)
        member_data.pop("activity_schedules", None)
        member_data.pop("schedules", None)
        plan_id = member_data.pop("plan_id", None)

        if isinstance(plan_id, list):
            plan_id = plan_id[0] if plan_id else None
        if plan_id in ("", None):
            plan_id = None

        member_data["entry_mode"] = entry_mode

        serializer = MemberSerializer(
            data=member_data,
            context={"gym": gym},
        )
        serializer.is_valid(raise_exception=True)

        if plan_id is not None:
            if not MembershipPlan.objects.filter(
                id=plan_id, gym=gym, is_base=False
            ).exists():
                return Response(
                    {"plan_id": "El plan seleccionado no es válido."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            member = RegistrationService.register(
                gym=gym,
                validated_member_data=serializer.validated_data,
                plan_id=plan_id,
                activity_entries=activity_entries,
                has_gym=has_gym,
                has_activities=has_activities,
                raw_schedules=raw_gym_schedules,
            )
        except RegistrationError as e:
            return Response(e.detail, status=e.status_code)

        return Response(
            MemberSerializer(member).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):

        return super().update(
            request,
            *args,
            **kwargs,
        )

    @action(
        detail=False,
        methods=["get"],
    )
    def activities(self, request):
        gym = self.get_gym()
        require_activities(gym)

        activities = Activity.objects.filter(
            service__gym=gym,
            active=True,
        ).prefetch_related("schedules")

        result = []
        for activity in activities:
            schedules = []
            for schedule in activity.schedules.filter(active=True):
                enrolled_count = Enrollment.objects.filter(
                    schedule=schedule,
                    active=True,
                ).count()
                available = schedule.capacity - enrolled_count
                if available > 0:
                    schedules.append({
                        "id": schedule.id,
                        "day": schedule.day,
                        "start_time": schedule.start_time.strftime("%H:%M"),
                        "end_time": schedule.end_time.strftime("%H:%M"),
                        "capacity": schedule.capacity,
                        "available_spots": available,
                    })

            result.append({
                "id": activity.id,
                "name": activity.name,
                "description": activity.description,
                "monthly_price": str(activity.monthly_price),
                "schedules": schedules,
            })

        return Response(result)

    @action(
        detail=True,
        methods=["get"],
    )
    def payments(self, request, pk=None):
        member = self.get_object()

        payments = list(
            Payment.objects.filter(
                gym=member.gym,
                member=member,
            )
            .order_by("-paid_at")
            .values(
                "id",
                "member_name",
                "plan_name",
                "amount",
                "payment_method",
                "paid_at",
                "subscription_end_date",
            )
        )

        for pay in payments:
            pay["plan_name"] = public_plan_name_from_snapshot(pay["plan_name"])

        return Response(payments)


class PublicMemberPhotoView(APIView):

    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [PublicMemberRateThrottle]

    def patch(self, request, token):
        member = get_object_or_404(
            Member,
            access_token=token,
        )

        if not MemberEligibility.can_operate(member):
            return Response(
                {"detail": "Acceso suspendido por falta de pago."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = MemberPhotoSerializer(
            member,
            data=request.data,
            partial=True,
        )

        serializer.is_valid(
            raise_exception=True,
        )

        serializer.save()

        return Response(serializer.data)