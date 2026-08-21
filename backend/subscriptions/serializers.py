from rest_framework import serializers
from datetime import date
from decimal import Decimal

from attendance.models import AttendanceSchedule

from plans.services import public_plan_name, public_plan_name_from_snapshot

from .models import Subscription, SubscriptionItem, PlanChangeRequest
from .validators import PlanChangeRequestValidator
from .domain import SubscriptionDomain
from .services import (
    calculate_subscription_total,
    calculate_effective_date,
    compute_projected_occupancy,
    get_subscription_payment_status,
    subscription_remaining_balance,
)

_PAID_ANNOTATION_MISSING = object()


class SubscriptionItemSerializer(serializers.ModelSerializer):
    activity_name = serializers.CharField(
        source="activity.name",
        read_only=True,
        default=None,
    )
    name_snapshot = serializers.SerializerMethodField()

    class Meta:
        model = SubscriptionItem
        fields = [
            "id",
            "item_type",
            "plan",
            "activity",
            "activity_name",
            "name_snapshot",
            "status",
            "price_snapshot",
            "start_date",
            "end_date",
            "created_at",
        ]
        read_only_fields = fields

    def get_name_snapshot(self, obj):
        return public_plan_name_from_snapshot(obj.name_snapshot)


class SubscriptionSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    member_photo = serializers.SerializerMethodField()
    plan_name = serializers.SerializerMethodField()

    plan_price = serializers.DecimalField(
        source="plan.price",
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )

    items = SubscriptionItemSerializer(many=True, read_only=True)
    total = serializers.SerializerMethodField()
    paid_amount = serializers.SerializerMethodField()
    remaining = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()
    has_pending_plan_change = serializers.SerializerMethodField()
    future_plan_name = serializers.SerializerMethodField()
    future_effective_date = serializers.SerializerMethodField()

    class Meta:
        model = Subscription

        fields = "__all__"

        read_only_fields = [
            "gym",
            "member",
            "plan",
            "start_date",
            "end_date",
            "paid",
            "auto_renew",
            "origin",
            "created_at",
        ]

    def get_member_name(self, obj):
        return (
            f"{obj.member.first_name} "
            f"{obj.member.last_name}"
        )

    def get_plan_name(self, obj):
        return public_plan_name(obj.plan)

    def get_member_photo(self, obj):
        if obj.member.photo:
            try:
                return obj.member.photo.url
            except Exception:
                return str(obj.member.photo)
        return None

    def get_total(self, obj):
        return str(calculate_subscription_total(obj))

    def _balance(self, obj):
        balance = getattr(obj, "_balance_cache", None)
        if balance is None:
            annotated = getattr(obj, "_paid_amount", _PAID_ANNOTATION_MISSING)
            if annotated is _PAID_ANNOTATION_MISSING:
                paid = None
            elif annotated is None:
                paid = Decimal("0")
            else:
                paid = annotated
            balance = subscription_remaining_balance(obj, paid_amount=paid)
            obj._balance_cache = balance
        return balance

    def get_paid_amount(self, obj):
        return str(self._balance(obj)["paid_amount"])

    def get_remaining(self, obj):
        return str(self._balance(obj)["remaining"])

    def get_payment_status(self, obj):
        return get_subscription_payment_status(
            obj,
            remaining=self._balance(obj)["remaining"],
        )

    def _get_pending_plan_change(self, obj):
        if hasattr(obj, "_pending_plan_change"):
            return obj._pending_plan_change

        changes = getattr(obj.member, "_pending_plan_change_requests", None)
        if changes is None:
            changes = PlanChangeRequest.objects.filter(
                member=obj.member,
                status="approved",
                effective_date__gt=date.today(),
            ).select_related("requested_plan")

        ordered = sorted(changes, key=lambda r: r.effective_date, reverse=True)
        pcr = ordered[0] if ordered else None
        obj._pending_plan_change = pcr
        return pcr

    def get_has_pending_plan_change(self, obj):
        return self._get_pending_plan_change(obj) is not None

    def get_future_plan_name(self, obj):
        pcr = self._get_pending_plan_change(obj)
        return pcr.requested_plan.name if pcr else None

    def get_future_effective_date(self, obj):
        pcr = self._get_pending_plan_change(obj)
        return str(pcr.effective_date) if pcr else None


