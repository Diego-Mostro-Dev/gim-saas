from datetime import date

from django.utils import timezone
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response

from members.models import Member
from .models import Attendance, ScheduleSlot, ScheduleChangeRequest, ScheduleSwapRequest
from .serializers import (
    PublicScheduleChangeRequestSerializer,
    PublicScheduleSwapRequestSerializer,
)
from .utils import compute_effective_occupancy
from config.api.throttles import PublicAttendanceRateThrottle
from subscriptions.services import can_member_operate


class PublicCheckinView(APIView):
    permission_classes = []
    throttle_classes = [PublicAttendanceRateThrottle]

    def post(self, request, token):
        member = Member.objects.filter(
            access_token=token,
            active=True,
        ).first()

        if not member:
            return Response(
                {
                    "success": False,
                    "message": "Socio no encontrado",
                },
                status=404,
            )

        if not can_member_operate(member):
            return Response(
                {
                    "success": False,
                    "message": "Acceso suspendido por falta de pago.",
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        today = timezone.localdate()

        approved_swap = ScheduleSwapRequest.objects.filter(
            member=member,
            swap_date=today,
            status="approved",
        ).first()

        if approved_swap:
            already_used = Attendance.objects.filter(
                swap_request=approved_swap,
                date=today,
            ).exists()

            if already_used:
                return Response(
                    {
                        "success": False,
                        "message": "Ya registraste asistencia para este cambio de fecha hoy",
                    }
                )

            slot = approved_swap.destination_slot
            cap = slot.capacity or member.gym.default_schedule_capacity
            if cap is not None:
                effective = compute_effective_occupancy(slot, today)
                if effective >= cap:
                    return Response(
                        {
                            "success": False,
                            "message": "El horario está completo.",
                        },
                        status=400,
                    )

            Attendance.objects.create(
                gym=member.gym,
                member=member,
                schedule=approved_swap.origin_schedule,
                swap_request=approved_swap,
                slot=slot,
            )

            return Response(
                {
                    "success": True,
                    "message": "✓ Asistencia registrada (cambio de fecha)",
                }
            )

        already_registered = (
            Attendance.objects
            .filter(
                member=member,
                date=today,
            )
            .exists()
        )

        if already_registered:
            return Response(
                {
                    "success": False,
                    "message": "Ya registraste asistencia hoy",
                }
            )

        Attendance.objects.create(
            gym=member.gym,
            member=member,
            schedule=None,
        )

        return Response(
            {
                "success": True,
                "message": "✓ Asistencia registrada",
            }
        )


class PublicMemberSlotsView(APIView):
    permission_classes = []
    throttle_classes = [PublicAttendanceRateThrottle]

    def get(self, request, token):
        member = get_object_or_404(Member, access_token=token)
        target_date_str = request.GET.get("date")
        target_date = date.fromisoformat(target_date_str) if target_date_str else None

        slots = ScheduleSlot.objects.filter(
            gym=member.gym,
        ).order_by("day", "hour")

        result = []
        for s in slots:
            entry = {
                "id": s.id,
                "day": s.day,
                "hour": s.hour.strftime("%H:%M"),
                "capacity": s.capacity,
            }
            if target_date:
                occ = compute_effective_occupancy(s, target_date)
                cap = s.capacity or member.gym.default_schedule_capacity
                entry["occupancy"] = occ
                entry["available"] = max(0, cap - occ)
            result.append(entry)

        return Response(result)


class PublicScheduleChangeRequestView(APIView):
    permission_classes = []
    throttle_classes = [PublicAttendanceRateThrottle]

    def get(self, request, token):
        member = get_object_or_404(Member, access_token=token)
        requests = ScheduleChangeRequest.objects.filter(
            member=member,
        ).select_related(
            "current_schedule__slot", "requested_slot"
        ).order_by("-requested_at")

        return Response(
            PublicScheduleChangeRequestSerializer(requests, many=True).data
        )

    def post(self, request, token):
        member = get_object_or_404(Member, access_token=token)

        if not can_member_operate(member):
            return Response(
                {"detail": "Acceso suspendido por falta de pago."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = PublicScheduleChangeRequestSerializer(
            data=request.data,
            context={"member": member},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PublicCancelScheduleChangeRequestView(APIView):
    permission_classes = []
    throttle_classes = [PublicAttendanceRateThrottle]

    def post(self, request, token, pk):
        member = get_object_or_404(Member, access_token=token)

        if not can_member_operate(member):
            return Response(
                {"detail": "Acceso suspendido por falta de pago."},
                status=status.HTTP_403_FORBIDDEN,
            )

        change_request = get_object_or_404(
            ScheduleChangeRequest,
            pk=pk,
            member=member,
        )

        if change_request.status != "pending":
            return Response(
                {"detail": f"No se puede cancelar una solicitud con estado '{change_request.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        change_request.status = "cancelled_by_member"
        change_request.save(update_fields=["status"])

        return Response(
            PublicScheduleChangeRequestSerializer(change_request).data
        )


class PublicScheduleSwapRequestView(APIView):
    permission_classes = []
    throttle_classes = [PublicAttendanceRateThrottle]

    def get(self, request, token):
        member = get_object_or_404(Member, access_token=token)
        swaps = ScheduleSwapRequest.objects.filter(
            member=member,
        ).select_related(
            "origin_schedule__slot", "destination_slot"
        ).order_by("-requested_at")

        return Response(
            PublicScheduleSwapRequestSerializer(swaps, many=True).data
        )

    def post(self, request, token):
        member = get_object_or_404(Member, access_token=token)

        if not can_member_operate(member):
            return Response(
                {"detail": "Acceso suspendido por falta de pago."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = PublicScheduleSwapRequestSerializer(
            data=request.data,
            context={"member": member},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PublicCancelScheduleSwapRequestView(APIView):
    permission_classes = []
    throttle_classes = [PublicAttendanceRateThrottle]

    def post(self, request, token, pk):
        member = get_object_or_404(Member, access_token=token)

        if not can_member_operate(member):
            return Response(
                {"detail": "Acceso suspendido por falta de pago."},
                status=status.HTTP_403_FORBIDDEN,
            )

        swap_request = get_object_or_404(
            ScheduleSwapRequest,
            pk=pk,
            member=member,
        )

        if swap_request.status != "pending":
            return Response(
                {"detail": f"No se puede cancelar una solicitud con estado '{swap_request.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        swap_request.status = "cancelled"
        swap_request.save(update_fields=["status"])

        return Response(
            PublicScheduleSwapRequestSerializer(swap_request).data
        )