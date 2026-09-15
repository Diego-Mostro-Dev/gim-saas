from django.contrib.auth.models import User
from rest_framework import serializers

from gyms.models import Gym
from gyms.serializers import GymSerializer
from profiles.models import UserProfile
from .services import slugify


# ---------------------------------------------------------------------------
# Payload anidado de creación
# ---------------------------------------------------------------------------

class ServiceItemSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    active = serializers.BooleanField(required=False, default=True)


class PlanItemSerializer(serializers.Serializer):
    service = serializers.CharField(max_length=100, required=True)
    name = serializers.CharField(max_length=100, required=True)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    price = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    duration_days = serializers.IntegerField(min_value=1, required=False, default=30)
    weekly_visits = serializers.IntegerField(
        min_value=1, required=False, allow_null=True, default=None
    )
    active = serializers.BooleanField(required=False, default=True)


class ActivityScheduleItemSerializer(serializers.Serializer):
    day = serializers.ChoiceField(
        choices=[
            "monday", "tuesday", "wednesday", "thursday",
            "friday", "saturday", "sunday",
        ]
    )
    start_time = serializers.TimeField()
    end_time = serializers.TimeField()
    capacity = serializers.IntegerField(min_value=1)
    active = serializers.BooleanField(required=False, default=True)


class ActivityItemSerializer(serializers.Serializer):
    service = serializers.CharField(max_length=100, required=False, default="Actividades")
    name = serializers.CharField(max_length=100, required=True)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    instructor_name = serializers.CharField(
        max_length=100, required=False, allow_blank=True, default=""
    )
    monthly_price = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, default=0
    )
    billing_mode = serializers.ChoiceField(
        choices=["monthly", "sessions"], required=False, default="monthly"
    )
    active = serializers.BooleanField(required=False, default=True)
    schedules = ActivityScheduleItemSerializer(many=True, required=False, default=[])

    def validate(self, attrs):
        if attrs.get("billing_mode") == "sessions" and not attrs.get("schedules"):
            raise serializers.ValidationError(
                "Las actividades por sesiones necesitan al menos un horario."
            )
        return attrs


class SlotItemSerializer(serializers.Serializer):
    day = serializers.ChoiceField(
        choices=[
            "monday", "tuesday", "wednesday", "thursday",
            "friday", "saturday", "sunday",
        ]
    )
    hour = serializers.TimeField()
    capacity = serializers.IntegerField(min_value=1, required=False, allow_null=True)


class DiscountItemSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    discount_percent = serializers.IntegerField(min_value=1, max_value=100)
    active = serializers.BooleanField(required=False, default=True)


class HealthInsuranceItemSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120)
    session_price = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, default=0
    )
    sellado_amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, allow_null=True, default=None
    )
    active = serializers.BooleanField(required=False, default=True)


class ClosedDateItemSerializer(serializers.Serializer):
    date = serializers.DateField()
    reason = serializers.CharField(
        max_length=200, required=False, allow_blank=True, default=""
    )


class OwnerItemSerializer(serializers.Serializer):
    mode = serializers.ChoiceField(choices=["link", "credentials"], required=False, default="link")
    username = serializers.CharField(
        max_length=150, required=False, allow_blank=True, default=""
    )
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    password = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if attrs.get("mode") == "credentials":
            username = attrs.get("username")
            password = attrs.get("password")
            if not username:
                raise serializers.ValidationError(
                    {"username": "Se requiere un usuario para crear credenciales."}
                )
            if not password:
                raise serializers.ValidationError(
                    {"password": "Se requiere una contraseña para crear credenciales."}
                )
            if len(password) < 8:
                raise serializers.ValidationError(
                    {"password": "La contraseña debe tener al menos 8 caracteres."}
                )
            if User.objects.filter(username=username).exists():
                raise serializers.ValidationError(
                    {"username": f"El usuario '{username}' ya existe."}
                )
        return attrs


# ---------------------------------------------------------------------------
# Serializer principal de creación
# ---------------------------------------------------------------------------

class AdminGymCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    slug = serializers.SlugField(required=False, allow_blank=True)
    active = serializers.BooleanField(required=False, default=True)

    whatsapp = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    email = serializers.EmailField(required=False, allow_blank=True, default="")
    logo = serializers.URLField(required=False, allow_blank=True, allow_null=True, default=None)
    app_icon = serializers.URLField(required=False, allow_blank=True, allow_null=True, default=None)

    qr_attendance_message = serializers.CharField(
        max_length=120, required=False, allow_blank=True, default=""
    )
    qr_registration_message = serializers.CharField(
        max_length=120, required=False, allow_blank=True, default=""
    )
    default_schedule_capacity = serializers.IntegerField(
        min_value=1, required=False, allow_null=True, default=None
    )

    payment_due_day = serializers.IntegerField(
        min_value=1, max_value=31, required=False, default=10
    )
    access_block_day = serializers.IntegerField(
        min_value=1, max_value=31, required=False, default=16
    )
    allow_plan_changes = serializers.BooleanField(required=False, default=True)
    allow_schedule_changes = serializers.BooleanField(required=False, default=True)
    schedule_change_cooldown_hours = serializers.IntegerField(
        min_value=0, required=False, default=168
    )
    max_schedule_changes_per_month = serializers.IntegerField(
        min_value=0, required=False, default=4
    )
    allow_session_recovery = serializers.BooleanField(required=False, default=False)
    max_session_recoveries_per_month = serializers.IntegerField(
        min_value=0, required=False, default=2
    )

    features = serializers.DictField(required=False, default=dict)

    services = ServiceItemSerializer(many=True, required=False, default=[])
    plans = PlanItemSerializer(many=True, required=False, default=[])
    activities = ActivityItemSerializer(many=True, required=False, default=[])
    slots = SlotItemSerializer(many=True, required=False, default=[])
    discounts = DiscountItemSerializer(many=True, required=False, default=[])
    health_insurances = HealthInsuranceItemSerializer(many=True, required=False, default=[])
    closed_dates = ClosedDateItemSerializer(many=True, required=False, default=[])

    seo_title = serializers.CharField(max_length=120, required=False, allow_blank=True, default="")
    seo_description = serializers.CharField(required=False, allow_blank=True, default="")
    seo_keywords = serializers.CharField(max_length=250, required=False, allow_blank=True, default="")
    seo_city = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    seo_address = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    seo_hours = serializers.CharField(required=False, allow_blank=True, default="")

    owner = OwnerItemSerializer(required=False)

    def validate_slug(self, value):
        if not value:
            return value
        if Gym.objects.filter(slug=value).exists():
            raise serializers.ValidationError(f"Ya existe un gimnasio con slug '{value}'.")
        return value

    def validate(self, attrs):
        payment_due_day = attrs.get("payment_due_day", 10)
        access_block_day = attrs.get("access_block_day", 16)
        if access_block_day <= payment_due_day:
            raise serializers.ValidationError(
                {
                    "access_block_day": (
                        "El día de bloqueo debe ser posterior al día de vencimiento."
                    )
                }
            )

        services = attrs.get("services", [])
        services_seen = set()
        for service in services:
            slug = slugify(service["name"])
            if slug in services_seen:
                raise serializers.ValidationError(
                    {"services": f"El servicio '{service['name']}' está repetido."}
                )
            services_seen.add(slug)

        return attrs


# ---------------------------------------------------------------------------
# Serializer de listado (owner user_id para el reset de contraseña)
# ---------------------------------------------------------------------------

class AdminGymListSerializer(GymSerializer):
    owner_user_id = serializers.SerializerMethodField()
    owner_username = serializers.SerializerMethodField()

    class Meta(GymSerializer.Meta):
        fields = GymSerializer.Meta.fields + ["owner_user_id", "owner_username"]

    def get_owner_user_id(self, obj):
        owner = obj.users.filter(role=UserProfile.ROLE_OWNER).first()
        return owner.user_id if owner else None

    def get_owner_username(self, obj):
        owner = obj.users.filter(role=UserProfile.ROLE_OWNER).first()
        return owner.user.username if owner else None


# ---------------------------------------------------------------------------
# Serializer de actualización (datos + features)
# ---------------------------------------------------------------------------

class AdminGymUpdateSerializer(GymSerializer):
    """GymSerializer pero con `features` escribible (el owner no puede tocarlas)."""

    features = serializers.DictField(required=False)

    class Meta(GymSerializer.Meta):
        read_only_fields = []