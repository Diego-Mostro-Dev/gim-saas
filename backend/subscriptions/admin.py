from django.contrib import admin
from .models import Subscription


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = (
        "member",
        "plan",
        "start_date",
        "end_date",
        "paid",
    )

    list_filter = (
        "paid",
        "plan",
    )

    search_fields = (
        "member__first_name",
        "member__last_name",
    )

    readonly_fields = ("end_date",)