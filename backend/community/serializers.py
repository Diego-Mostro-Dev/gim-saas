from rest_framework import serializers

from .models import CommunityBusiness


class CommunityBusinessSerializer(serializers.ModelSerializer):
    discount = serializers.CharField(
        max_length=120,
        error_messages={
            "required": "El beneficio es obligatorio.",
            "blank": "El beneficio no puede estar vacío.",
            "max_length": "El beneficio no puede superar los 120 caracteres.",
        },
    )

    class Meta:
        model = CommunityBusiness
        fields = [
            "id",
            "name",
            "category",
            "address",
            "contact",
            "discount",
            "description",
        ]