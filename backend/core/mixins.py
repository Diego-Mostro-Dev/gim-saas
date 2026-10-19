from decimal import Decimal

from django.core.exceptions import PermissionDenied
from rest_framework import serializers


class BillingPriceMixin:
    """Reglas de precio de las ofertas cobradas por cuota o por paquete (Fase C).

    Dos reglas, una por modalidad:

    * ``sessions``: el paquete de sesiones se cobra con su propio asiento de
      pago, así que la cuota mensual se fuerza a 0. Dejar las dos sobre la
      misma oferta hacía que el socio pagara el paquete **y** la cuota todos
      los meses.
    * ``monthly``: la cuota mensual es el único precio de la oferta y debe ser
      mayor a 0; una oferta cargada a $0 factura $0 y el gimnasio no cobra.

    En modo sesiones se fuerza el precio en vez de rechazar la oferta: el
    precio de una oferta por sesiones no se usa para nada, y rechazarla dejó
    al usuario sin un mensaje claro.
    """

    def apply_billing_price_rules(self, attrs):
        model = self.Meta.model
        billing_mode = attrs.get("billing_mode")
        if billing_mode is None:
            billing_mode = (
                getattr(self.instance, "billing_mode")
                if self.instance
                else model._meta.get_field("billing_mode").default
            )

        if billing_mode == "sessions":
            attrs["monthly_price"] = Decimal("0")
            return attrs

        monthly_price = attrs.get("monthly_price")
        if monthly_price is None and self.instance is not None:
            monthly_price = self.instance.monthly_price
        if monthly_price is None:
            monthly_price = model._meta.get_field("monthly_price").default
        if monthly_price is None or monthly_price <= 0:
            raise serializers.ValidationError(
                {"monthly_price": "El precio mensual debe ser mayor a 0."}
            )
        return attrs


class GymQuerysetMixin:
    """
    Filtra automáticamente todo por el gym del usuario autenticado
    """

    def get_gym(self):
        user = self.request.user

        if not hasattr(user, "profile") or not user.profile.gym:
            raise PermissionDenied("Usuario sin gimnasio asignado")

        return user.profile.gym

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.filter(gym=self.get_gym())

    def perform_create(self, serializer):
        serializer.save(gym=self.get_gym())