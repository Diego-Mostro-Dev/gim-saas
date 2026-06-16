from rest_framework import serializers
from datetime import date, timedelta

from attendance.models import AttendanceSchedule

from .models import Subscription, PlanChangeRequest, PlannedSchedule
from .validators import PlanChangeRequestValidator
from .services import get_member_active_subscription, calculate_effective_date, compute_projected_occupancy


class SubscriptionSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    plan_name = serializers.CharField(
        source="plan.name",
        read_only=True,
    )

    plan_price = serializers.DecimalField(
        source="plan.price",
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )

    class Meta:
        model = Subscription

        fields = "__all__"

        read_only_fields = [
        "gym",
        "end_date",
        "paid",
    ]

    def get_member_name(self, obj):
        return (
            f"{obj.member.first_name} "
            f"{obj.member.last_name}"
        )

    def validate(self, attrs):
        gym = self.context["request"].user.profile.gym

        member = attrs.get(
            "member",
            self.instance.member if self.instance else None,
        )

        plan = attrs.get(
            "plan",
            self.instance.plan if self.instance else None,
        )

        if member and member.gym != gym:
            raise serializers.ValidationError(
                {
                    "member":
                    "El socio no pertenece a este gimnasio."
                }
            )

        if plan and plan.gym != gym:
            raise serializers.ValidationError(
                {
                    "plan":
                    "El plan no pertenece a este gimnasio."
                }
            )

        return attrs

    def create(self, validated_data):
        plan = validated_data["plan"]
        start_date = validated_data["start_date"]

        validated_data["end_date"] = (
            start_date
            + timedelta(days=plan.duration_days)
        )

        return super().create(validated_data)


class PlanChangeRequestSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    plan_name = serializers.CharField(
        source="requested_plan.name",
        read_only=True,
    )
    current_plan_name = serializers.SerializerMethodField()
    reviewed_by_name = serializers.SerializerMethodField()
    planned_schedules = serializers.SerializerMethodField()

    class Meta:
        model = PlanChangeRequest
        fields = [
            "id",
            "gym",
            "member",
            "member_name",
            "requested_plan",
            "plan_name",
            "current_schedules_snapshot",
            "target_schedules_snapshot",
            "status",
            "effective_date",
            "planned_schedules",
            "requested_at",
            "reviewed_at",
            "reviewed_by",
            "reviewed_by_name",
            "admin_notes",
            "current_plan_name",
        ]
        read_only_fields = [
            "gym",
            "status",
            "effective_date",
            "planned_schedules",
            "requested_at",
            "reviewed_at",
            "reviewed_by",
            "current_schedules_snapshot",
        ]

    def get_planned_schedules(self, obj):
        return list(
            obj.planned_schedules.values("slot_name", "day", "hour", "activated")
        )

    def get_member_name(self, obj):
        return f"{obj.member.first_name} {obj.member.last_name}"

    def get_current_plan_name(self, obj):
        if obj.current_plan_name_snapshot:
            return obj.current_plan_name_snapshot

        subscription = get_member_active_subscription(obj.member)

        if not subscription:
            return None

        return subscription.plan.name

    def get_reviewed_by_name(self, obj):
        if obj.reviewed_by:
            return obj.reviewed_by.get_full_name() or obj.reviewed_by.username
        return None

    def validate(self, attrs):
        request = self.context["request"]
        gym = request.user.profile.gym

        member = attrs.get("member")
        if member and member.gym != gym:
            raise serializers.ValidationError({
                "member": "El socio no pertenece a este gimnasio."
            })

        requested_plan = attrs.get("requested_plan")
        if requested_plan and requested_plan.gym != gym:
            raise serializers.ValidationError({
                "requested_plan": "El plan no pertenece a este gimnasio."
            })

        target_schedules = self.initial_data.get("target_schedules_snapshot", [])
        if isinstance(target_schedules, str):
            import json
            try:
                target_schedules = json.loads(target_schedules)
            except Exception:
                target_schedules = []

        if member and requested_plan:
            validator = PlanChangeRequestValidator(
                member=member,
                requested_plan=requested_plan,
                target_schedules=target_schedules,
                gym=gym,
            )
            validator.validate()

        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        gym = request.user.profile.gym

        schedules_qs = AttendanceSchedule.objects.filter(
            member=validated_data["member"],
            active=True,
        ).select_related("slot")

        validated_data["current_schedules_snapshot"] = [
            {
                "day": s.slot.day,
                "hour": s.slot.hour.strftime("%H:%M"),
            }
            for s in schedules_qs
        ]

        subscription = get_member_active_subscription(validated_data["member"])
        if subscription:
            validated_data["current_plan_name_snapshot"] = subscription.plan.name

        validated_data["gym"] = gym
        return super().create(validated_data)


class PlanChangeRequestActionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanChangeRequest
        fields = ["status", "admin_notes"]

    def validate_status(self, value):
        if value not in ("approved", "rejected", "cancelled"):
            raise serializers.ValidationError(
                "El estado debe ser 'approved', 'rejected' o 'cancelled'."
            )
        return value

    def validate(self, attrs):
        instance = self.instance
        new_status = attrs.get("status")

        if new_status == "cancelled":
            if instance.status == "approved" and (
                instance.effective_date and instance.effective_date > date.today()
            ):
                return attrs

        if instance.status != "pending":
            raise serializers.ValidationError(
                f"No se puede modificar una solicitud con estado "
                f"'{instance.status}'."
            )

        if new_status == "approved":
            self._validate_capacity_on_approve(instance)

        return attrs

    def _validate_capacity_on_approve(self, instance):
        from attendance.models import ScheduleSlot

        effective_date = calculate_effective_date(instance.member)
        target_date = effective_date

        for s in instance.target_schedules_snapshot:
            try:
                slot = ScheduleSlot.objects.get(
                    gym=instance.gym,
                    day=s["day"],
                    hour=s["hour"],
                )
            except ScheduleSlot.DoesNotExist:
                continue

            cap = slot.capacity or instance.gym.default_schedule_capacity
            if cap is not None:
                projected = compute_projected_occupancy(
                    slot, target_date, exclude_member=instance.member
                )

                if projected >= cap:
                    from .services import suggest_alternative_slots
                    suggestions = suggest_alternative_slots(instance, (s["day"], s["hour"]))
                    raise serializers.ValidationError(
                        {
                            "error": f"El horario {s['day']} {s['hour']} no tiene "
                                     f"capacidad disponible para la fecha "
                                     f"{target_date}.",
                            "suggestions": suggestions,
                        }
                    )



class PublicPlanChangeRequestSerializer(serializers.ModelSerializer):
    plan_name = serializers.CharField(
        source="requested_plan.name",
        read_only=True,
    )
    current_plan_name = serializers.SerializerMethodField()
    planned_schedules = serializers.SerializerMethodField()

    class Meta:
        model = PlanChangeRequest
        fields = [
            "id",
            "requested_plan",
            "plan_name",
            "current_schedules_snapshot",
            "target_schedules_snapshot",
            "status",
            "effective_date",
            "planned_schedules",
            "requested_at",
            "reviewed_at",
            "admin_notes",
            "current_plan_name",
        ]
        read_only_fields = [
            "gym",
            "member",
            "status",
            "effective_date",
            "planned_schedules",
            "requested_at",
            "reviewed_at",
            "current_schedules_snapshot",
        ]

    def get_planned_schedules(self, obj):
        return list(
            obj.planned_schedules.values("slot_name", "day", "hour", "activated")
        )

    def get_current_plan_name(self, obj):
        if obj.current_plan_name_snapshot:
            return obj.current_plan_name_snapshot

        subscription = get_member_active_subscription(obj.member)

        if not subscription:
            return None

        return subscription.plan.name

    def validate(self, attrs):
        member = self.context["member"]
        gym = member.gym

        requested_plan = attrs.get("requested_plan")
        if requested_plan and requested_plan.gym != gym:
            raise serializers.ValidationError({
                "requested_plan": "El plan no pertenece a este gimnasio."
            })

        target_schedules = self.initial_data.get("target_schedules_snapshot", [])
        if isinstance(target_schedules, str):
            import json
            try:
                target_schedules = json.loads(target_schedules)
            except Exception:
                target_schedules = []

        if requested_plan:
            validator = PlanChangeRequestValidator(
                member=member,
                requested_plan=requested_plan,
                target_schedules=target_schedules,
                gym=gym,
            )
            validator.validate()

        return attrs

    def create(self, validated_data):
        member = self.context["member"]

        schedules_qs = AttendanceSchedule.objects.filter(
            member=member,
            active=True,
        ).select_related("slot")

        validated_data["current_schedules_snapshot"] = [
            {
                "day": s.slot.day,
                "hour": s.slot.hour.strftime("%H:%M"),
            }
            for s in schedules_qs
        ]

        subscription = get_member_active_subscription(member)
        if subscription:
            validated_data["current_plan_name_snapshot"] = subscription.plan.name

        validated_data["gym"] = member.gym
        validated_data["member"] = member
        return super().create(validated_data)