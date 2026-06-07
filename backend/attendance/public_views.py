from django.utils import timezone

from rest_framework.views import APIView
from rest_framework.response import Response

from members.models import Member
from .models import Attendance


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