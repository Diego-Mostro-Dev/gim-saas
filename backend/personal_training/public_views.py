from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response

from gyms.features import require_personal_training
from members.models import Member
from members.eligibility import MemberEligibility
from subscriptions.domain import SubscriptionDomain
from config.api.throttles import MemberPortalTokenThrottle, PublicMemberRateThrottle

from .availability import available_slots
from .change_request_service import ChangeRequestError, ChangeRequestService
from .models import (
    PersonalTrainingAssignment,
    PersonalTrainingChangeRequest,
)
from .serializers import (
    PublicAssignmentSerializer,
    PublicChangeRequestSerializer,
)


class PublicMemberPersonalTrainingView(APIView):
    """Portal del socio: sus asignaciones activas y solicitudes pendientes."""

    permission_classes = []
    throttle_classes = [PublicMemberRateThrottle, MemberPortalTokenThrottle]

    def get(self, request, token):
        member = get_object_or_404(Member, access_token=token)
        gym = SubscriptionDomain.resolve_gym(member)
        require_personal_training(gym)

        assignments = PersonalTrainingAssignment.objects.filter(
            member=member,
            active=True,
        ).select_related("trainer__profile", "service").order_by("day", "start_time")

        pending = PersonalTrainingChangeRequest.objects.filter(
            member=member,
            status="pending",
        ).select_related("assignment").order_by("-requested_at")

        return Response({
            "personal_training": PublicAssignmentSerializer(
                assignments, many=True
            ).data,
            "change_requests": PublicChangeRequestSerializer(
                pending, many=True
            ).data,
            "gym_name": gym.name,
        })


class PublicMemberAvailableSlotsView(APIView):
    """Franjas libres para cambiar el horario de una asignación de PT."""

    permission_classes = []
    throttle_classes = [PublicMemberRateThrottle, MemberPortalTokenThrottle]

    def get(self, request, token):
        member = get_object_or_404(Member, access_token=token)
        gym = SubscriptionDomain.resolve_gym(member)
        require_personal_training(gym)

        if not MemberEligibility.can_operate(member):
            return Response(
                {"detail": "Acceso suspendido por falta de pago."},
                status=status.HTTP_403_FORBIDDEN,
            )

        assignment_id = request.query_params.get("assignment_id")
        if not assignment_id:
            return Response(
                {"detail": "El parámetro assignment_id es requerido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        assignment = get_object_or_404(
            PersonalTrainingAssignment,
            id=assignment_id,
            member=member,
            active=True,
        )

        result = available_slots(
            gym,
            member,
            assignment.trainer,
            exclude=assignment,
            duration_minutes=assignment.service.duration_minutes,
        )
        result["assignment_id"] = assignment.id
        result["duration_minutes"] = assignment.service.duration_minutes
        return Response(result)


class PublicMemberChangeRequestView(APIView):
    """Crear o cancelar solicitudes de cambio desde el portal del socio."""

    permission_classes = []
    throttle_classes = [PublicMemberRateThrottle, MemberPortalTokenThrottle]

    def post(self, request, token):
        member = get_object_or_404(Member, access_token=token)
        gym = SubscriptionDomain.resolve_gym(member)
        require_personal_training(gym)

        if not MemberEligibility.can_operate(member):
            return Response(
                {"detail": "Acceso suspendido por falta de pago."},
                status=status.HTTP_403_FORBIDDEN,
            )

        assignment_id = request.data.get("assignment_id")
        if not assignment_id:
            return Response(
                {"detail": "El campo assignment_id es requerido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        assignment = get_object_or_404(
            PersonalTrainingAssignment,
            id=assignment_id,
            member=member,
            active=True,
        )

        requested_day = request.data.get("requested_day")
        requested_start = request.data.get("requested_start_time")
        requested_end = request.data.get("requested_end_time")

        if not all([requested_day, requested_start, requested_end]):
            return Response(
                {"detail": "Día, hora de inicio y hora de fin son requeridos."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            change_request = ChangeRequestService.create_request(
                assignment,
                requested_day,
                requested_start,
                requested_end,
            )
        except ChangeRequestError as e:
            return Response(
                {"detail": str(e)},
                status=e.status_code,
            )

        serializer = PublicChangeRequestSerializer(change_request)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def delete(self, request, token, request_id):
        member = get_object_or_404(Member, access_token=token)
        gym = SubscriptionDomain.resolve_gym(member)
        require_personal_training(gym)

        change_request = get_object_or_404(
            PersonalTrainingChangeRequest,
            id=request_id,
            member=member,
        )
        if change_request.status != "pending":
            return Response(
                {"detail": "La solicitud ya fue revisada."},
                status=status.HTTP_409_CONFLICT,
            )
        change_request.status = "cancelled_by_member"
        change_request.save(update_fields=["status"])
        return Response(
            {"detail": "Solicitud cancelada."},
            status=status.HTTP_200_OK,
        )