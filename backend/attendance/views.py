from datetime import date, datetime, time, timedelta

from django.db.models.deletion import ProtectedError
from django.db.models import Count, Q, Prefetch
from django.utils import timezone

from rest_framework import generics, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action, api_view
from rest_framework import status

from .models import AttendanceSchedule, Attendance, ScheduleSlot, ScheduleChangeRequest, ScheduleSwapRequest, SessionRecovery, DAY_CHOICES
from gyms.models import GymClosedDate
from gyms.features import activities_enabled
from activities.models import ActivitySchedule, Enrollment
from .utils import (
    SCHEDULE_SLOT_WEEKDAY_ORDER,
    compute_effective_occupancy,
    compute_effective_occupancies,
    get_swap_usage_metrics,
    member_service_label,
)
from .recovery_service import (
    RecoveryError,
    eligible_options,
    grant_scheduled,
    undo_recovery,
)
from members.models import Member
from subscriptions.domain import ScheduleDomain, SubscriptionDomain
from .serializers import (
    AttendanceScheduleSerializer,
    AttendanceSerializer,
    ScheduleSlotSerializer,
    ScheduleChangeRequestSerializer,
    ScheduleChangeRequestActionSerializer,
    ScheduleSwapRequestSerializer,
    ScheduleSwapRequestActionSerializer,
    SessionRecoverySerializer,
)


def _build_class_items(gym, day):
    """Members enrolled in active activity schedules for the given day, as
    attendance-list items grouped by class (time range)."""
    if not activities_enabled(gym):
        return []

    items = []
    schedules = ActivitySchedule.objects.filter(
        activity__service__gym=gym,
        day=day,
        active=True,
        activity__active=True,
    ).select_related("activity").prefetch_related(
        Prefetch(
            "enrollments",
            queryset=Enrollment.objects.filter(
                gym=gym, active=True
            ).select_related("member"),
        )
    )

    for schedule in schedules:
        enrolled = list(schedule.enrollments.all())
        cap = schedule.capacity
        occ = len(enrolled)
        available = max(0, cap - occ) if cap is not None else None

        for enrollment in enrolled:
            member = enrollment.member
            items.append({
                "id": -enrollment.id,
                "is_class": True,
                "class_name": schedule.activity.name,
                "group_key": f"class:{schedule.id}",
                "day": day,
                "hour": None,
                "start_time": schedule.start_time.strftime("%H:%M"),
                "end_time": schedule.end_time.strftime("%H:%M"),
                "member": member.id,
                "member_name": f"{member.first_name} {member.last_name}",
                "capacity": cap,
                "occupancy": occ,
                "available": available,
                "service_name": member_service_label(member),
            })

    return items


def _build_class_items_for_status(gym, day, selected_time):
    """Enrolled members of classes that cover the selected time on `day`,
    as read-only checklist items (`is_class: True`)."""
    if not activities_enabled(gym) or selected_time is None:
        return []

    items = []
    schedules = ActivitySchedule.objects.filter(
        activity__service__gym=gym,
        day=day,
        active=True,
        activity__active=True,
        start_time__lte=selected_time,
        end_time__gt=selected_time,
    ).select_related("activity").prefetch_related(
        Prefetch(
            "enrollments",
            queryset=Enrollment.objects.filter(
                gym=gym, active=True
            ).select_related("member"),
        )
    )

    for schedule in schedules:
        for enrollment in schedule.enrollments.all():
            member = enrollment.member
            items.append({
                "schedule_id": -(10**9 + schedule.id),
                "member_id": member.id,
                "member_name": f"{member.first_name} {member.last_name}",
                "service_name": member_service_label(member),
                "attended": False,
                "is_swap": False,
                "is_class": True,
                "class_name": schedule.activity.name,
                "start_time": schedule.start_time.strftime("%H:%M"),
                "end_time": schedule.end_time.strftime("%H:%M"),
                "origin_day": None,
                "origin_hour": None,
                "destination_day": None,
                "destination_hour": None,
            })

    return items


