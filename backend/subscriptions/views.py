from django.db import transaction
from django.utils.timezone import now

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from core.viewsets import GymModelViewSet

from attendance.models import AttendanceSchedule, ScheduleChangeRequest, ScheduleSlot, ScheduleSwapRequest

from .models import Subscription, PlanChangeRequest, PlannedSchedule
from .serializers import (
    SubscriptionSerializer,
    PlanChangeRequestSerializer,
    PlanChangeRequestActionSerializer,
)
from .services import calculate_effective_date, cancel_future_plan_change, get_first_day_of_next_month, get_last_day_of_month


class SubscriptionViewSet(GymModelViewSet):
    queryset = Subscription.objects.all()
    serializer_class = SubscriptionSerializer

    def get_queryset(self):
        return super().get_queryset().select_related("member", "plan")

    @action(
        detail=True,
        methods=["post"],
    )
    def renew(self, request, pk=None):
        subscription = self.get_object()

        start_date = get_first_day_of_next_month(now().date())
        end_date = get_last_day_of_month(start_date)

        new_subscription = Subscription.objects.create(
            gym=subscription.gym,
            member=subscription.member,
            plan=subscription.plan,
            start_date=start_date,
            end_date=end_date,
            paid=False,
        )

        serializer = self.get_serializer(
            new_subscription
        )

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
        )


class PlanChangeRequestViewSet(GymModelViewSet):
    queryset = PlanChangeRequest.objects.all()
    serializer_class = PlanChangeRequestSerializer
    pagination_class = None

    def get_serializer_class(self):
        if self.action in ("approve", "reject", "cancel"):
            return PlanChangeRequestActionSerializer
        return PlanChangeRequestSerializer

    def get_queryset(self):
        return super().get_queryset().select_related(
            "member", "requested_plan", "reviewed_by",
        )

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return self._handle_action(request, pk, "approved")

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        return self._handle_action(request, pk, "rejected")

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        return self._handle_action(request, pk, "cancelled")

    def _handle_action(self, request, pk, new_status):
        instance = self.get_object()

        allowed = instance.status == "pending"
        if new_status == "cancelled" and instance.status == "approved" and (
            instance.effective_date and instance.effective_date > now().date()
        ):
            allowed = True

        if not allowed:
            return Response(
                {
                    "detail": (
                        f"No se puede modificar una solicitud con estado "
                        f"'{instance.status}'."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = PlanChangeRequestActionSerializer(
            instance,
            data={**request.data, "status": new_status},
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        now_value = now()

        with transaction.atomic():
            if new_status == "approved":
                effective_date = calculate_effective_date(instance.member)
                instance.effective_date = effective_date

                if effective_date > now().date():
                    instance.status = "approved"
                    instance.reviewed_by = request.user
                    instance.reviewed_at = now_value
                    instance.save(update_fields=["status", "effective_date", "reviewed_by", "reviewed_at"])
                    self._reserve_schedules(instance)
                else:
                    instance.status = "executed"
                    instance.reviewed_by = request.user
                    instance.reviewed_at = now_value
                    instance.save(update_fields=["status", "effective_date", "reviewed_by", "reviewed_at"])

                    effective = instance.effective_date
                    month_start = effective
                    month_end = get_last_day_of_month(effective)
                    Subscription.objects.create(
                        gym=instance.gym,
                        member=instance.member,
                        plan=instance.requested_plan,
                        start_date=month_start,
                        end_date=month_end,
                        paid=False,
                    )

                    self._synchronize_schedules(instance)
            elif new_status == "cancelled" and instance.status == "approved":
                cancel_future_plan_change(instance)
                instance.refresh_from_db()
            else:
                serializer.save(
                    reviewed_by=request.user,
                    reviewed_at=now_value,
                )

            self._cancel_pending_schedule_requests(instance.member, instance.gym)

        return Response(PlanChangeRequestSerializer(instance).data)

    def _reserve_schedules(self, instance):
        for s in instance.target_schedules_snapshot:
            try:
                slot = ScheduleSlot.objects.get(
                    gym=instance.gym,
                    day=s["day"],
                    hour=s["hour"],
                )
            except ScheduleSlot.DoesNotExist:
                continue

            PlannedSchedule.objects.get_or_create(
                plan_change=instance,
                slot=slot,
                defaults={
                    "gym": instance.gym,
                    "member": instance.member,
                    "slot_name": str(slot),
                    "day": s["day"],
                    "hour": s["hour"],
                },
            )

    def _synchronize_schedules(self, instance):
        real_current = AttendanceSchedule.objects.filter(
            member=instance.member, active=True
        ).select_related("slot")

        current_keys = {(s.slot.day, s.slot.hour.strftime("%H:%M")) for s in real_current}

        target_snapshots = instance.target_schedules_snapshot or []
        target_keys = {(s["day"], s["hour"]) for s in target_snapshots}

        to_deactivate = current_keys - target_keys
        to_activate = target_keys - current_keys

        for day, hour in to_deactivate:
            try:
                slot = ScheduleSlot.objects.get(gym=instance.gym, day=day, hour=hour)
            except ScheduleSlot.DoesNotExist:
                continue
            AttendanceSchedule.objects.filter(
                member=instance.member, slot=slot
            ).update(active=False)

        for day, hour in to_activate:
            try:
                slot = ScheduleSlot.objects.get(gym=instance.gym, day=day, hour=hour)
            except ScheduleSlot.DoesNotExist:
                continue

            existing = AttendanceSchedule.objects.filter(
                member=instance.member, slot=slot
            ).first()

            if existing:
                existing.active = True
                existing.save(update_fields=["active"])
            else:
                AttendanceSchedule.objects.create(
                    member=instance.member,
                    gym=instance.gym,
                    slot=slot,
                    active=True,
                )

    def _cancel_pending_schedule_requests(self, member, gym):
        ScheduleChangeRequest.objects.filter(
            member=member, gym=gym, status="pending"
        ).update(status="cancelled", reviewed_at=now(), admin_notes="Cancelled due to plan change approval")

        ScheduleSwapRequest.objects.filter(
            member=member, gym=gym, status="pending"
        ).update(status="cancelled", reviewed_at=now(), admin_notes="Cancelled due to plan change approval")