from datetime import date

from rest_framework import serializers

from attendance.models import ScheduleSlot, AttendanceSchedule

from .services import get_member_active_subscription


class PlanChangeRequestValidator:
    def __init__(self, member, requested_plan, target_schedules, gym=None):
        self.member = member
        self.requested_plan = requested_plan
        self.target_schedules = target_schedules
        self.gym = gym or member.gym

    def validate(self):
        self._validate_active_subscription()
        self._validate_same_gym()
        self._validate_different_plan()
        self._validate_no_duplicate_pending()
        self._validate_no_future_approved()
        self._validate_schedule_capacity()
        self._validate_schedule_count()

    def _validate_active_subscription(self):
        sub = get_member_active_subscription(self.member)
        if sub is None:
            raise serializers.ValidationError(
                "El socio no tiene una suscripción activa."
            )

    def _validate_same_gym(self):
        if self.requested_plan.gym != self.gym:
            raise serializers.ValidationError({
                "requested_plan": "El plan no pertenece a este gimnasio."
            })

    def _validate_different_plan(self):
        sub = get_member_active_subscription(self.member)
        if sub and sub.plan == self.requested_plan:
            raise serializers.ValidationError(
                "El plan solicitado es el mismo que el actual."
            )

    def _validate_no_duplicate_pending(self):
        from .models import PlanChangeRequest

        if PlanChangeRequest.objects.filter(
            member=self.member,
            status="pending",
        ).exists():
            raise serializers.ValidationError(
                "Ya tienes una solicitud de cambio de plan pendiente."
            )

    def _validate_no_future_approved(self):
        from .models import PlanChangeRequest

        if PlanChangeRequest.objects.filter(
            member=self.member,
            status="approved",
            effective_date__gt=date.today(),
        ).exists():
            raise serializers.ValidationError(
                "Ya tienes un cambio de plan aprobado programado "
                "para el próximo ciclo."
            )

    def _validate_schedule_capacity(self):
        for s in self.target_schedules:
            try:
                slot = ScheduleSlot.objects.get(
                    gym=self.gym,
                    day=s["day"],
                    hour=s["hour"],
                )
            except ScheduleSlot.DoesNotExist:
                raise serializers.ValidationError(
                    f"El horario {s['day']} {s['hour']} no existe."
                )

            cap = slot.capacity or self.gym.default_schedule_capacity
            if cap is not None:
                current_count = AttendanceSchedule.objects.filter(
                    gym=self.gym,
                    slot=slot,
                    active=True,
                ).exclude(member=self.member).count()

                if current_count >= cap:
                    raise serializers.ValidationError(
                        f"El horario {s['day']} {s['hour']} está completo."
                    )

    def _validate_schedule_count(self):
        if self.requested_plan.weekly_visits is not None:
            count = len(self.target_schedules)

            if count != self.requested_plan.weekly_visits:
                raise serializers.ValidationError(
                    f"El plan permite un máximo de "
                    f"{self.requested_plan.weekly_visits} "
                    f"horarios semanales."
                )