class MemberOutstandingSubscriptionSerializer(serializers.Serializer):
    id = serializers.IntegerField(source="subscription.id")
    start_date = serializers.DateField(source="subscription.start_date")
    end_date = serializers.DateField(source="subscription.end_date")
    plan_name = serializers.SerializerMethodField()
    items = SubscriptionItemSerializer(many=True, read_only=True, source="subscription.items")
    paid = serializers.BooleanField(source="subscription.paid")
    total = serializers.DecimalField(max_digits=10, decimal_places=2)
    paid_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    remaining = serializers.DecimalField(max_digits=10, decimal_places=2)

    def get_plan_name(self, obj):
        return public_plan_name(obj["subscription"].plan)


class MemberOutstandingDebtSerializer(serializers.Serializer):
    member_id = serializers.IntegerField()
    subscriptions = MemberOutstandingSubscriptionSerializer(many=True)
    total = serializers.DecimalField(max_digits=10, decimal_places=2)


class OutstandingSubscriptionSerializer(serializers.Serializer):
    subscription_id = serializers.IntegerField(source="subscription.id")
    member_id = serializers.IntegerField(source="subscription.member.id")
    member_name = serializers.SerializerMethodField()
    plan_name = serializers.SerializerMethodField()
    payment_status = serializers.SerializerMethodField()
    items = SubscriptionItemSerializer(
        many=True, read_only=True, source="subscription.items"
    )
    total = serializers.DecimalField(max_digits=10, decimal_places=2)
    paid_amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    remaining = serializers.DecimalField(max_digits=10, decimal_places=2)

    def get_member_name(self, obj):
        return (
            f"{obj['subscription'].member.first_name} "
            f"{obj['subscription'].member.last_name}"
        )

    def get_plan_name(self, obj):
        return public_plan_name(obj["subscription"].plan)

    def get_payment_status(self, obj):
        return get_subscription_payment_status(
            obj["subscription"],
            remaining=obj["remaining"],
            is_first=obj["is_first"],
        )


class PlanChangeRequestSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    member_photo = serializers.SerializerMethodField()
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
            "member_photo",
            "subscription",
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
            "subscription",
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

    def get_member_photo(self, obj):
        if obj.member.photo:
            try:
                return obj.member.photo.url
            except Exception:
                return str(obj.member.photo)
        return None

    def get_current_plan_name(self, obj):
        if obj.subscription:
            return public_plan_name(obj.subscription.plan)

        if obj.current_plan_name_snapshot:
            return public_plan_name_from_snapshot(obj.current_plan_name_snapshot)

        return None

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

        subscription = SubscriptionDomain.get_active_subscription(validated_data["member"])
        validated_data["subscription"] = subscription
        if subscription:
            validated_data["current_plan_name_snapshot"] = public_plan_name(subscription.plan)

        validated_data["gym"] = gym
        return super().create(validated_data)


class PlanChangeRequestActionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanChangeRequest
        fields = ["status", "admin_notes"]

    def validate_status(self, value):
        if value not in ("approved", "rejected", "cancelled_by_staff", "cancelled_by_member"):
            raise serializers.ValidationError(
                "El estado debe ser 'approved', 'rejected', 'cancelled_by_staff' o 'cancelled_by_member'."
            )
        return value

    def validate(self, attrs):
        instance = self.instance
        new_status = attrs.get("status")

        if new_status in ("cancelled_by_staff", "cancelled_by_member"):
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
            "subscription",
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
            "subscription",
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
        if obj.subscription:
            return public_plan_name(obj.subscription.plan)

        if obj.current_plan_name_snapshot:
            return public_plan_name_from_snapshot(obj.current_plan_name_snapshot)

        return None

    def validate(self, attrs):
        member = self.context["member"]
        gym = SubscriptionDomain.resolve_gym(member)

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

        subscription = SubscriptionDomain.get_active_subscription(member)
        validated_data["subscription"] = subscription
        if subscription:
            validated_data["current_plan_name_snapshot"] = public_plan_name(subscription.plan)

        validated_data["gym"] = SubscriptionDomain.resolve_gym(member)
        validated_data["member"] = member
        return super().create(validated_data)