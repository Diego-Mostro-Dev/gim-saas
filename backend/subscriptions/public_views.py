from datetime import date

from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from members.models import Member

from .models import PlanChangeRequest
from .serializers import PublicPlanChangeRequestSerializer
from .services import cancel_future_plan_change


class PublicPlanChangeRequestView(APIView):
    permission_classes = []

    def get(self, request, token):
        member = get_object_or_404(Member, access_token=token)

        requests = PlanChangeRequest.objects.filter(
            member=member,
        ).select_related(
            "requested_plan",
        ).prefetch_related(
            "planned_schedules",
        ).order_by("-requested_at")

        return Response(
            PublicPlanChangeRequestSerializer(requests, many=True).data
        )

    def post(self, request, token):
        member = get_object_or_404(Member, access_token=token)

        serializer = PublicPlanChangeRequestSerializer(
            data=request.data,
            context={"member": member},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
        )


class PublicCancelPlanChangeRequestView(APIView):
    permission_classes = []

    def post(self, request, token, pk):
        member = get_object_or_404(Member, access_token=token)

        change_request = get_object_or_404(
            PlanChangeRequest,
            pk=pk,
            member=member,
        )

        allowed = change_request.status == "pending"
        if change_request.status == "approved" and (
            change_request.effective_date and change_request.effective_date > date.today()
        ):
            allowed = True

        if not allowed:
            return Response(
                {
                    "detail": (
                        f"No se puede cancelar una solicitud con estado "
                        f"'{change_request.status}'."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if change_request.status == "approved":
            cancel_future_plan_change(change_request)
        else:
            change_request.status = "cancelled"
            change_request.save(update_fields=["status"])

        change_request.refresh_from_db()
        return Response(
            PublicPlanChangeRequestSerializer(change_request).data
        )
