from datetime import date

from django.core.exceptions import PermissionDenied
from django.db.models import Count, Max, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.mixins import GymQuerysetMixin
from core.viewsets import GymModelViewSet
from gyms.features import require_personal_training
from members.models import Member
from profiles.models import UserProfile

from .assignment_service import AssignmentError, AssignmentService
from .availability import available_slots
from .change_request_service import ChangeRequestError, ChangeRequestService
from .models import (
    PersonalTrainingAssignment,
    PersonalTrainingChangeRequest,
    PersonalTrainingService,
)
from .serializers import (
    PersonalTrainingAssignmentSerializer,
    PersonalTrainingChangeRequestSerializer,
    PersonalTrainingServiceSerializer,
    TrainerSerializer,
)
from .session_service import SessionError, SessionService


class PersonalTrainingGuardMixin:
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        require_personal_training(self.get_gym())


class PersonalTrainingServiceViewSet(
    PersonalTrainingGuardMixin, GymModelViewSet
):
    queryset = PersonalTrainingService.objects.all()
    serializer_class = PersonalTrainingServiceSerializer
    ordering = ["name"]

    def get_queryset(self):
        qs = PersonalTrainingService.objects.filter(gym=self.get_gym()).annotate(
            assignment_count=Count(
                "assignments",
                filter=Q(assignments__active=True),
                distinct=True,
            )
        )
        if self.action == "list":
            active = self.request.query_params.get("active")
            if active is not None:
                active = active.lower() in ("true", "1", "yes")
                qs = qs.filter(active=active)
            else:
                qs = qs.filter(active=True)
        return qs

    def perform_create(self, serializer):
        serializer.save(gym=self.get_gym())

    def destroy(self, request, *args, **kwargs):
        service = self.get_object()
        service.active = False
        service.save(update_fields=["active"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def reactivate(self, request, pk=None):
        service = self.get_object()
        service.active = True
        service.save(update_fields=["active"])
        return Response(self.get_serializer(service).data)


class TrainerViewSet(PersonalTrainingGuardMixin, GymQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = UserProfile.objects.none()
    serializer_class = TrainerSerializer

    def get_queryset(self):
        return UserProfile.objects.filter(
            gym=self.get_gym(),
            role=UserProfile.ROLE_TRAINER,
        ).select_related("user").order_by("user__first_name", "user__username")


class PersonalTrainingAssignmentViewSet(
    PersonalTrainingGuardMixin, GymModelViewSet
):
    queryset = PersonalTrainingAssignment.objects.all()
    serializer_class = PersonalTrainingAssignmentSerializer
    ordering = ["day", "start_time"]

    def get_queryset(self):
        qs = PersonalTrainingAssignment.objects.filter(
            gym=self.get_gym()
        ).select_related(
            "member", "member__insurance", "trainer", "service"
        ).annotate(
            used_sessions_count=Count("session_records"),
            last_session_date=Max("session_records__date"),
        )
        if self.action == "list":
            active = self.request.query_params.get("active")
            if active is not None:
                active = active.lower() in ("true", "1", "yes")
                qs = qs.filter(active=active)
            else:
                qs = qs.filter(active=True)
            trainer_id = self.request.query_params.get("trainer_id")
            if trainer_id:
                qs = qs.filter(trainer_id=trainer_id)
            member_id = self.request.query_params.get("member_id")
            if member_id:
                qs = qs.filter(member_id=member_id)
        if self.action in ("retrieve", "update", "partial_update", "destroy"):
            pass
        return qs

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=False, methods=["get"])
    def available_slots(self, request):
        member_id = request.query_params.get("member_id")
        trainer_id = request.query_params.get("trainer_id")
        service_id = request.query_params.get("service_id")
        assignment_id = request.query_params.get("assignment_id")

        if not member_id or not trainer_id or not service_id:
            return Response(
                {
                    "detail": (
                        "Los parámetros member_id, trainer_id y service_id "
                        "son requeridos."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        member = get_object_or_404(Member, id=member_id)
        service = get_object_or_404(
            PersonalTrainingService, id=service_id, gym=self.get_gym()
        )
        trainer_profile = get_object_or_404(
            UserProfile,
            id=trainer_id,
            gym=self.get_gym(),
            role=UserProfile.ROLE_TRAINER,
        )

        exclude = None
        if assignment_id:
            exclude = get_object_or_404(
                PersonalTrainingAssignment, id=assignment_id
            )

        result = available_slots(
            self.get_gym(),
            member,
            trainer_profile.user,
            exclude=exclude,
            duration_minutes=service.duration_minutes,
        )
        result["duration_minutes"] = service.duration_minutes
        return Response(result)

    def destroy(self, request, *args, **kwargs):
        assignment = self.get_object()
        try:
            AssignmentService.unassign_member(assignment.member, assignment)
        except AssignmentError as e:
            return Response(
                {"detail": str(e)},
                status=e.status_code,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def record_session(self, request, pk=None):
        assignment = self.get_object()
        session_date = request.data.get("date")
        if session_date:
            try:
                session_date = date.fromisoformat(session_date)
            except ValueError:
                return Response(
                    {"detail": "Fecha inválida."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            session_date = timezone.localdate()

        try:
            record = SessionService.record_session(assignment, session_date)
        except SessionError as e:
            return Response(
                {"detail": str(e)},
                status=e.status_code,
            )

        return Response(
            {"detail": "Sesión registrada.", "date": record.date.isoformat()},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def remove_session(self, request, pk=None):
        assignment = self.get_object()
        session_date = request.data.get("date")
        if not session_date:
            return Response(
                {"detail": "El campo date es requerido."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            session_date = date.fromisoformat(session_date)
        except ValueError:
            return Response(
                {"detail": "Fecha inválida."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            SessionService.remove_session(assignment, session_date)
        except SessionError as e:
            return Response(
                {"detail": str(e)},
                status=e.status_code,
            )

        return Response({"detail": "Sesión eliminada."})

    @action(detail=True, methods=["post"])
    def renew(self, request, pk=None):
        assignment = self.get_object()
        additional_sessions = request.data.get("additional_sessions")

        try:
            assignment = SessionService.renew_package(
                assignment, additional_sessions
            )
        except SessionError as e:
            return Response(
                {"detail": str(e)},
                status=e.status_code,
            )

        return Response(self.get_serializer(assignment).data)

    @action(detail=True, methods=["post"])
    def record_payment(self, request, pk=None):
        assignment = self.get_object()
        amount = request.data.get("amount")
        payment_method = request.data.get("payment_method", "cash")
        notes = request.data.get("notes", "")
        try:
            assignment = AssignmentService.record_package_payment(
                assignment,
                amount,
                payment_method=payment_method,
                notes=notes,
            )
        except AssignmentError as e:
            return Response(
                {"detail": str(e)},
                status=e.status_code,
            )
        return Response(self.get_serializer(assignment).data)


class PersonalTrainingChangeRequestViewSet(
    PersonalTrainingGuardMixin, GymQuerysetMixin, viewsets.ModelViewSet
):
    queryset = PersonalTrainingChangeRequest.objects.all()
    serializer_class = PersonalTrainingChangeRequestSerializer
    ordering = ["-requested_at"]

    def get_queryset(self):
        qs = PersonalTrainingChangeRequest.objects.filter(
            gym=self.get_gym()
        ).select_related("member", "member__insurance", "assignment", "assignment__service", "assignment__trainer", "reviewed_by")
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def perform_create(self, serializer):
        serializer.save(gym=self.get_gym())

    def destroy(self, request, *args, **kwargs):
        change_request = self.get_object()
        if change_request.status == "pending":
            return Response(
                {"detail": "Cancelá la solicitud antes de eliminarla."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        change_request = self.get_object()
        admin_notes = request.data.get("admin_notes", "")
        try:
            change_request = ChangeRequestService.approve_request(
                change_request,
                reviewer=request.user,
                admin_notes=admin_notes,
            )
        except ChangeRequestError as e:
            return Response(
                {"detail": str(e)},
                status=e.status_code,
            )
        return Response(self.get_serializer(change_request).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        change_request = self.get_object()
        admin_notes = request.data.get("admin_notes", "")
        try:
            change_request = ChangeRequestService.reject_request(
                change_request,
                reviewer=request.user,
                admin_notes=admin_notes,
            )
        except ChangeRequestError as e:
            return Response(
                {"detail": str(e)},
                status=e.status_code,
            )
        return Response(self.get_serializer(change_request).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        change_request = self.get_object()
        try:
            change_request = ChangeRequestService.cancel_request(
                change_request,
                cancelled_by="cancelled_by_staff",
            )
        except ChangeRequestError as e:
            return Response(
                {"detail": str(e)},
                status=e.status_code,
            )
        return Response(self.get_serializer(change_request).data)