from django.contrib import admin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "member_name",
        "gym",
        "amount",
        "payment_method",
        "paid_at",
    )

    list_filter = (
        "payment_method",
        "gym",
    )

    search_fields = (
        "member_name",
        "plan_name",
        "member__first_name",
        "member__last_name",
    )

    readonly_fields = ("paid_at",)

    def get_queryset(self, request):
        qs = super().get_queryset(request)

        if request.user.is_superuser:
            return qs

        return qs.filter(gym=request.user.profile.gym)
