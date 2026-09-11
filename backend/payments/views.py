import csv

from datetime import datetime

from django.db import transaction
from django.http import HttpResponse

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from core.viewsets import GymModelViewSet

from subscriptions.models import Subscription
from subscriptions.services import sync_subscription_paid

from .models import Payment
from .serializers import PaymentSerializer


CONCEPT_LABELS = {
    "subscription": "Suscripción",
    "sellado": "Sellado",
    "coseguro": "Coseguro por sesiones",
}

METHOD_LABELS = {
    "cash": "Efectivo",
    "transfer": "Transferencia",
    "card": "Tarjeta",
}


class PaymentViewSet(GymModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    ordering = ['-created_at']

    @action(detail=False, methods=["get"])
    def export(self, request):
        gym = request.user.profile.gym
        month = request.query_params.get("month")

        try:
            month_date = datetime.strptime(month or "", "%Y-%m")
        except ValueError:
            return Response(
                {"detail": 'El parámetro "month" es requerido con formato YYYY-MM (ej. 2026-09).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payments = (
            self.get_queryset()
            .filter(
                paid_at__year=month_date.year,
                paid_at__month=month_date.month,
            )
            .order_by("paid_at")
        )

        response = HttpResponse(content_type="text/csv; charset=utf-8")
        # BOM UTF-8: Excel abre el CSV con acentos correctos.
        response.write("\ufeff")

        month_str = month_date.strftime("%Y-%m")
        gym_name = "".join(
            c if c.isalnum() or c in "-_" else "-"
            for c in gym.name.strip()
        ).strip("-").lower() or "gym"

        response[
            "Content-Disposition"
        ] = f'attachment; filename="pagos-{month_str}-{gym_name}.csv"'

        writer = csv.writer(
            response,
            delimiter=";",
            quotechar='"',
        )

        writer.writerow([
            "fecha",
            "socio",
            "concepto",
            "detalle",
            "monto",
            "metodo",
            "notas",
        ])

        for payment in payments:
            writer.writerow([
                payment.paid_at.strftime("%d/%m/%Y %H:%M"),
                payment.member_name,
                CONCEPT_LABELS.get(
                    payment.concept,
                    payment.concept,
                ),
                payment.plan_name,
                str(payment.amount).replace(".", ","),
                METHOD_LABELS.get(
                    payment.payment_method,
                    payment.payment_method,
                ),
                payment.notes,
            ])

        return response

    def perform_destroy(self, instance):
        subscription = instance.subscription

        with transaction.atomic():
            instance.delete()

            if not subscription:
                return

            sub = (
                Subscription.objects
                .select_for_update()
                .get(pk=subscription.pk)
            )
            sync_subscription_paid(sub)
