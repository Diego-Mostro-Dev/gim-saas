from django.utils import timezone
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response

from members.models import Member
from .models import Attendance, ScheduleSlot, ScheduleChangeRequest
from .serializers import PublicScheduleChangeRequestSerializer


class PublicCheckinView(APIView):
    permission_classes = []

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

        today = timezone.localdate()

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

    def get(self, request, token):
        member = get_object_or_404(Member, access_token=token)
        slots = ScheduleSlot.objects.filter(
            gym=member.gym,
        ).order_by("day", "hour")

        return Response([
            {
                "id": s.id,
                "day": s.day,
                "hour": s.hour.strftime("%H:%M"),
                "capacity": s.capacity,
            }
            for s in slots
        ])


class PublicScheduleChangeRequestView(APIView):
    permission_classes = []

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

        serializer = PublicScheduleChangeRequestSerializer(
            data=request.data,
            context={"member": member},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data, status=status.HTTP_201_CREATED)


class PublicCancelScheduleChangeRequestView(APIView):
    permission_classes = []

    def post(self, request, token, pk):
        member = get_object_or_404(Member, access_token=token)
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

        change_request.status = "cancelled"
        change_request.save(update_fields=["status"])

        return Response(
            PublicScheduleChangeRequestSerializer(change_request).data
        )