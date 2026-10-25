from django.contrib import admin

from .models import Member
from .reactivation import validate_reactivation_capacity


@admin.register(Member)
class MemberAdmin(admin.ModelAdmin):
    list_display = ("first_name", "last_name", "gym", "active", "deleted_at")
    list_filter = ("gym", "active")
    search_fields = ("first_name", "last_name", "phone")
    readonly_fields = ("deleted_at",)
    actions = ("deactivate_members", "reactivate_members")

    def get_queryset(self, request):
        qs = Member.all_objects.all()

        if request.user.is_superuser:
            return qs

        return qs.filter(gym=request.user.profile.gym)

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.action(description="Dar de baja a los socios seleccionados")
    def deactivate_members(self, request, queryset):
        count = 0
        for member in queryset.filter(deleted_at__isnull=True):
            member.soft_delete()
            count += 1
        self.message_user(request, f"{count} socio(s) dados de baja.")

    @admin.action(description="Reactivar los socios seleccionados")
    def reactivate_members(self, request, queryset):
        count = 0
        skipped = 0
        for member in queryset.filter(deleted_at__isnull=False):
            phone_taken = (
                bool(member.phone)
                and Member.objects.filter(
                    gym=member.gym,
                    phone=member.phone,
                ).exclude(pk=member.pk).exists()
            )
            if phone_taken or validate_reactivation_capacity(member):
                skipped += 1
                continue
            member.reactivate()
            count += 1
        message = f"{count} socio(s) reactivados."
        if skipped:
            message += (
                f" {skipped} omitido(s) por teléfono duplicado o "
                "capacidad completa."
            )
        self.message_user(request, message)
