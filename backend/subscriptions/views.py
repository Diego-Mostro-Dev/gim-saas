from datetime import timedelta

from django.db import transaction
from django.utils.timezone import now

from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response

from core.viewsets import GymModelViewSet

from attendance.models import AttendanceSchedule, ScheduleChangeRequest, ScheduleSlot, ScheduleSwapRequest

from .models import Subscription, PlanChangeRequest
from .serializers import (
    SubscriptionSerializer,
    PlanChangeRequestSerializer,
    PlanChangeRequestActionSerializer,
)
from .services import get_member_active_subscription


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

        today = now().date()

        if subscription.end_date < today:
            start_date = today
        else:
            start_date = (
                subscription.end_date +
                timedelta(days=1)
            )

        end_date = (
            start_date +
            timedelta(
                days=subscription.plan.duration_days
            )
        )

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

        if instance.status != "pending":
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
            serializer.save(
                reviewed_by=request.user,
                reviewed_at=now_value,
            )

            if new_status == "approved":
                subscription = get_member_active_subscription(instance.member)
                if subscription:
                    subscription.plan = instance.requested_plan
                    subscription.save(update_fields=["plan"])

                self._synchronize_schedules(instance)
                self._cancel_pending_schedule_requests(instance.member, instance.gym)

        return Response(PlanChangeRequestSerializer(instance).data)

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