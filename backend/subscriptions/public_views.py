from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from members.models import Member

from .models import PlanChangeRequest
from .serializers import PublicPlanChangeRequestSerializer


class PublicPlanChangeRequestView(APIView):
    permission_classes = []

    def get(self, request, token):
        member = get_object_or_404(Member, access_token=token)

        requests = PlanChangeRequest.objects.filter(
            member=member,
        ).select_related(
            "requested_plan",
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

        if change_request.status != "pending":
            return Response(
                {
                    "detail": (
                        f"No se puede cancelar una solicitud con estado "
                        f"'{change_request.status}'."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        change_request.status = "cancelled"
        change_request.save(update_fields=["status"])

        return Response(
            PublicPlanChangeRequestSerializer(change_request).data
        )