class WeeklyScheduleView(APIView):
    def get(self, request):
        gym = request.user.profile.gym

        days = [
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
        ]

        target_date_str = request.GET.get("date")
        target_date = None
        approved_swaps = None
        if target_date_str:
            target_date = date.fromisoformat(target_date_str)
            approved_swaps = list(
                ScheduleSwapRequest.objects.filter(
                    gym=gym,
                    swap_date=target_date,
                    status="approved",
                ).select_related(
                    "origin_schedule__slot", "destination_slot", "member"
                ).prefetch_related("member__subscription_set")
            )

        result = {}

        occ_cache = self._build_occupancy_cache(gym, target_date, approved_swaps)

        open_days_set = set(
            ScheduleSlot.objects.filter(gym=gym)
            .values_list("day", flat=True)
        )

        for day in days:
            schedules = AttendanceSchedule.objects.filter(
                gym=gym,
                slot__day=day,
                active=True,
            ).select_related(
                "member",
                "slot",
                "gym",
                "subscription__plan__service",
            ).prefetch_related("member__subscription_set")

            data = AttendanceScheduleSerializer(schedules, many=True).data

            if approved_swaps:
                swap_out_ids = {
                    swap.origin_schedule_id
                    for swap in approved_swaps
                    if swap.origin_schedule.slot.day == day
                }
                data = [item for item in data if item["id"] not in swap_out_ids]

                existing = {}
                for item in data:
                    mid = item["member"]
                    sid = item["slot_id"]
                    existing.setdefault(mid, set()).add(sid)

                for swap in approved_swaps:
                    if swap.destination_slot.day != day:
                        continue
                    mid = swap.member.id
                    sid = swap.destination_slot.id
                    if sid not in existing.get(mid, set()):
                        cap = (
                            swap.destination_slot.capacity
                            or gym.default_schedule_capacity
                        )
                        data.append({
                            "id": -swap.id,
                            "member": mid,
                            "member_name": (
                                f"{swap.member.first_name} "
                                f"{swap.member.last_name}"
                            ),
                            "day": swap.destination_slot.day,
                            "hour": swap.destination_slot.hour.strftime(
                                "%H:%M:%S"
                            ),
                            "slot_id": sid,
                            "capacity": cap,
                            "service_name": member_service_label(swap.member),
                            "start_time": swap.destination_slot.hour.strftime(
                                "%H:%M"
                            ),
                            "group_key": f"slot:{sid}",
                        })
                        existing.setdefault(mid, set()).add(sid)

            if occ_cache:
                for item in data:
                    occ = occ_cache.get(item["slot_id"])
                    if occ:
                        item.update(occ)

            data.extend(_build_class_items(gym, day))

            result[day] = data

        result["open_days"] = [
            day for day in days if day in open_days_set
        ]

        closed_dates = []
        if target_date:
            week_monday = target_date - timedelta(days=target_date.weekday())
            week_sunday = week_monday + timedelta(days=6)
            closed_dates = list(
                GymClosedDate.objects.filter(
                    gym=gym,
                    date__gte=week_monday,
                    date__lte=week_sunday,
                ).values_list("date", flat=True)
            )

        result["closed_dates"] = [
            closed_date.isoformat() for closed_date in closed_dates
        ]

        return Response(result)

    def _build_occupancy_cache(self, gym, target_date, approved_swaps):
        if not target_date:
            return {}

        slot_ids = set(
            AttendanceSchedule.objects.filter(gym=gym, active=True)
            .values_list("slot_id", flat=True)
        )
        if approved_swaps:
            slot_ids.update(swap.destination_slot_id for swap in approved_swaps)

        if not slot_ids:
            return {}

        slots = list(ScheduleSlot.objects.filter(id__in=slot_ids))
        eff_map = compute_effective_occupancies(slots, target_date)

        occ_cache = {}
        for slot in slots:
            eff = eff_map.get(slot.id, 0)
            cap = slot.capacity or gym.default_schedule_capacity
            occ_cache[slot.id] = {
                "occupancy": eff,
                "capacity": cap,
                "available": max(0, cap - eff),
            }
        return occ_cache


