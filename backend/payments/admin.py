from django.contrib import admin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "member_name",
        "plan_name",
        "gym",
        "amount",
        "payment_method",
        "concept",
        "paid_at",
    )

    list_filter = (
        "payment_method",
        "concept",
        "gym",
    )

    search_fields = (
        "member_name",
        "plan_name",
        "member__first_name",
        "member__last_name",
    )

    readonly_fields = ("paid_at",)

    # Payments drive the denormalized mirrors (subscription.paid,
    # enrollment/assignment amount_paid, sellado_paid). Writing them from the
    # admin would bypass PaymentSerializer's validation and reconciliation, so
    # the admin is view-only and payments are managed through the app.
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def get_queryset(self, request):
        qs = super().get_queryset(request)

        if request.user.is_superuser:
            return qs

        return qs.filter(gym=request.user.profile.gym)
