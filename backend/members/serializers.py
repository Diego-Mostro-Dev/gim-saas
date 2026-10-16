import unicodedata

from django.db import transaction
from django.utils import timezone

from rest_framework import serializers

from subscriptions.models import MembershipPlan
from subscriptions.domain import ScheduleDomain, ScheduleError, SubscriptionDomain
from subscriptions.services import (
    _resolve_plan,
    gym_approved_plan_change_plan,
    gym_debtor_member_ids,
    member_discount_percent,
    member_total_outstanding_debt,
)
from plans.services import public_plan_name
from members.eligibility import MemberEligibility
from gyms.models import Discount

from .attachments import (
    _validate_image,
    signed_attachment_url,
    upload_member_attachment,
)
from .models import HealthInsurance, Member, MemberAttachment

import json


def _normalize_name(name):
    """Normaliza un nombre para comparación: minúsculas, sin acentos y
    con espacios colapsados. Evita typos como 'IaPOZ' vs 'IAPOS'."""
    if not name:
        return ""
    text = unicodedata.normalize("NFD", name)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return " ".join(text.lower().split())


class _NullablePkField(serializers.PrimaryKeyRelatedField):
    """PK field que acepta vacío como null (para FormData que manda "")."""

    def to_internal_value(self, data):
        if data in (None, "", "null", "None"):
            return None
        return super().to_internal_value(data)


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
    discount_id = _NullablePkField(
        source="discount",
        queryset=Discount.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )
    discount_name = serializers.SerializerMethodField()
    discount_percent = serializers.SerializerMethodField()
    pending_attachments_count = serializers.SerializerMethodField()
    outing_enrollments = serializers.SerializerMethodField()

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
            "address",
            "insurance_id",
            "insurance_name",
            "insurance_session_price",
            "insurance_sellado_amount",
            "insurance",
            "discount_id",
            "discount_name",
            "discount_percent",
            "active",
            "entry_mode",
            "is_comp",
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
            "pending_attachments_count",
            "outing_enrollments",
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
        if obj.is_comp:
            return "Pase de cortesía"
        sub = self._active_subscription(obj)
        if sub is None:
            return None
        return public_plan_name(sub.plan)

    def get_plan_price(self, obj):
        if obj.is_comp:
            return None
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

    def get_pending_attachments_count(self, obj):
        """
        Cantidad de adjuntos aún no revisados por el staff. Se usa para el
        badge de pendientes en la ficha del socio. Se calcula sobre el
        queryset anotado (members list) o con una query puntual cuando el
        miembro se serializa en soledad.
        """
        annotated = getattr(obj, "pending_attachments_count", None)
        if annotated is not None:
            return annotated
        return MemberAttachment.objects.filter(
            member=obj,
            reviewed=False,
        ).count()

    def get_is_recoverable(self, obj):
        """Whether the member needs recovery, by recover_member's own rule.

        Prefer bulk precomputation from serializer context (fixed number of
        queries for the whole list). If not present, fall back to the
        per-member helpers to preserve existing behaviour (detail view, tests).
        """
        today = timezone.localdate()

        if obj.is_comp:
            return False

        subs = list(obj.subscription_set.all())
        if not subs:
            return False

        latest_sub = max(subs, key=lambda s: (s.start_date, s.created_at))

        context = self.context or {}
        debtor_member_ids = context.get("debtor_member_ids")
        approved_plan_by_member = context.get("approved_plan_by_member")

        if debtor_member_ids is not None:
            if obj.id in debtor_member_ids:
                return False
        elif member_total_outstanding_debt(obj)["total"] > 0:
            return False

        has_current = any(
            sub.start_date <= today <= sub.end_date for sub in subs
        )
        if has_current:
            return not obj.active

        if any(sub.start_date > today for sub in subs):
            return False

        if approved_plan_by_member is not None:
            plan = approved_plan_by_member.get(obj.id) or latest_sub.plan
        else:
            plan, _ = _resolve_plan(obj, latest_sub, today)
        return not plan.is_base

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

    def validate_discount(self, value):
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

        if gym is not None and not Discount.objects.filter(
            id=value.id, gym=gym, active=True
        ).exists():
            raise serializers.ValidationError(
                "El descuento seleccionado no es válido."
            )

        return value

    def get_discount_name(self, obj):
        if obj.discount is None or not obj.discount.active:
            return None
        return obj.discount.name

    def get_discount_percent(self, obj):
        percent = member_discount_percent(obj)
        return percent if percent > 0 else None

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

        is_comp = validated_data.pop("is_comp", None)
        was_comp = instance.is_comp

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()

        if is_comp is not None and is_comp != was_comp:
            # ── Pase de cortesía: transición de membresía ─────────────
            # El flag se persiste ANTES de mutate_membership (Fase 7.1, P2):
            # _item_price y subscription_remaining_balance leen member.is_comp,
            # así que guardarlo después hace que el período se escriba con el
            # valor anterior (fantasma de #48). Con suscripción vigente el
            # dominio reescribe los precios a mano y el bug queda oculto.
            with transaction.atomic():
                instance.is_comp = is_comp
                instance.save(update_fields=["is_comp"])
                if is_comp:
                    SubscriptionDomain.mutate_membership(
                        member=instance,
                        comp=True,
                    )
                else:
                    plan = self._resolve_plan_for_comp_off(instance)
                    SubscriptionDomain.mutate_membership(
                        member=instance,
                        comp=False,
                        plan=plan,
                    )

        if "schedules" in self.initial_data:
            schedules = self._parse_schedules()
            subscription = SubscriptionDomain.get_current_subscription(instance)

            try:
                ScheduleDomain.sync_schedules(instance, instance.gym, schedules, subscription=subscription)
            except ScheduleError as e:
                raise serializers.ValidationError(str(e))

        return instance

    def get_outing_enrollments(self, obj):
        """Inscripciones a salidas grupales activas, para la ficha del socio."""
        enrollments = getattr(obj, "outing_enrollments", None)
        if enrollments is None:
            return []
        result = []
        for e in enrollments.all():
            if not e.active:
                continue
            schedule = e.schedule
            outing = schedule.outing
            result.append(
                {
                    "id": e.id,
                    "outing_id": outing.id,
                    "outing": outing.name,
                    "schedule_id": schedule.id,
                    "day": schedule.day,
                    "start_time": schedule.start_time.strftime("%H:%M"),
                    "end_time": schedule.end_time.strftime("%H:%M"),
                    "modality": e.modality,
                    "sessions_used": e.used_sessions,
                    "sessions_total": e.package_total_sessions
                    if e.modality == "package"
                    else 0,
                    "active": e.active,
                }
            )
        return result

    def _resolve_plan_for_comp_off(self, member):
        """Return the paid plan to apply when the courtesy pass is removed.

        Activity-only members return to the base plan (no charge). Members
        with gym access must pick a valid paid membership plan.
        """
        if member.entry_mode == "ACTIVITY_ONLY":
            from plans.services import ensure_base_plan_for_gym

            return ensure_base_plan_for_gym(member.gym)

        raw = self.initial_data.get("plan_id")
        if isinstance(raw, list):
            raw = raw[0] if raw else None
        if raw in ("", None):
            raise serializers.ValidationError(
                {"plan_id": "Para quitar el pase de cortesía elegí un plan de membresía."}
            )

        plan = MembershipPlan.objects.filter(
            id=raw, gym=member.gym, is_base=False
        ).first()
        if plan is None:
            raise serializers.ValidationError(
                {"plan_id": "El plan seleccionado no es válido."}
            )
        return plan