@api_view(["GET"])
def members_by_schedule(request):
    gym = request.user.profile.gym

    day = request.GET.get("day")
    hour = request.GET.get("hour")

    schedules = AttendanceSchedule.objects.filter(
        gym=gym,
        slot__day=day,
        slot__hour=hour,
        active=True,
    ).select_related("member", "slot")

    result = [
        {
            "schedule_id": s.id,
            "member_id": s.member.id,
            "member_name": f"{s.member.first_name} {s.member.last_name}",
        }
        for s in schedules
    ]

    target_date_str = request.GET.get("date")
    if target_date_str:
        target_date = date.fromisoformat(target_date_str)

        swap_out_ids = set(
            ScheduleSwapRequest.objects.filter(
                gym=gym,
                origin_schedule__slot__day=day,
                origin_schedule__slot__hour=hour,
                swap_date=target_date,
                status="approved",
            ).values_list("origin_schedule_id", flat=True)
        )
        result = [r for r in result if r["schedule_id"] not in swap_out_ids]

        existing_member_ids = {r["member_id"] for r in result}
        swaps_in = ScheduleSwapRequest.objects.filter(
            gym=gym,
            destination_slot__day=day,
            destination_slot__hour=hour,
            swap_date=target_date,
            status="approved",
        ).select_related("member")

        for swap in swaps_in:
            if swap.member_id not in existing_member_ids:
                result.append({
                    "schedule_id": -swap.id,
                    "member_id": swap.member.id,
                    "member_name": (
                        f"{swap.member.first_name} "
                        f"{swap.member.last_name}"
                    ),
                })
                existing_member_ids.add(swap.member_id)

        slot = ScheduleSlot.objects.filter(
            gym=gym, day=day, hour=hour
        ).first()
        if slot:
            occ = compute_effective_occupancy(slot, target_date)
            cap = slot.capacity or gym.default_schedule_capacity
            occ_info = {
                "occupancy": occ,
                "capacity": cap,
                "available": max(0, cap - occ),
            }
            for entry in result:
                entry.update(occ_info)

    return Response(result)


@api_view(["GET"])
def attendance_status(request):
    gym = request.user.profile.gym

    day = request.GET.get("day")
    hour = request.GET.get("hour")

    schedules = list(AttendanceSchedule.objects.filter(
        gym=gym,
        slot__day=day,
        slot__hour=hour,
        active=True,
    ).select_related(
        "member",
        "slot",
        "subscription__plan__service",
    ).prefetch_related("member__subscription_set"))

    today = timezone.localdate()

    target_date_str = request.GET.get("date")
    target_date = date.fromisoformat(target_date_str) if target_date_str else today

    schedule_ids = [s.id for s in schedules]

    attended_schedule_ids = set(
        Attendance.objects.filter(
            gym=gym,
            date=target_date,
            schedule_id__in=schedule_ids,
            swap_request__isnull=True,
        ).values_list("schedule_id", flat=True)
    )

    result = []
    for schedule in schedules:
        result.append({
            "schedule_id": schedule.id,
            "member_id": schedule.member.id,
            "member_name": f"{schedule.member.first_name} {schedule.member.last_name}",
            "service_name": member_service_label(schedule.member, schedule=schedule),
            "attended": schedule.id in attended_schedule_ids,
            "is_swap": False,
        })

    swap_out_ids = set(
        ScheduleSwapRequest.objects.filter(
            gym=gym,
            origin_schedule__slot__day=day,
            origin_schedule__slot__hour=hour,
            swap_date=target_date,
            status="approved",
        ).values_list("origin_schedule_id", flat=True)
    )
    result = [r for r in result if r["schedule_id"] not in swap_out_ids]

    existing_member_ids = {r["member_id"] for r in result}
    swaps_in = list(ScheduleSwapRequest.objects.filter(
        gym=gym,
        destination_slot__day=day,
        destination_slot__hour=hour,
        swap_date=target_date,
        status="approved",
    ).select_related(
        "member", "origin_schedule__slot", "destination_slot"
    ).prefetch_related("member__subscription_set"))

    swap_ids = [s.id for s in swaps_in]
    used_swap_ids = set()
    if swap_ids:
        used_swap_ids = set(
            Attendance.objects.filter(
                date=target_date,
                swap_request_id__in=swap_ids,
            ).values_list("swap_request_id", flat=True)
        )

    for swap in swaps_in:
        if swap.member_id not in existing_member_ids:
            result.append({
                "schedule_id": -swap.id,
                "member_id": swap.member.id,
                "member_name": (
                    f"{swap.member.first_name} "
                    f"{swap.member.last_name}"
                ),
                "service_name": member_service_label(swap.member),
                "attended": swap.id in used_swap_ids,
                "is_swap": True,
                "origin_day": swap.origin_schedule.slot.day,
                "origin_hour": swap.origin_schedule.slot.hour.strftime("%H:%M"),
                "destination_day": swap.destination_slot.day,
                "destination_hour": swap.destination_slot.hour.strftime("%H:%M"),
            })
            existing_member_ids.add(swap.member_id)

    # Include members who checked in today via the public QR but without a
    # resolved recurring schedule (schedule=None). Show them under a synthetic
    # "no schedule" row so their attendance is still visible. Only list them
    # when viewing the current day's schedule, since these records carry no
    # day/hour of their own.
    DAY_BY_WEEKDAY = {
        0: "monday",
        1: "tuesday",
        2: "wednesday",
        3: "thursday",
        4: "friday",
        5: "saturday",
        6: "sunday",
    }
    if day == DAY_BY_WEEKDAY.get(today.weekday()):
        orphaned_attendances = Attendance.objects.filter(
            gym=gym,
            member__gym=gym,
            date=today,
            schedule__isnull=True,
            swap_request__isnull=True,
        ).select_related("member").prefetch_related("member__subscription_set")

        for att in orphaned_attendances:
            if att.member_id in existing_member_ids:
                continue
            result.append({
                "schedule_id": -att.id,
                "member_id": att.member.id,
                "member_name": (
                    f"{att.member.first_name} "
                    f"{att.member.last_name}"
                ),
                "service_name": member_service_label(att.member),
                "attended": True,
                "is_swap": False,
                "origin_day": None,
                "origin_hour": None,
                "destination_day": None,
                "destination_hour": None,
            })

    try:
        selected_time = time.fromisoformat(hour)
    except (TypeError, ValueError):
        selected_time = None

    for item in _build_class_items_for_status(gym, day, selected_time):
        if item["member_id"] in existing_member_ids:
            continue
        existing_member_ids.add(item["member_id"])
        result.append(item)

    return Response(result)


