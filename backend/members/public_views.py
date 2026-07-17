import json
from calendar import monthrange
from datetime import date, time
from decimal import Decimal

from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from activities.models import Activity, ActivitySchedule, Enrollment
from activities.overlap import validate_gym_activity_overlap, validate_schedule_batch
from gyms.models import Gym
from attendance.models import ScheduleSlot
from attendance.utils import SCHEDULE_SLOT_WEEKDAY_ORDER
from plans.models import MembershipPlan
from plans.services import ensure_base_plan_for_gym
from subscriptions.models import Subscription, SubscriptionItem
from subscriptions.services import get_last_day_of_month

from .serializers import MemberSerializer
from config.api.throttles import PublicMemberRateThrottle


VALID_SERVICES = frozenset({"gym", "activities"})


class PublicRegisterView(APIView):

    authentication_classes = []
    permission_classes = []
    throttle_classes = [PublicMemberRateThrottle]

    def post(self, request, gym_code):

        gym = get_object_or_404(
            Gym,
            onboarding_code=gym_code,
        )

        services = request.data.get("services")

        if services is not None:
            return self._onboarding_register(request, gym, services)

        # ── Legacy flow (100% unchanged) ──────────────────────────────────

        serializer = MemberSerializer(
            data=request.data,
            context={
                "gym": gym,
            },
        )

        serializer.is_valid(
            raise_exception=True
        )

        member = serializer.save(
            gym=gym
        )

        plan_id = request.data.get("plan_id")
        if plan_id:
            try:
                plan = MembershipPlan.objects.get(
                    id=plan_id,
                    gym=gym,
                )
            except (MembershipPlan.DoesNotExist, ValueError):
                return Response(
                    {"plan_id": "El plan seleccionado no es válido."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            today = date.today()
            end_date = get_last_day_of_month(today)

            total_days = monthrange(today.year, today.month)[1]
            remaining_days = (end_date - today).days + 1
            prorated_amount = (
                Decimal(str(remaining_days)) / Decimal(str(total_days))
            ) * plan.price

            data = MemberSerializer(member).data
            data["prorated_amount"] = str(prorated_amount.quantize(Decimal("0.01")))
            data["plan_price"] = str(plan.price)

            return Response(data, status=status.HTTP_201_CREATED)

        return Response(
            MemberSerializer(member).data,
            status=status.HTTP_201_CREATED,
        )

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
                activity_entries = self._validate_activity_schedules(gym, raw)
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
        member_data["entry_mode"] = entry_mode

        with transaction.atomic():
            serializer = MemberSerializer(
                data=member_data,
                context={"gym": gym},
            )
            serializer.is_valid(raise_exception=True)
            member = serializer.save(gym=gym)

            if activity_entries:
                Enrollment.objects.bulk_create([
                    Enrollment(
                        gym=gym,
                        member=member,
                        schedule=entry["schedule"],
                        active=True,
                    )
                    for entry in activity_entries
                ])

            if has_activities and not has_gym:
                if gym.allow_activity_without_membership:
                    base_plan = ensure_base_plan_for_gym(gym)
                    today = date.today()
                    sub = Subscription.objects.create(
                        gym=gym,
                        member=member,
                        plan=base_plan,
                        start_date=today,
                        end_date=get_last_day_of_month(today),
                        auto_renew=True,
                        paid=False,
                    )
                    for entry in activity_entries:
                        activity = Activity.objects.get(id=entry["activity_id"])
                        SubscriptionItem.objects.create(
                            subscription=sub,
                            item_type="activity",
                            activity=activity,
                            name_snapshot=activity.name,
                            price_snapshot=activity.monthly_price,
                            start_date=today,
                            end_date=get_last_day_of_month(today),
                            status="active",
                        )

        return Response(
            MemberSerializer(member).data,
            status=status.HTTP_201_CREATED,
        )

    @staticmethod
    def _validate_activity_schedules(gym, raw_schedules):
        seen = set()
        result = []

        for item in raw_schedules:
            if not isinstance(item, dict):
                raise ValueError(
                    "Cada elemento debe ser un objeto con "
                    "activity_id y schedule_id."
                )

            activity_id = item.get("activity_id")
            schedule_id = item.get("schedule_id")

            if not activity_id or not schedule_id:
                raise ValueError(
                    "Cada selección debe incluir "
                    "activity_id y schedule_id."
                )

            if not Activity.objects.filter(
                id=activity_id, service__gym=gym, active=True
            ).exists():
                raise ValueError(
                    f"La actividad {activity_id} no existe "
                    f"o no está activa."
                )

            schedule = ActivitySchedule.objects.filter(
                id=schedule_id, activity__id=activity_id
            ).first()

            if not schedule:
                raise ValueError(
                    f"El horario {schedule_id} no pertenece "
                    f"a la actividad {activity_id}."
                )

            if schedule_id in seen:
                raise ValueError(
                    f"El horario {schedule_id} está duplicado."
                )
            seen.add(schedule_id)

            enrolled_count = Enrollment.objects.filter(
                schedule=schedule, active=True
            ).count()
            if enrolled_count >= schedule.capacity:
                raise ValueError(
                    f"El horario {schedule_id} está completo."
                )

            result.append(
                {"activity_id": activity_id, "schedule": schedule}
            )

        selected_schedules = [entry["schedule"] for entry in result]
        validate_schedule_batch(selected_schedules)

        return result


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