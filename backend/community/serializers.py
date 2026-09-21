from rest_framework import serializers

from .models import CommunityBusiness


class CommunityBusinessSerializer(serializers.ModelSerializer):
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