class PublicMemberSerializer(MemberSerializer):

    class Meta(MemberSerializer.Meta):
        fields = MemberSerializer.Meta.fields + ["access_token"]
        read_only_fields = ["gym", "access_token", "active", "is_comp"]


class MemberPhotoSerializer(serializers.ModelSerializer):

    class Meta:
        model = Member
        fields = ["photo"]

    def validate_photo(self, value):
        _validate_image(value)
        return value

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


class PublicMemberDataSerializer(serializers.ModelSerializer):
    """Edición de sus propios datos desde el portal del socio.

    Solo expone campos editables por el propio miembro. El contexto recibe
    la instancia de Member (resuelta por access_token) para poder validar
    unicidad de teléfono dentro de su gimnasio.
    """

    class Meta:
        model = Member
        fields = [
            "id",
            "first_name",
            "last_name",
            "whatsapp",
            "phone",
            "email",
            "address",
            "date_of_birth",
            "document_number",
            "entry_mode",
            "active",
            "photo",
        ]
        read_only_fields = [
            "id",
            "entry_mode",
            "active",
            "photo",
        ]

    def validate_phone(self, value):
        member = self.instance

        if member is None:
            return value

        qs = Member.objects.filter(
            phone=value,
            gym=member.gym,
        ).exclude(id=member.id)

        if qs.exists():
            raise serializers.ValidationError(
                "Ya existe un socio con ese teléfono."
            )

        return value

    def validate_date_of_birth(self, value):
        if value and value > timezone.localdate():
            raise serializers.ValidationError(
                "La fecha de nacimiento no puede ser futura."
            )
        return value

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


class MemberAttachmentSerializer(serializers.ModelSerializer):
    category_label = serializers.SerializerMethodField()
    member_name = serializers.SerializerMethodField()
    file = serializers.FileField(write_only=True)
    url = serializers.SerializerMethodField()

    class Meta:
        model = MemberAttachment
        fields = [
            "id",
            "category",
            "category_label",
            "file",
            "url",
            "note",
            "reviewed",
            "member_id",
            "member_name",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "category_label",
            "url",
            "reviewed",
            "member_id",
            "member_name",
            "created_at",
        ]

    def get_category_label(self, obj):
        return obj.get_category_display()

    def get_member_name(self, obj):
        return f"{obj.member.first_name} {obj.member.last_name}"

    def get_url(self, obj):
        return signed_attachment_url(obj.file)

    def create(self, validated_data):
        upload = validated_data.pop("file")
        member = validated_data["member"]

        public_id = upload_member_attachment(
            upload,
            member.gym_id,
            member.id,
        )

        return MemberAttachment.objects.create(
            file=public_id,
            **validated_data,
        )


class PublicMemberAttachmentSerializer(serializers.ModelSerializer):
    category_label = serializers.SerializerMethodField()
    file = serializers.FileField(write_only=True)
    url = serializers.SerializerMethodField()

    class Meta:
        model = MemberAttachment
        fields = [
            "id",
            "category",
            "category_label",
            "file",
            "url",
            "note",
            "reviewed",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "category_label",
            "url",
            "reviewed",
            "created_at",
        ]

    def get_category_label(self, obj):
        return obj.get_category_display()

    def get_url(self, obj):
        return signed_attachment_url(obj.file)

    def create(self, validated_data):
        upload = validated_data.pop("file")
        member = validated_data["member"]

        public_id = upload_member_attachment(
            upload,
            member.gym_id,
            member.id,
        )

        return MemberAttachment.objects.create(
            file=public_id,
            **validated_data,
        )
