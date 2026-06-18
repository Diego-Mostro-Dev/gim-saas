from datetime import date, timedelta

from django.db.models.deletion import ProtectedError
from django.utils import timezone

from rest_framework import generics, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action, api_view
from rest_framework import status

from .models import AttendanceSchedule, Attendance, ScheduleSlot, ScheduleChangeRequest, ScheduleSwapRequest
from .utils import SCHEDULE_SLOT_WEEKDAY_ORDER
from members.models import Member
from .serializers import (
    AttendanceScheduleSerializer,
    AttendanceSerializer,
    ScheduleSlotSerializer,
    ScheduleChangeRequestSerializer,
    ScheduleChangeRequestActionSerializer,
    ScheduleSwapRequestSerializer,
    ScheduleSwapRequestActionSerializer,
)
from django.db.models import Count, Q
from .utils import compute_effective_occupancy, get_swap_usage_metrics


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
                ).select_related("origin_schedule__slot", "destination_slot", "member")
            )

        result = {}

        occ_cache = self._build_occupancy_cache(gym, target_date, approved_swaps)

        for day in days:
            schedules = AttendanceSchedule.objects.filter(
                gym=gym,
                slot__day=day,
                active=True,
            ).select_related("member", "slot", "gym")

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
                        })
                        existing.setdefault(mid, set()).add(sid)

            if occ_cache:
                for item in data:
                    occ = occ_cache.get(item["slot_id"])
                    if occ:
                        item.update(occ)

            result[day] = data

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

        slots = {s.id: s for s in ScheduleSlot.objects.filter(id__in=slot_ids)}

        base_counts = dict(
            AttendanceSchedule.objects.filter(slot_id__in=slot_ids, active=True)
            .values("slot_id")
            .annotate(count=Count("id"))
            .values_list("slot_id", "count")
        )

        swaps_in = dict(
            ScheduleSwapRequest.objects.filter(
                destination_slot_id__in=slot_ids,
                swap_date=target_date,
                status="approved",
            )
            .values("destination_slot_id")
            .annotate(count=Count("id"))
            .values_list("destination_slot_id", "count")
        )

        swaps_out = dict(
            ScheduleSwapRequest.objects.filter(
                origin_schedule__slot_id__in=slot_ids,
                swap_date=target_date,
                status="approved",
            )
            .values("origin_schedule__slot_id")
            .annotate(count=Count("id"))
            .values_list("origin_schedule__slot_id", "count")
        )

        occ_cache = {}
        for sid in slot_ids:
            if sid not in slots:
                continue
            slot = slots[sid]
            base = base_counts.get(sid, 0)
            s_in = swaps_in.get(sid, 0)
            s_out = swaps_out.get(sid, 0)
            occ = max(0, base + s_in - s_out)
            cap = slot.capacity or gym.default_schedule_capacity
            occ_cache[sid] = {
                "occupancy": occ,
                "capacity": cap,
                "available": max(0, cap - occ),
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
    ).select_related("member", "slot"))

    today = date.today()

    target_date_str = request.GET.get("date")
    target_date = date.fromisoformat(target_date_str) if target_date_str else today

    schedule_ids = [s.id for s in schedules]

    attended_schedule_ids = set(
        Attendance.objects.filter(
            gym=gym,
            date=today,
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
    ).select_related("member", "origin_schedule__slot", "destination_slot"))

    swap_ids = [s.id for s in swaps_in]
    used_swap_ids = set()
    if swap_ids:
        used_swap_ids = set(
            Attendance.objects.filter(
                date=today,
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
                "attended": swap.id in used_swap_ids,
                "is_swap": True,
                "origin_day": swap.origin_schedule.slot.day,
                "origin_hour": swap.origin_schedule.slot.hour.strftime("%H:%M"),
                "destination_day": swap.destination_slot.day,
                "destination_hour": swap.destination_slot.hour.strftime("%H:%M"),
            })
            existing_member_ids.add(swap.member_id)

    return Response(result)


class AttendanceCreateView(generics.CreateAPIView):
    queryset = Attendance.objects.all()
    serializer_class = AttendanceSerializer


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

            existing = AttendanceSchedule.objects.filter(
                member=instance.member,
                slot=requested_slot,
            ).first()

            if existing:
                existing.active = True
                existing.save(update_fields=["active"])
            else:
                AttendanceSchedule.objects.create(
                    member=instance.member,
                    gym=instance.gym,
                    slot=requested_slot,
                    active=True,
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