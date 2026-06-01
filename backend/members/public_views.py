from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import MemberSerializer


class PublicRegisterView(APIView):

    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = MemberSerializer(
            data=request.data,
            context={"request": request},
        )

        serializer.is_valid(
            raise_exception=True
        )

        member = serializer.save()

        return Response(
            MemberSerializer(member).data,
            status=status.HTTP_201_CREATED,
        )