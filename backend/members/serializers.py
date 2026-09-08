import unicodedata

from django.utils import timezone

from rest_framework import serializers

from subscriptions.models import MembershipPlan
from subscriptions.domain import ScheduleDomain, ScheduleError, SubscriptionDomain
from plans.services import public_plan_name
from members.eligibility import MemberEligibility

from .models import HealthInsurance, Member

import json


def _normalize_name(name):
    """Normaliza un nombre para comparación: minúsculas, sin acentos y
    con espacios colapsados. Evita typos como 'IaPOZ' vs 'IAPOS'."""
    if not name:
        return ""
    text = unicodedata.normalize("NFD", name)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return " ".join(text.lower().split())


class HealthInsuranceSerializer(serializers.ModelSerializer):

    class Meta:
        model = HealthInsurance
        fields = [
            "id",
            "name",
            "session_price",
            "sellado_amount",
            "active",
        ]

    def validate(self, attrs):
        gym = None
        request = self.context.get("request")
        if request is not None and hasattr(request.user, "profile"):
            gym = request.user.profile.gym

        name = attrs.get("name")
        if gym is not None and name:
            existing = HealthInsurance.objects.filter(
                gym=gym,
                name__iexact=name,
            )
            if self.instance is not None:
                existing = existing.exclude(pk=self.instance.pk)
            if existing.exists():
                raise serializers.ValidationError(
                    {
                        "name": (
                            "Ya existe una obra social con ese nombre "
                            "en este gimnasio."
                        )
                    }
                )

        return attrs


