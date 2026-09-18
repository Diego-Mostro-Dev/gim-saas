from django.db.models import Count
from rest_framework import serializers

from members.identity import member_identity
from members.models import Member
from plans.models import Service as PlanService
from profiles.models import UserProfile

from .assignment_service import AssignmentError, AssignmentService
from .models import (
    PersonalTrainingAssignment,
    PersonalTrainingChangeRequest,
    PersonalTrainingService,
)


class PersonalTrainingServiceSerializer(serializers.ModelSerializer):
    service = serializers.PrimaryKeyRelatedField(
        queryset=PlanService.objects.none(),
        required=False,
        allow_null=True,
    )
    assignment_count = serializers.SerializerMethodField()

    class Meta:
        model = PersonalTrainingService
        fields = [
            "id",
            "service",
            "name",
            "description",
            "monthly_price",
            "billing_mode",
            "duration_minutes",
            "trainer_gender",
            "active",
            "assignment_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]
        validators = []

    def get_assignment_count(self, obj):
        return getattr(obj, "assignment_count", 0)

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        if request and hasattr(request.user, "profile"):
            fields["service"].queryset = PlanService.objects.filter(
                gym=request.user.profile.gym
            )
        return fields

    def validate_name(self, value):
        request = self.context.get("request")
        if request and hasattr(request.user, "profile") and request.user.profile.gym:
            qs = PersonalTrainingService.objects.filter(
                gym=request.user.profile.gym,
                name=value,
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    "Ya existe una oferta con ese nombre."
                )
        return value

    def create(self, validated_data):
        gym = validated_data.pop("gym")
        service = validated_data.pop("service", None)
        if service is None:
            service = PlanService.get_default_personal_training_service(gym)
        return PersonalTrainingService.objects.create(
            gym=gym, service=service, **validated_data
        )

    def update(self, instance, validated_data):
        gym = instance.gym
        if "service" in validated_data:
            service = validated_data["service"]
            if service.gym_id != gym.id:
                raise serializers.ValidationError(
                    {"service": "El servicio no pertenece a este gimnasio."}
                )
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save(update_fields=validated_data.keys())
        return instance


class TrainerSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.CharField(source="user.email", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "gender",
            "role",
            "phone",
            "whatsapp",
        ]


class PersonalTrainingAssignmentSerializer(serializers.ModelSerializer):
    member = serializers.SerializerMethodField()
    member_id = serializers.PrimaryKeyRelatedField(
        source="member",
        queryset=Member.objects.none(),
        write_only=True,
    )
    member_address = serializers.SerializerMethodField()
    trainer_id = serializers.PrimaryKeyRelatedField(
        source="trainer",
        queryset=UserProfile.objects.none(),
        write_only=True,
    )
    trainer_name = serializers.SerializerMethodField()
    trainer_gender = serializers.SerializerMethodField()
    trainer_phone = serializers.SerializerMethodField()
    trainer_whatsapp = serializers.SerializerMethodField()
    trainer_email = serializers.SerializerMethodField()
    service = serializers.PrimaryKeyRelatedField(
        queryset=PersonalTrainingService.objects.none(),
    )
    service_name = serializers.SerializerMethodField()
    service_billing_mode = serializers.SerializerMethodField()
    monthly_price = serializers.SerializerMethodField()
    duration_minutes = serializers.SerializerMethodField()
    sessions_total = serializers.SerializerMethodField()
    sessions_used = serializers.SerializerMethodField()
    exhausted = serializers.SerializerMethodField()
    last_session_date = serializers.SerializerMethodField()
    total_amount = serializers.SerializerMethodField()
    remaining_amount = serializers.SerializerMethodField()

    class Meta:
        model = PersonalTrainingAssignment
        fields = [
            "id",
            "gym",
            "member",
            "member_id",
            "member_address",
            "trainer_id",
            "trainer_name",
            "trainer_gender",
            "trainer_phone",
            "trainer_whatsapp",
            "trainer_email",
            "service",
            "service_name",
            "service_billing_mode",
            "monthly_price",
            "duration_minutes",
            "day",
            "start_time",
            "end_time",
            "active",
            "modality",
            "package_total_sessions",
            "sessions_total",
            "sessions_used",
            "exhausted",
            "session_price",
            "amount_paid",
            "total_amount",
            "remaining_amount",
            "sellado_amount",
            "sellado_paid",
            "last_session_date",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["gym", "created_at", "updated_at", "amount_paid"]
        validators = []

    def get_member(self, obj):
        return member_identity(obj.member)

    def get_member_address(self, obj):
        return obj.member.address or None

    def get_trainer_name(self, obj):
        return obj.trainer_name

    def get_trainer_gender(self, obj):
        profile = getattr(obj.trainer, "profile", None)
        return profile.gender if profile else None

    def get_trainer_phone(self, obj):
        profile = getattr(obj.trainer, "profile", None)
        return profile.phone or None if profile else None

    def get_trainer_whatsapp(self, obj):
        profile = getattr(obj.trainer, "profile", None)
        return profile.whatsapp or None if profile else None

    def get_trainer_email(self, obj):
        return obj.trainer.email or None if obj.trainer else None

    def get_service_name(self, obj):
        return obj.service.name

    def get_service_billing_mode(self, obj):
        return obj.service.billing_mode

    def get_monthly_price(self, obj):
        return str(obj.service.monthly_price)

    def get_duration_minutes(self, obj):
        return obj.service.duration_minutes

    def get_sessions_total(self, obj):
        if obj.modality != "package":
            return 0
        return obj.package_total_sessions or 0

    def get_sessions_used(self, obj):
        used = getattr(obj, "used_sessions_count", None)
        if used is None:
            used = obj.used_sessions
        return used

    def get_exhausted(self, obj):
        if obj.modality != "package":
            return False
        total = obj.package_total_sessions
        return total is not None and self.get_sessions_used(obj) >= total

    def get_last_session_date(self, obj):
        if obj.modality != "package":
            return None
        last = getattr(obj, "last_session_date", None)
        if last is None:
            last_record = obj.session_records.order_by("-date").first()
            last = last_record.date if last_record else None
        return last.isoformat() if last else None

    def get_total_amount(self, obj):
        total = obj.total_amount
        return str(total) if total is not None else None

    def get_remaining_amount(self, obj):
        remaining = obj.remaining_amount
        return str(remaining) if remaining is not None else None

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        if request and hasattr(request.user, "profile") and request.user.profile.gym:
            gym = request.user.profile.gym
            fields["member_id"].queryset = Member.objects.filter(gym=gym)
            fields["trainer_id"].queryset = UserProfile.objects.filter(
                gym=gym, role=UserProfile.ROLE_TRAINER
            ).select_related("user")
            fields["service"].queryset = PersonalTrainingService.objects.filter(
                gym=gym
            )
        return fields

    def validate(self, attrs):
        request = self.context.get("request")
        gym = request.user.profile.gym if request else None
        if gym is None:
            raise serializers.ValidationError("Usuario sin gimnasio asignado.")

        if self.instance is None:
            member = attrs.get("member")
            trainer = attrs.get("trainer").user if attrs.get("trainer") else None
            service = attrs.get("service")
            day = attrs.get("day")
            start_time = attrs.get("start_time")
            end_time = attrs.get("end_time")
            if not all([member, trainer, service, day, start_time, end_time]):
                raise serializers.ValidationError("Faltan campos obligatorios.")
            if end_time <= start_time:
                raise serializers.ValidationError(
                    "La hora de fin debe ser posterior a la hora de inicio."
                )
            try:
                AssignmentService.check_assignment_inputs(
                    member, service, trainer, gym
                )
                from .overlap import validate_assignment
                validate_assignment(
                    member, trainer, day, start_time, end_time
                )
            except (AssignmentError, ValueError) as e:
                raise serializers.ValidationError(str(e))
        else:
            day = attrs.get("day") or self.instance.day
            start_time = attrs.get("start_time") or self.instance.start_time
            end_time = attrs.get("end_time") or self.instance.end_time
            if start_time and end_time and end_time <= start_time:
                raise serializers.ValidationError(
                    "La hora de fin debe ser posterior a la hora de inicio."
                )
        return attrs

    def create(self, validated_data):
        gym = validated_data.get("gym")
        if gym is None:
            request = self.context.get("request")
            gym = request.user.profile.gym
        member = validated_data["member"]
        trainer = validated_data["trainer"].user
        service = validated_data["service"]
        try:
            assignment = AssignmentService.assign_member(
                member,
                service,
                trainer,
                day=validated_data["day"],
                start_time=validated_data["start_time"],
                end_time=validated_data["end_time"],
                modality=validated_data.get("modality", "monthly"),
                package_total_sessions=validated_data.get("package_total_sessions"),
                session_price=validated_data.get("session_price"),
                sellado_amount=validated_data.get("sellado_amount"),
            )
        except AssignmentError as e:
            raise serializers.ValidationError(str(e))
        return assignment

    def update(self, instance, validated_data):
        trainer_profile = validated_data.get("trainer")
        trainer = trainer_profile.user if trainer_profile else None
        try:
            return AssignmentService.update_assignment(
                instance,
                trainer=trainer,
                day=validated_data.get("day"),
                start_time=validated_data.get("start_time"),
                end_time=validated_data.get("end_time"),
                service=validated_data.get("service"),
            )
        except AssignmentError as e:
            raise serializers.ValidationError(str(e))


class PersonalTrainingChangeRequestSerializer(serializers.ModelSerializer):
    member = serializers.SerializerMethodField()
    assignment_id = serializers.PrimaryKeyRelatedField(
        source="assignment",
        queryset=PersonalTrainingAssignment.objects.none(),
        write_only=True,
    )
    assignment_day = serializers.CharField(
        source="assignment.day", read_only=True
    )
    assignment_start_time = serializers.TimeField(
        source="assignment.start_time", read_only=True
    )
    assignment_end_time = serializers.TimeField(
        source="assignment.end_time", read_only=True
    )
    service_name = serializers.CharField(
        source="assignment.service.name", read_only=True
    )
    trainer_name = serializers.SerializerMethodField()

    class Meta:
        model = PersonalTrainingChangeRequest
        fields = [
            "id",
            "member",
            "assignment",
            "assignment_id",
            "assignment_day",
            "assignment_start_time",
            "assignment_end_time",
            "service_name",
            "trainer_name",
            "requested_day",
            "requested_start_time",
            "requested_end_time",
            "status",
            "requested_at",
            "reviewed_at",
            "reviewed_by",
            "admin_notes",
        ]
        read_only_fields = [
            "status",
            "requested_at",
            "reviewed_at",
            "reviewed_by",
            "admin_notes",
        ]
        validators = []

    def get_member(self, obj):
        return member_identity(obj.member)

    def get_trainer_name(self, obj):
        return obj.assignment.trainer_name

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        if request and hasattr(request.user, "profile") and request.user.profile.gym:
            gym = request.user.profile.gym
            fields["assignment_id"].queryset = (
                PersonalTrainingAssignment.objects.filter(
                    gym=gym, active=True
                ).select_related("member", "service", "trainer")
            )
        return fields

    def validate(self, attrs):
        requested_end = attrs.get("requested_end_time")
        requested_start = attrs.get("requested_start_time")
        if requested_start and requested_end and requested_end <= requested_start:
            raise serializers.ValidationError(
                "La hora de fin debe ser posterior a la hora de inicio."
            )
        return attrs

    def create(self, validated_data):
        assignment = validated_data["assignment"]
        from .change_request_service import ChangeRequestError
        from .change_request_service import ChangeRequestService

        try:
            return ChangeRequestService.create_request(
                assignment,
                validated_data["requested_day"],
                validated_data["requested_start_time"],
                validated_data["requested_end_time"],
            )
        except ChangeRequestError as e:
            raise serializers.ValidationError(str(e))


class PublicAssignmentSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name", read_only=True)
    trainer_name = serializers.SerializerMethodField()
    trainer_gender = serializers.SerializerMethodField()
    modality = serializers.CharField(read_only=True)
    sessions_total = serializers.SerializerMethodField()
    sessions_used = serializers.SerializerMethodField()
    exhausted = serializers.SerializerMethodField()
    sellado_amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )
    sellado_paid = serializers.BooleanField(read_only=True)
    member_address = serializers.SerializerMethodField()

    class Meta:
        model = PersonalTrainingAssignment
        fields = [
            "id",
            "service_name",
            "trainer_name",
            "trainer_gender",
            "day",
            "start_time",
            "end_time",
            "member_address",
            "modality",
            "sessions_total",
            "sessions_used",
            "exhausted",
            "session_price",
            "amount_paid",
            "sellado_amount",
            "sellado_paid",
            "created_at",
        ]

    def get_trainer_name(self, obj):
        return obj.trainer_name

    def get_trainer_gender(self, obj):
        profile = getattr(obj.trainer, "profile", None)
        return profile.gender if profile else None

    def get_member_address(self, obj):
        return obj.member.address or None

    def get_sessions_total(self, obj):
        if obj.modality != "package":
            return 0
        return obj.package_total_sessions or 0

    def get_sessions_used(self, obj):
        return obj.used_sessions

    def get_exhausted(self, obj):
        if obj.modality != "package":
            return False
        total = obj.package_total_sessions
        return total is not None and obj.used_sessions >= total


class PublicChangeRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonalTrainingChangeRequest
        fields = [
            "id",
            "assignment",
            "requested_day",
            "requested_start_time",
            "requested_end_time",
            "status",
            "requested_at",
            "reviewed_at",
            "admin_notes",
        ]
        read_only_fields = [
            "status",
            "requested_at",
            "reviewed_at",
            "admin_notes",
        ]