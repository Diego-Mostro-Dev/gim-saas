import json
from datetime import time

from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from activities.overlap import validate_gym_activity_overlap
from attendance.models import ScheduleSlot
from attendance.utils import SCHEDULE_SLOT_WEEKDAY_ORDER
from gyms.features import require_activities
from gyms.models import Gym
from plans.models import MembershipPlan

from .serializers import MemberSerializer, PublicMemberSerializer
from .services import RegistrationError, RegistrationService, validate_activity_schedules
from config.api.throttles import PublicMemberRateThrottle, PublicRegisterRateThrottle


VALID_SERVICES = frozenset({"gym", "activities"})


class PublicRegisterView(APIView):

    authentication_classes = []
    permission_classes = []
    throttle_classes = [PublicRegisterRateThrottle]

    def post(self, request, gym_code):

        gym = get_object_or_404(
            Gym,
            onboarding_code=gym_code,
        )

        services = request.data.get("services")

        if services is not None:
            return self._onboarding_register(request, gym, services)

        # Legacy payload (no "services" field) is treated as gym-only:
        # route it through the same RegistrationService flow so every entry
        # path shares the exact same rules (capacity, required plan, overlap).
        return self._onboarding_register(request, gym, ["gym"])

    # ── New onboarding flow ───────────────────────────────────────────────

    def _onboarding_register(self, request, gym, services):

        if isinstance(services, str):
            try:
                services = json.loads(services)
            except (json.JSONDecodeError, TypeError):
                return Response(
                    {"services": "Formato inválido."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if not isinstance(services, list) or not services:
            return Response(
                {"services": "Debe seleccionar al menos un servicio."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        invalid = [s for s in services if s not in VALID_SERVICES]
        if invalid:
            return Response(
                {"services": f"Servicio(s) inválido(s): {', '.join(invalid)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        has_gym = "gym" in services
        has_activities = "activities" in services
        entry_mode = "GYM" if has_gym else "ACTIVITY_ONLY"

        if has_activities:
            require_activities(gym)

        if has_gym:
            raw_schedules = request.data.get("schedules", [])
            if isinstance(raw_schedules, str):
                try:
                    raw_schedules = json.loads(raw_schedules)
                except (json.JSONDecodeError, TypeError):
                    raw_schedules = []

            if not isinstance(raw_schedules, list) or not raw_schedules:
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

        if has_gym and has_activities:
            raw_gym = request.data.get("schedules", [])
            if isinstance(raw_gym, str):
                try:
                    raw_gym = json.loads(raw_gym)
                except (json.JSONDecodeError, TypeError):
                    raw_gym = []

            if raw_gym:
                gym_slots = []
                for s in raw_gym:
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
        raw_schedules = request.data.get("schedules", [])
        plan_id = request.data.get("plan_id")
        member_data.pop("schedules", None)
        member_data.pop("plan_id", None)
        member_data["entry_mode"] = entry_mode

        if isinstance(raw_schedules, str):
            try:
                raw_schedules = json.loads(raw_schedules)
            except (json.JSONDecodeError, TypeError):
                raw_schedules = []

        if plan_id is not None:
            if not MembershipPlan.objects.filter(
                id=plan_id, gym=gym, is_base=False
            ).exists():
                return Response(
                    {"plan_id": "El plan seleccionado no es válido."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        serializer = MemberSerializer(
            data=member_data,
            context={"gym": gym},
        )
        serializer.is_valid(raise_exception=True)

        try:
            member = RegistrationService.register(
                gym=gym,
                validated_member_data=serializer.validated_data,
                plan_id=plan_id,
                activity_entries=activity_entries,
                has_gym=has_gym,
                has_activities=has_activities,
                raw_schedules=raw_schedules,
            )
        except RegistrationError as e:
            return Response(e.detail, status=e.status_code)

        return Response(
            PublicMemberSerializer(member).data,
            status=status.HTTP_201_CREATED,
        )

class PublicSlotsView(APIView):
    authentication_classes = []
    permission_classes = []
    throttle_classes = [PublicMemberRateThrottle]

    def get(self, request, gym_code):
        gym = get_object_or_404(
            Gym,
            onboarding_code=gym_code,
        )

        slots = ScheduleSlot.objects.filter(
            gym=gym,
        ).order_by(SCHEDULE_SLOT_WEEKDAY_ORDER, "hour")

        return Response([
            {
                "id": s.id,
                "day": s.day,
                "hour": s.hour.strftime("%H:%M"),
                "capacity": s.capacity,
            }
            for s in slots
        ])


class PublicPlansView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request, gym_code):
        gym = get_object_or_404(
            Gym,
            onboarding_code=gym_code,
        )

        plans = MembershipPlan.objects.filter(
            gym=gym,
            active=True,
            is_base=False,
        ).order_by("price")

        return Response([
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "price": str(p.price),
                "duration_days": p.duration_days,
                "weekly_visits": p.weekly_visits,
            }
            for p in plans
        ])