class MemberSerializer(serializers.ModelSerializer):
    schedules = serializers.SerializerMethodField()
    plan_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    document_number = serializers.CharField(max_length=30, required=True)
    date_of_birth = serializers.DateField(required=True, allow_null=True)
    subscription_active = serializers.SerializerMethodField()
    plan_name = serializers.SerializerMethodField()
    plan_price = serializers.SerializerMethodField()
    subscription_days_remaining = serializers.SerializerMethodField()
    subscription_end_date = serializers.SerializerMethodField()
    member_created_at = serializers.SerializerMethodField()
    is_recoverable = serializers.SerializerMethodField()
    insurance_id = serializers.IntegerField(
        source="insurance.id",
        read_only=True,
        allow_null=True,
    )
    insurance_name = serializers.SerializerMethodField()
    insurance_session_price = serializers.SerializerMethodField()
    insurance_sellado_amount = serializers.SerializerMethodField()
    insurance = serializers.PrimaryKeyRelatedField(
        queryset=HealthInsurance.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )

    class Meta:
        model = Member

        fields = [
            "id",
            "first_name",
            "last_name",
            "phone",
            "email",
            "document_number",
            "date_of_birth",
            "health_insurance",
            "affiliate_number",
            "insurance_id",
            "insurance_name",
            "insurance_session_price",
            "insurance_sellado_amount",
            "insurance",
            "active",
            "entry_mode",
            "schedules",
            "gym",
            "photo",
            "plan_id",
            "subscription_active",
            "plan_name",
            "plan_price",
            "subscription_days_remaining",
            "subscription_end_date",
            "member_created_at",
            "is_recoverable",
        ]

        read_only_fields = ["gym", "active"]

    def _active_subscription(self, obj):
        """Most recent subscription whose start_date is in the past (or today).

        Uses the prefetched subscription_set — zero extra DB queries.
        Mirrors SubscriptionDomain.get_active_subscription logic.
        """
        today = timezone.localdate()
        candidates = [
            sub for sub in obj.subscription_set.all()
            if sub.start_date <= today
        ]
        if not candidates:
            return None
        return max(candidates, key=lambda s: (s.start_date, s.created_at))

    def _current_subscription(self, obj):
        """Subscription that covers today (start <= today <= end).

        Uses the prefetched subscription_set — zero extra DB queries.
        Mirrors SubscriptionDomain.get_current_subscription logic.
        """
        today = timezone.localdate()
        candidates = [
            sub for sub in obj.subscription_set.all()
            if sub.start_date <= today <= sub.end_date
        ]
        if not candidates:
            return None
        return max(candidates, key=lambda s: (s.start_date, s.created_at))

    def get_subscription_active(self, obj):
        return self._current_subscription(obj) is not None

    def get_plan_name(self, obj):
        sub = self._active_subscription(obj)
        if sub is None:
            return None
        return public_plan_name(sub.plan)

    def get_plan_price(self, obj):
        sub = self._active_subscription(obj)
        if sub is None or sub.plan is None:
            return None
        return str(sub.plan.price)

    def get_subscription_days_remaining(self, obj):
        sub = self._current_subscription(obj)
        if sub is None:
            return None
        today = timezone.localdate()
        return (sub.end_date - today).days

    def get_subscription_end_date(self, obj):
        sub = self._current_subscription(obj)
        if sub is None:
            return None
        return sub.end_date.isoformat()

    def get_member_created_at(self, obj):
        return obj.created_at.isoformat() if obj.created_at else None

    def get_insurance_name(self, obj):
        if obj.insurance_id is None:
            return obj.health_insurance or None
        return obj.insurance.name

    def get_insurance_session_price(self, obj):
        if obj.insurance_id is None or obj.insurance.session_price is None:
            return None
        return str(obj.insurance.session_price)

    def get_insurance_sellado_amount(self, obj):
        if obj.insurance_id is None or obj.insurance.sellado_amount is None:
            return None
        return str(obj.insurance.sellado_amount)

    def get_is_recoverable(self, obj):
        """Replicate recover_member's preconditions in read-only mode.

        A member is recoverable only when recover_member() would actually
        proceed today. This mirrors subscriptions.services.recover_member
        WITHOUT mutating data (it never opens subscriptions nor sets
        active=True) and WITHOUT additional queries: it relies on the
        prefetched relations (subscription_set__plan/items/payments) so the
        whole member list is serialized in constant queries, not N+1.

        Rules (same as recover_member):
        - Only a member without a live subscription can be a candidate.
        - Any subscription with a remaining balance means debt -> not recoverable.
        - Must have at least one previous subscription.
        - No future subscription.
        - A base plan is only rejected when there is no current subscription.
        """
        today = timezone.localdate()

        has_debt = False
        has_current = False
        has_future = False
        latest_sub = None

        for package in obj.activity_enrollments.all():
            remaining = package.remaining_amount
            if remaining and remaining > 0 and package.session_price is not None:
                has_debt = True
                break

        if not has_debt:
            for sub in obj.subscription_set.all():
                if latest_sub is None or (
                    sub.start_date,
                    sub.created_at,
                ) > (latest_sub.start_date, latest_sub.created_at):
                    latest_sub = sub

                if sub.start_date > today:
                    has_future = True
                elif sub.start_date <= today <= sub.end_date:
                    has_current = True

                if has_debt:
                    continue

                items = list(sub.items.all())
                total = sum(
                    item.price_snapshot
                    for item in items
                    if item.status == "active"
                )
                has_plan_item = any(
                    item.item_type == "plan" for item in items
                )
                if not has_plan_item and sub.plan is not None:
                    total += sub.plan.price

                paid = sum(p.amount for p in sub.payments.all())

                if total - paid > 0:
                    has_debt = True

        if has_debt:
            return False
        if latest_sub is None:
            return False
        if has_future:
            return False
        # A healthy member (active + live subscription) has nothing to recover.
        # The key case is the "limbo" member: active=True because nothing ever
        # flips the flag, but with an expired subscription and no current one.
        # recover_member() DOES handle them (Case B creates the new
        # subscription), so the UI badge/filter must agree and not hide them.
        if obj.active and has_current:
            return False
        if not has_current and latest_sub.plan.is_base:
            return False

        return True

    def validate_insurance(self, value):
        if value is None:
            return value

        gym = self.context.get("gym")

        if gym is None:
            request = self.context.get("request")

            if (
                request
                and hasattr(request.user, "profile")
            ):
                gym = request.user.profile.gym

        if gym is not None and not HealthInsurance.objects.filter(
            id=value.id, gym=gym
        ).exists():
            raise serializers.ValidationError(
                "La obra social seleccionada no es válida."
            )

        return value

    def validate_plan_id(self, value):
        if value is None:
            return value
        gym = self.context.get("gym")
        if gym is None:
            request = self.context.get("request")
            if request and hasattr(request.user, "profile"):
                gym = request.user.profile.gym
        if not MembershipPlan.objects.filter(id=value, gym=gym, is_base=False).exists():
            raise serializers.ValidationError("El plan seleccionado no es válido.")
        return value

    def validate_phone(self, value):
        gym = self.context.get("gym")

        if gym is None:
            request = self.context.get("request")

            if (
                request
                and hasattr(request.user, "profile")
            ):
                gym = request.user.profile.gym

        if gym is None:
            return value

        qs = Member.objects.filter(
            phone=value,
            gym=gym,
        )

        instance = getattr(self, "instance", None)

        if instance:
            qs = qs.exclude(id=instance.id)

        if qs.exists():
            raise serializers.ValidationError(
                "Ya existe un socio con ese teléfono."
            )

        return value

    def validate(self, attrs):
        if self.instance is not None and "schedules" in self.initial_data:
            schedules = self._parse_schedules()
            new_set = {(s["day"], s["hour"]) for s in schedules}
            new_count = len(new_set)

            limit = MemberEligibility.get_schedule_limit(self.instance)
            if limit is not None:
                current_count = MemberEligibility.get_active_schedule_count(self.instance)
                if new_count > limit and new_count > current_count:
                    raise serializers.ValidationError(
                        f"Your plan allows a maximum of {limit} weekly schedules."
                    )

        self._autolink_insurance(attrs)

        return attrs

    def _autolink_insurance(self, attrs):
        """Si llega un texto de obra social y no viene un FK explícito, enlaza
        automáticamente la obra social configurada del gym cuyo nombre coincida
        (ignorando mayúsculas/acentos/espacios). Esto cubre el registro público
        (que solo manda texto) y evita typos como 'IaPOZ' vs 'IAPOS'."""
        name = attrs.get("health_insurance")
        if not name:
            return

        if attrs.get("insurance") is not None:
            return

        gym = self.context.get("gym")
        if gym is None:
            request = self.context.get("request")
            if request is not None and hasattr(request.user, "profile"):
                gym = request.user.profile.gym
        if gym is None:
            return

        normalized = _normalize_name(name)
        if not normalized:
            return

        for ins in HealthInsurance.objects.filter(gym=gym):
            if _normalize_name(ins.name) == normalized:
                attrs["insurance"] = ins
                return

    def validate_date_of_birth(self, value):
        if value and value > timezone.localdate():
            raise serializers.ValidationError(
                "La fecha de nacimiento no puede ser futura."
            )
        return value

    def get_schedules(self, obj):
        return [
            {
                "day": s.slot.day,
                "hour": s.slot.hour.strftime("%H:%M"),
            }
            for s in obj.schedules.all()
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)

        if instance.photo:
            try:
                data["photo"] = instance.photo.url
            except Exception:
                data["photo"] = str(instance.photo)
        else:
            data["photo"] = None

        return data

    def _validate_schedule_slot(self, gym, day, hour):
        try:
            return ScheduleDomain.validate_slot(gym, day, hour)
        except ScheduleError as e:
            raise serializers.ValidationError(str(e))

    def _parse_schedules(self):
        schedules = self.initial_data.get(
            "schedules",
            [],
        )

        if isinstance(schedules, str):
            try:
                schedules = json.loads(schedules)
            except Exception:
                schedules = []

        return schedules

    def update(self, instance, validated_data):
        validated_data.pop("plan_id", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        if "schedules" in self.initial_data:
            schedules = self._parse_schedules()
            subscription = SubscriptionDomain.get_current_subscription(instance)

            try:
                ScheduleDomain.sync_schedules(instance, instance.gym, schedules, subscription=subscription)
            except ScheduleError as e:
                raise serializers.ValidationError(str(e))

        return instance


class PublicMemberSerializer(MemberSerializer):

    class Meta(MemberSerializer.Meta):
        fields = MemberSerializer.Meta.fields + ["access_token"]
        read_only_fields = ["gym", "access_token", "active"]


class MemberPhotoSerializer(serializers.ModelSerializer):

    class Meta:
        model = Member
        fields = ["photo"]

    def to_representation(self, instance):
        data = super().to_representation(instance)

        if instance.photo:
            try:
                data["photo"] = instance.photo.url
            except Exception:
                data["photo"] = str(instance.photo)
        else:
            data["photo"] = None

        return data