class AttendanceCreateView(generics.CreateAPIView):
    serializer_class = AttendanceSerializer

    def get_queryset(self):
        return Attendance.objects.filter(
            gym=self.request.user.profile.gym,
        )


class ScheduleSlotListCreateView(generics.ListCreateAPIView):
    serializer_class = ScheduleSlotSerializer

    def get_queryset(self):
        return ScheduleSlot.objects.filter(
            gym=self.request.user.profile.gym,
        ).order_by(SCHEDULE_SLOT_WEEKDAY_ORDER, "hour")

    def perform_create(self, serializer):
        serializer.save(gym=self.request.user.profile.gym)


class ScheduleSlotDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ScheduleSlotSerializer

    def get_queryset(self):
        return ScheduleSlot.objects.filter(
            gym=self.request.user.profile.gym,
        )

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "No se puede eliminar el horario porque tiene socios asignados."},
                status=status.HTTP_400_BAD_REQUEST,
            )


MAX_BULK_SLOTS = 336
BULK_STEP_CHOICES = (30, 60)


def _generate_slot_times(start_time, end_time, step_minutes):
    """Times from start to end inclusive, stepped by step_minutes."""
    current = datetime.combine(date(2000, 1, 1), start_time)
    end = datetime.combine(date(2000, 1, 1), end_time)
    times = []
    while current <= end:
        times.append(current.time())
        current = current + timedelta(minutes=step_minutes)
    return times


