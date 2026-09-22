from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response

from gyms.features import require_outings
from members.models import Member
from subscriptions.domain import SubscriptionDomain
from config.api.throttles import PublicMemberRateThrottle

from .enrollment_request_service import (
    OutingEnrollmentRequestError,
    OutingEnrollmentRequestService,
)
from .models import Outing, OutingEnrollment, OutingEnrollmentRequest, OutingSchedule
from .serializers import (
    PublicOutingEnrollmentRequestSerializer,
    PublicOutingEnrollmentSerializer,
)


class PublicMemberOutingsView(APIView):
    """Portal del socio: salidas activas, solicitudes y grupos disponibles."""

    permission_classes = []
    throttle_classes = [PublicMemberRateThrottle]

    def get(self, request, token):
        member = get_object_or_404(Member, access_token=token)
        gym = SubscriptionDomain.resolve_gym(member)
        require_outings(gym)

        enrollments = OutingEnrollment.objects.filter(
            member=member,
            active=True,
        ).select_related(
            "schedule__outing",
            "schedule__outing__trainer__profile",
        ).order_by("schedule__day", "schedule__start_time")

        requests = OutingEnrollmentRequest.objects.filter(
            member=member,
        ).select_related(
            "schedule__outing__trainer",
        ).order_by("-requested_at")

        return Response({
            "outings": PublicOutingEnrollmentSerializer(
                enrollments, many=True
            ).data,
            "requests": PublicOutingEnrollmentRequestSerializer(
                requests, many=True
            ).data,
            "available_outings": _available_outings(gym, member),
            "gym_name": gym.name,
        })


class PublicOutingEnrollmentRequestView(APIView):
    """Crear o cancelar solicitudes de inscripción/baja desde el portal."""

    permission_classes = []
    throttle_classes = [PublicMemberRateThrottle]

    def post(self, request, token):
        member = get_object_or_404(Member, access_token=token)
        gym = SubscriptionDomain.resolve_gym(member)
        require_outings(gym)

        request_type = request.data.get("request_type")

        if request_type == "enroll":
            schedule_id = request.data.get("schedule_id")
            if not schedule_id:
                return Response(
                    {"detail": "El campo schedule_id es requerido."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            schedule = get_object_or_404(
                OutingSchedule,
                id=schedule_id,
                outing__service__gym=gym,
                active=True,
                outing__active=True,
            )
            try:
                enrollment_request = (
                    OutingEnrollmentRequestService.create_enroll_request(
                        member, schedule
                    )
                )
            except OutingEnrollmentRequestError as e:
                return Response(
                    {"detail": str(e)},
                    status=e.status_code,
                )
        elif request_type == "unenroll":
            enrollment_id = request.data.get("enrollment_id")
            if not enrollment_id:
                return Response(
                    {"detail": "El campo enrollment_id es requerido."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            enrollment = get_object_or_404(
                OutingEnrollment,
                id=enrollment_id,
                member=member,
                gym=gym,
            )
            try:
                enrollment_request = (
                    OutingEnrollmentRequestService.create_unenroll_request(
                        member, enrollment
                    )
                )
            except OutingEnrollmentRequestError as e:
                return Response(
                    {"detail": str(e)},
                    status=e.status_code,
                )
        else:
            return Response(
                {"detail": "El campo request_type debe ser enroll o unenroll."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = PublicOutingEnrollmentRequestSerializer(enrollment_request)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def delete(self, request, token, request_id):
        member = get_object_or_404(Member, access_token=token)
        gym = SubscriptionDomain.resolve_gym(member)
        require_outings(gym)

        enrollment_request = get_object_or_404(
            OutingEnrollmentRequest,
            id=request_id,
            member=member,
        )
        try:
            OutingEnrollmentRequestService.cancel_request(
                enrollment_request,
                cancelled_by="cancelled_by_member",
            )
        except OutingEnrollmentRequestError as e:
            return Response(
                {"detail": str(e)},
                status=e.status_code,
            )
        return Response(
            {"detail": "Solicitud cancelada."},
            status=status.HTTP_200_OK,
        )


def _available_outings(gym, member):
    """Salidas mensuales con horarios libres en los que el socio puede
    solicitar inscribirse (excluye horarios ya ocupados o con solicitud
    pendiente)."""
    enrolled_schedule_ids = set(
        OutingEnrollment.objects.filter(
            gym=gym, member=member, active=True
        ).values_list("schedule_id", flat=True)
    )
    requested_schedule_ids = set(
        OutingEnrollmentRequest.objects.filter(
            gym=gym, member=member, request_type="enroll", status="pending"
        ).values_list("schedule_id", flat=True)
    )

    outings = (
        Outing.objects.filter(
            service__gym=gym,
            active=True,
        )
        .exclude(billing_mode="sessions")
        .prefetch_related("schedules")
        .order_by("name")
    )

    result = []
    for outing in outings:
        schedules = []
        for schedule in outing.schedules.filter(active=True):
            if schedule.id in enrolled_schedule_ids:
                continue
            if schedule.id in requested_schedule_ids:
                continue
            enrolled_count = OutingEnrollment.objects.filter(
                schedule=schedule, active=True
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

        if not schedules:
            continue

        result.append({
            "id": outing.id,
            "name": outing.name,
            "description": outing.description,
            "trainer_name": (
                outing.trainer.get_full_name() or outing.trainer.username
                if outing.trainer_id
                else None
            ),
            "meeting_place": outing.meeting_place,
            "duration_minutes": outing.duration_minutes,
            "schedules": schedules,
        })

    return result