class ScheduleSlotBulkCreateView(APIView):
    """Create many ScheduleSlots at once: day(s) × a time range with a step."""

    def post(self, request, *args, **kwargs):
        gym = request.user.profile.gym
        data = request.data

        days = data.get("days") or []
        if not isinstance(days, list) or not days:
            return Response(
                {"detail": "Debés seleccionar al menos un día."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        valid_days = {d[0] for d in DAY_CHOICES}
        unknown = [d for d in days if d not in valid_days]
        if unknown:
            return Response(
                {"detail": f"Día(s) inválido(s): {', '.join(map(str, unknown))}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        days = list(dict.fromkeys(days))

        try:
            step_minutes = int(data.get("step_minutes", 60))
        except (TypeError, ValueError):
            step_minutes = None
        if step_minutes not in BULK_STEP_CHOICES:
            return Response(
                {"detail": "El intervalo debe ser 30 o 60 minutos."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            start_time = time.fromisoformat(data.get("start_time"))
            end_time = time.fromisoformat(data.get("end_time"))
        except (TypeError, ValueError):
            return Response(
                {"detail": "Formato de hora inválido. Usá HH:MM."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if start_time >= end_time:
            return Response(
                {"detail": "La hora de inicio debe ser anterior a la de fin."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        times = _generate_slot_times(start_time, end_time, step_minutes)
        if len(times) * len(days) > MAX_BULK_SLOTS:
            return Response(
                {"detail": "El lote supera el máximo de horarios permitidos por envío."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        capacity = data.get("capacity")
        if capacity in (None, ""):
            capacity = None
        else:
            try:
                capacity = int(capacity)
            except (TypeError, ValueError):
                return Response(
                    {"detail": "La capacidad debe ser un número."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if capacity < 1:
                return Response(
                    {"detail": "La capacidad debe ser mayor o igual a 1."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        existing = set(
            ScheduleSlot.objects.filter(
                gym=gym,
                day__in=days,
                hour__in=times,
            ).values_list("day", "hour")
        )
        existing = {(day, hour.strftime("%H:%M")) for day, hour in existing}

        to_create = []
        skipped = []
        for day in days:
            for slot_time in times:
                key = (day, slot_time.strftime("%H:%M"))
                if key in existing:
                    skipped.append({"day": day, "hour": slot_time.strftime("%H:%M")})
                else:
                    to_create.append(ScheduleSlot(gym=gym, day=day, hour=slot_time, capacity=capacity))

        created = ScheduleSlot.objects.bulk_create(to_create)

        serializer = ScheduleSlotSerializer(
            created, many=True, context={"request": request}
        )
        return Response(
            {
                "created": serializer.data,
                "skipped": skipped,
                "total_requested": len(times) * len(days),
            },
            status=status.HTTP_201_CREATED,
        )


class ScheduleChangeRequestViewSet(viewsets.ModelViewSet):
    serializer_class = ScheduleChangeRequestSerializer
    pagination_class = None

    def get_serializer_class(self):
        if self.action in ("approve", "reject", "cancel"):
            return ScheduleChangeRequestActionSerializer
        return ScheduleChangeRequestSerializer

    def get_queryset(self):
        return ScheduleChangeRequest.objects.filter(
            gym=self.request.user.profile.gym,
        ).select_related(
            "member", "current_schedule__slot", "requested_slot", "reviewed_by"
        )

    def perform_create(self, serializer):
        gym = self.request.user.profile.gym
        serializer.save(gym=gym)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return self._handle_action(request, pk, "executed")

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        return self._handle_action(request, pk, "rejected")

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        return self._handle_action(request, pk, "cancelled_by_staff")

    def _handle_action(self, request, pk, new_status):
        instance = self.get_object()

        if instance.status != "pending":
            return Response(
                {"detail": f"No se puede modificar una solicitud con estado '{instance.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ScheduleChangeRequestActionSerializer(
            instance,
            data={**request.data, "status": new_status},
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        if new_status == "executed":
            current_schedule = instance.current_schedule
            requested_slot = instance.requested_slot

            current_schedule.active = False
            current_schedule.save(update_fields=["active"])

            subscription = SubscriptionDomain.get_current_subscription(instance.member)
            ScheduleDomain.activate_schedule(
                instance.member, instance.gym, requested_slot,
                subscription=subscription,
            )

        serializer.save(
            reviewed_by=request.user,
            reviewed_at=timezone.now(),
        )

        return Response(ScheduleChangeRequestSerializer(instance).data)


@api_view(["GET"])
def attendance_analytics(request):
    gym = request.user.profile.gym
    today = timezone.localdate()
    start_date_str = request.GET.get("start_date")
    end_date_str = request.GET.get("end_date")

    end_date = date.fromisoformat(end_date_str) if end_date_str else today
    start_date = date.fromisoformat(start_date_str) if start_date_str else end_date - timedelta(days=29)

    qs = Attendance.objects.filter(gym=gym, date__gte=start_date, date__lte=end_date)

    summary = qs.aggregate(
        total_attendances=Count("id"),
        regular_attendances=Count("id", filter=Q(slot__isnull=False, swap_request__isnull=True)),
        swap_attendances=Count("id", filter=Q(swap_request__isnull=False)),
        walkin_attendances=Count("id", filter=Q(slot__isnull=True)),
    )

    occupancy_values = []
    highest_occupancy_slot = None
    highest_pct = 0
    default_cap = gym.default_schedule_capacity

    slots = {s.id: s for s in ScheduleSlot.objects.filter(gym=gym)}

    slot_date_qs = (
        qs.filter(slot__isnull=False)
        .values("slot_id", "date")
        .annotate(count=Count("id"))
    )

    for entry in slot_date_qs:
        slot_id = entry["slot_id"]
        d = entry["date"]
        count = entry["count"]
        slot = slots.get(slot_id)
        if not slot:
            continue
        cap = slot.capacity or default_cap
        if not cap:
            continue
        pct = round((count / cap) * 100, 1)
        occupancy_values.append(pct)
        if pct > highest_pct:
            highest_pct = pct
            highest_occupancy_slot = {"day": slot.day, "hour": slot.hour.strftime("%H:%M")}

    avg_occupancy = round(sum(occupancy_values) / len(occupancy_values), 1) if occupancy_values else 0

    top_slots = (
        ScheduleSlot.objects.filter(gym=gym)
        .annotate(
            num_attendances=Count("attendances", filter=Q(
                attendances__date__gte=start_date,
                attendances__date__lte=end_date,
            ))
        )
        .filter(num_attendances__gt=0)
        .order_by("-num_attendances")[:5]
    )

    top_members = (
        Member.objects.filter(gym=gym)
        .annotate(
            num_attendances=Count("attendances", filter=Q(
                attendances__date__gte=start_date,
                attendances__date__lte=end_date,
            ))
        )
        .filter(num_attendances__gt=0)
        .order_by("-num_attendances")[:10]
    )

    return Response({
        "summary": summary,
        "occupancy": {
            "average_occupancy_percent": avg_occupancy,
            "highest_occupancy_slot": highest_occupancy_slot,
        },
        "swaps": get_swap_usage_metrics(gym, start_date, end_date),
        "top_slots": [
            {
                "day": s.day,
                "hour": s.hour.strftime("%H:%M"),
                "attendances": s.num_attendances,
            }
            for s in top_slots
        ],
        "top_members": [
            {
                "member_id": m.id,
                "member_name": f"{m.first_name} {m.last_name}",
                "attendances": m.num_attendances,
            }
            for m in top_members
        ],
    })


class ScheduleSwapRequestViewSet(viewsets.ModelViewSet):
    serializer_class = ScheduleSwapRequestSerializer
    pagination_class = None

    def get_serializer_class(self):
        if self.action in ("approve", "reject"):
            return ScheduleSwapRequestActionSerializer
        return ScheduleSwapRequestSerializer

    def get_queryset(self):
        return ScheduleSwapRequest.objects.filter(
            gym=self.request.user.profile.gym,
        ).select_related(
            "member", "origin_schedule__slot", "destination_slot", "reviewed_by"
        )

    def perform_create(self, serializer):
        gym = self.request.user.profile.gym
        serializer.save(gym=gym)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return self._handle_action(request, pk, "approved")

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        return self._handle_action(request, pk, "rejected")

    def _handle_action(self, request, pk, new_status):
        instance = self.get_object()

        if instance.status != "pending":
            return Response(
                {"detail": f"No se puede modificar una solicitud con estado '{instance.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ScheduleSwapRequestActionSerializer(
            instance,
            data={**request.data, "status": new_status},
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        serializer.save(
            reviewed_by=request.user,
            reviewed_at=timezone.now(),
        )

        return Response(ScheduleSwapRequestSerializer(instance).data)


def _get_recovery(request, recovery_pk):
    gym = request.user.profile.gym
    return SessionRecovery.objects.filter(
        gym=gym,
        pk=recovery_pk,
    ).select_related("member", "activity", "granted_by").first()


class SessionRecoveryListCreateView(APIView):
    """Listar y otorgar recuperaciones de clases del gimnasio (staff)."""

    def get(self, request):
        gym = request.user.profile.gym
        qs = SessionRecovery.objects.filter(
            gym=gym,
        ).select_related("member", "activity", "granted_by")

        member_id = request.GET.get("member")
        if member_id:
            qs = qs.filter(member_id=member_id)

        status_query = request.GET.get("status")
        if status_query:
            if status_query == "expired":
                qs = qs.filter(
                    Q(status="available", expires_at__lt=timezone.localdate())
                    | Q(status="scheduled", used_date__lt=timezone.localdate())
                )
            else:
                qs = qs.filter(status=status_query)

        serializer = SessionRecoverySerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        gym = request.user.profile.gym
        member_id = request.data.get("member")
        kind = request.data.get("kind", "training")
        activity_id = request.data.get("activity")
        note = request.data.get("note", "")
        date_str = request.data.get("date")
        slot_id = request.data.get("slot_id")
        schedule_id = request.data.get("schedule_id")

        if not member_id:
            return Response(
                {"detail": "Debés seleccionar el socio."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        member = Member.objects.filter(
            gym=gym,
            pk=member_id,
        ).first()
        if member is None:
            return Response(
                {"detail": "Socio no encontrado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not date_str:
            return Response(
                {"detail": "Debés indicar la fecha en que se recupera la clase."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            target_date = date.fromisoformat(date_str)
        except ValueError:
            return Response(
                {"detail": "Formato de fecha inválido. Usá AAAA-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        activity = None
        if kind == "activity":
            if not activities_enabled(gym):
                return Response(
                    {"detail": "El gimnasio no tiene actividades habilitadas."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            from activities.models import Activity
            activity = Activity.objects.filter(pk=activity_id).first()
            if activity is None:
                return Response(
                    {"detail": "Actividad no encontrada."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        slot = None
        schedule = None
        if kind == "training":
            if not slot_id:
                return Response(
                    {"detail": "Debés elegir el horario de entrenamiento."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            slot = ScheduleSlot.objects.filter(
                gym=gym,
                pk=slot_id,
            ).first()
            if slot is None:
                return Response(
                    {"detail": "Horario de entrenamiento no encontrado."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            if not schedule_id:
                return Response(
                    {"detail": "Debés elegir la clase que se recupera."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            schedule = ActivitySchedule.objects.filter(
                activity_id=activity_id,
                pk=schedule_id,
            ).first()
            if schedule is None:
                return Response(
                    {"detail": "Clase no encontrada."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            recovery = grant_scheduled(
                gym,
                member,
                granted_by=request.user,
                kind=kind,
                activity=activity,
                note=note,
                target_date=target_date,
                slot=slot,
                schedule=schedule,
            )
        except RecoveryError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            SessionRecoverySerializer(recovery).data,
            status=status.HTTP_201_CREATED,
        )


class SessionRecoveryOptionsView(APIView):
    """Opciones de día/horario disponibles para otorgar una recuperación."""

    def get(self, request):
        gym = request.user.profile.gym
        member_id = request.GET.get("member")
        kind = request.GET.get("kind", "training")
        activity_id = request.GET.get("activity")
        date_str = request.GET.get("date")

        if not member_id:
            return Response(
                {"detail": "Debés indicar el socio."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not date_str:
            return Response(
                {"detail": "Debés indicar la fecha."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        member = Member.objects.filter(
            gym=gym,
            pk=member_id,
        ).first()
        if member is None:
            return Response(
                {"detail": "Socio no encontrado."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target_date = date.fromisoformat(date_str)
        except ValueError:
            return Response(
                {"detail": "Formato de fecha inválido. Usá AAAA-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        activity = None
        if kind == "activity":
            from activities.models import Activity
            activity = Activity.objects.filter(pk=activity_id).first()
            if activity is None:
                return Response(
                    {"detail": "Actividad no encontrada."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            options = eligible_options(gym, member, kind, activity, target_date)
        except RecoveryError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(options)


class SessionRecoveryUndoView(APIView):
    """Deshace una recuperación ya usada (borra la asistencia creada)."""

    def post(self, request, recovery_pk):
        recovery = _get_recovery(request, recovery_pk)
        if recovery is None:
            return Response(
                {"detail": "Recuperación no encontrada."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            recovery = undo_recovery(recovery)
        except RecoveryError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(SessionRecoverySerializer(recovery).data)