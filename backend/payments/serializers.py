from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from rest_framework import serializers

from gyms.labels import msg
from plans.services import public_plan_name

from members.identity import MemberIdentityMixin
from subscriptions.models import Subscription
from subscriptions.services import (
    calculate_subscription_total,
    sync_subscription_paid,
)

from .models import Payment
from .services import (
    assignment_sessions_paid,
    enrollment_sessions_paid,
    outing_sessions_paid,
    sellado_paid_exists,
    set_sellado_paid,
    sync_assignment_paid,
    sync_enrollment_paid,
    sync_outing_paid,
)


class PaymentSerializer(MemberIdentityMixin, serializers.ModelSerializer):
    member_identity = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = "__all__"
        read_only_fields = ["gym"]

    def validate_member(self, member):
        if member is None:
            return member

        gym = self.context["request"].user.profile.gym

        if member.gym_id != gym.id:
            raise serializers.ValidationError(
                msg(gym, "errors.member_not_in_gym")
            )

        return member

    def validate_subscription(self, subscription):
        if subscription is None:
            return subscription

        gym = self.context["request"].user.profile.gym

        if subscription.gym_id != gym.id:
            raise serializers.ValidationError(
                msg(gym, "errors.subscription_not_in_gym")
            )

        return subscription

    def validate_enrollment(self, enrollment):
        if enrollment is None:
            return enrollment

        gym = self.context["request"].user.profile.gym

        if enrollment.gym_id != gym.id:
            raise serializers.ValidationError(
                msg(gym, "errors.enrollment_not_in_gym")
            )

        return enrollment

    def validate_personal_training_assignment(self, assignment):
        if assignment is None:
            return assignment

        gym = self.context["request"].user.profile.gym

        if assignment.gym_id != gym.id:
            raise serializers.ValidationError(
                msg(gym, "errors.pt_assignment_not_in_gym")
            )

        return assignment

    def validate_outing_enrollment(self, enrollment):
        if enrollment is None:
            return enrollment

        gym = self.context["request"].user.profile.gym

        if enrollment.gym_id != gym.id:
            raise serializers.ValidationError(
                msg(gym, "errors.outing_enrollment_not_in_gym")
            )

        return enrollment

    def _paid_total_excluding(self, subscription, exclude_pk=None):
        return (
            Payment.objects.filter(subscription=subscription)
            .exclude(pk=exclude_pk)
            .aggregate(paid=Sum("amount"))["paid"]
            or Decimal("0")
        )

    def _validate_amount(self, subscription, amount):
        if amount <= 0:
            raise serializers.ValidationError(
                {"amount": "El monto debe ser mayor a 0."}
            )

        remaining = (
            calculate_subscription_total(subscription)
            - self._paid_total_excluding(
                subscription, getattr(self.instance, "pk", None)
            )
        )

        if amount > remaining:
            raise serializers.ValidationError(
                {
                    "amount": (
                        f"El monto no puede superar el saldo pendiente de "
                        f"${remaining:,.2f}."
                    )
                }
            )

    def _validate_package_amount(self, target, amount, paid_total):
        if amount <= 0:
            raise serializers.ValidationError(
                {"amount": "El monto debe ser mayor a 0."}
            )

        if target.total_amount is None:
            raise serializers.ValidationError(
                {"amount": "Este paquete no tiene un total definido para cobrar."}
            )

        remaining = target.total_amount - paid_total
        if remaining <= 0:
            raise serializers.ValidationError(
                {"amount": "Este paquete ya está saldado."}
            )

        if amount > remaining:
            raise serializers.ValidationError(
                {
                    "amount": (
                        f"El monto no puede superar el saldo pendiente de "
                        f"${remaining:,.2f}."
                    )
                }
            )

    def _is_own_sellado(self, target):
        """True when the payment being edited is the sellado of this target."""
        instance = self.instance
        if instance is None or instance.concept != "sellado":
            return False

        from activities.models import Enrollment
        from personal_training.models import PersonalTrainingAssignment

        if isinstance(target, Enrollment):
            return instance.enrollment_id == target.pk
        if isinstance(target, PersonalTrainingAssignment):
            return instance.personal_training_assignment_id == target.pk
        return False

    def _validate_sellado(self, target, amount):
        if target.sellado_amount is None:
            raise serializers.ValidationError(
                {"amount": "Este paquete no tiene sellado configurado."}
            )

        if Decimal(str(amount)) != target.sellado_amount:
            raise serializers.ValidationError(
                {"amount": f"El sellado es por ${target.sellado_amount}."}
            )

        if target.sellado_paid and not self._is_own_sellado(target):
            raise serializers.ValidationError(
                {"amount": "El sellado ya fue cobrado para este paquete."}
            )

    def validate(self, attrs):
        attrs = super().validate(attrs)

        # The payment's member must match the charged target's member so the
        # snapshot and the member FK are always consistent.
        member = attrs.get("member", getattr(self.instance, "member", None))
        subscription = attrs.get(
            "subscription",
            getattr(self.instance, "subscription", None),
        )
        enrollment = attrs.get(
            "enrollment",
            getattr(self.instance, "enrollment", None),
        )
        assignment = attrs.get(
            "personal_training_assignment",
            getattr(self.instance, "personal_training_assignment", None),
        )
        outing_enrollment = attrs.get(
            "outing_enrollment",
            getattr(self.instance, "outing_enrollment", None),
        )
        concept = attrs.get(
            "concept",
            getattr(self.instance, "concept", None),
        )

        # A payment always charges exactly one thing.
        if sum(
            1
            for t in (
                subscription,
                enrollment,
                assignment,
                outing_enrollment,
            )
            if t is not None
        ) != 1:
            raise serializers.ValidationError(
                "Un pago debe estar asociado a una suscripción, una "
                "inscripción, una asignación de entrenamiento personal o "
                "una inscripción a salida."
            )

        # The concept must match the charged target.
        if concept == "subscription" and subscription is None:
            raise serializers.ValidationError(
                "El concepto Suscripción requiere una suscripción."
            )
        if concept == "coseguro" and enrollment is None:
            raise serializers.ValidationError(
                "El concepto Coseguro por sesiones requiere una inscripción."
            )
        if concept == "personal_training" and assignment is None:
            raise serializers.ValidationError(
                "El concepto Entrenamiento personal requiere una asignación."
            )
        if concept == "outing" and outing_enrollment is None:
            raise serializers.ValidationError(
                "El concepto Salida por sesiones requiere una inscripción a salida."
            )
        if concept == "sellado" and enrollment is None and assignment is None:
            raise serializers.ValidationError(
                "El concepto Sellado requiere una inscripción o una asignación."
            )

        if (
            member is not None
            and subscription is not None
            and member.pk != subscription.member.pk
        ):
            raise serializers.ValidationError(
                {
                    "member": "El miembro no coincide con el socio de la suscripción."
                }
            )

        if (
            member is not None
            and enrollment is not None
            and member.pk != enrollment.member.pk
        ):
            raise serializers.ValidationError(
                {
                    "member": "El miembro no coincide con la inscripción."
                }
            )

        if (
            member is not None
            and assignment is not None
            and member.pk != assignment.member.pk
        ):
            raise serializers.ValidationError(
                {
                    "member": "El miembro no coincide con el socio de la asignación."
                }
            )

        if (
            member is not None
            and outing_enrollment is not None
            and member.pk != outing_enrollment.member.pk
        ):
            raise serializers.ValidationError(
                {
                    "member": "El miembro no coincide con la inscripción a salida."
                }
            )

        # Courtesy-pass members are never charged for sessions or sellado.
        target = enrollment or assignment or outing_enrollment
        if target is not None and target.member.is_comp:
            raise serializers.ValidationError(
                "Socio con pase de cortesía: no se le cobra por sesiones ni sellado."
            )

        # Only validate the amount when this request actually sets it
        # (always on create and on the form's full PUT updates).
        if "amount" not in attrs:
            return attrs

        amount = attrs["amount"]

        if subscription is not None:
            self._validate_amount(subscription, amount)
        elif enrollment is not None:
            if concept == "coseguro":
                paid_total = enrollment_sessions_paid(
                    enrollment,
                    getattr(self.instance, "pk", None),
                )
                self._validate_package_amount(enrollment, amount, paid_total)
            elif concept == "sellado":
                self._validate_sellado(enrollment, amount)
        elif assignment is not None:
            if concept == "personal_training":
                paid_total = assignment_sessions_paid(
                    assignment,
                    getattr(self.instance, "pk", None),
                )
                self._validate_package_amount(assignment, amount, paid_total)
            elif concept == "sellado":
                self._validate_sellado(assignment, amount)
        elif outing_enrollment is not None:
            if concept == "outing":
                paid_total = outing_sessions_paid(
                    outing_enrollment,
                    getattr(self.instance, "pk", None),
                )
                self._validate_package_amount(
                    outing_enrollment,
                    amount,
                    paid_total,
                )

        return attrs

    def _apply_subscription_snapshot(self, validated_data, subscription):
        validated_data["member_name"] = (
            f"{subscription.member.first_name} "
            f"{subscription.member.last_name}"
        )
        validated_data["plan_name"] = (
            public_plan_name(subscription.plan)
        )
        validated_data["subscription_end_date"] = (
            subscription.end_date
        )
        validated_data["member"] = subscription.member
        return validated_data

    def _apply_snapshots(
        self,
        validated_data,
        subscription,
        enrollment,
        assignment,
        outing_enrollment,
        concept,
    ):
        if subscription is not None:
            return self._apply_subscription_snapshot(
                validated_data,
                subscription,
            )

        if enrollment is not None:
            validated_data["member"] = enrollment.member
            validated_data["member_name"] = (
                f"{enrollment.member.first_name} "
                f"{enrollment.member.last_name}"
            )
            suffix = "Sellado" if concept == "sellado" else "Sesiones"
            validated_data["plan_name"] = (
                f"{enrollment.schedule.activity.name} · {suffix}"
            )
        elif outing_enrollment is not None:
            validated_data["member"] = outing_enrollment.member
            validated_data["member_name"] = (
                f"{outing_enrollment.member.first_name} "
                f"{outing_enrollment.member.last_name}"
            )
            validated_data["plan_name"] = (
                f"{outing_enrollment.schedule.outing.name} · Sesiones"
            )
        elif assignment is not None:
            validated_data["member"] = assignment.member
            validated_data["member_name"] = (
                f"{assignment.member.first_name} "
                f"{assignment.member.last_name}"
            )
            suffix = "Sellado" if concept == "sellado" else "Sesiones"
            validated_data["plan_name"] = (
                f"{assignment.service.name} · {suffix}"
            )

        return validated_data

    def _lock_and_validate(
        self,
        validated_data,
        subscription,
        enrollment,
        assignment,
        outing_enrollment,
        concept,
    ):
        if subscription is not None:
            locked = Subscription.objects.select_for_update().get(
                pk=subscription.pk
            )
            if "amount" in validated_data:
                self._validate_amount(locked, validated_data["amount"])
            return

        if enrollment is not None:
            from activities.models import Enrollment

            locked = Enrollment.objects.select_for_update().get(pk=enrollment.pk)
            amount = validated_data.get("amount")
            if amount is not None:
                if concept == "coseguro":
                    paid_total = enrollment_sessions_paid(
                        locked,
                        getattr(self.instance, "pk", None),
                    )
                    self._validate_package_amount(locked, amount, paid_total)
                elif concept == "sellado":
                    self._validate_sellado(locked, amount)
            return

        if outing_enrollment is not None:
            from outings.models import OutingEnrollment

            locked = OutingEnrollment.objects.select_for_update().get(
                pk=outing_enrollment.pk
            )
            amount = validated_data.get("amount")
            if amount is not None and concept == "outing":
                paid_total = outing_sessions_paid(
                    locked,
                    getattr(self.instance, "pk", None),
                )
                self._validate_package_amount(locked, amount, paid_total)
            return

        if assignment is not None:
            from personal_training.models import PersonalTrainingAssignment

            locked = PersonalTrainingAssignment.objects.select_for_update().get(
                pk=assignment.pk
            )
            amount = validated_data.get("amount")
            if amount is not None:
                if concept == "personal_training":
                    paid_total = assignment_sessions_paid(
                        locked,
                        getattr(self.instance, "pk", None),
                    )
                    self._validate_package_amount(locked, amount, paid_total)
                elif concept == "sellado":
                    self._validate_sellado(locked, amount)

    def _reconcile_after_write(
        self,
        payment,
        *,
        old_sub_id=None,
        old_enr_id=None,
        old_asg_id=None,
        old_outing_enr_id=None,
        old_concept=None,
    ):
        """Bring subscription/enrollment/assignment/outing totals and the
        sellado flag back in sync with the stored Payment rows."""
        from activities.models import Enrollment
        from outings.models import OutingEnrollment
        from personal_training.models import PersonalTrainingAssignment

        new_concept = payment.concept
        new_sub_id = payment.subscription_id
        new_enr_id = payment.enrollment_id
        new_asg_id = payment.personal_training_assignment_id
        new_outing_enr_id = payment.outing_enrollment_id

        for sid in {old_sub_id, new_sub_id}:
            if sid:
                sync_subscription_paid(
                    Subscription.objects.select_for_update().get(pk=sid)
                )

        for enrollment_id in {old_enr_id, new_enr_id}:
            if enrollment_id:
                sync_enrollment_paid(Enrollment.objects.get(pk=enrollment_id))

        for assignment_id in {old_asg_id, new_asg_id}:
            if assignment_id:
                sync_assignment_paid(
                    PersonalTrainingAssignment.objects.get(pk=assignment_id)
                )

        for outing_enrollment_id in {old_outing_enr_id, new_outing_enr_id}:
            if outing_enrollment_id:
                sync_outing_paid(
                    OutingEnrollment.objects.get(pk=outing_enrollment_id)
                )

        # A sellado payment marks its target as paid.
        if new_concept == "sellado":
            if new_enr_id:
                set_sellado_paid(
                    Enrollment.objects.get(pk=new_enr_id),
                    True,
                )
            elif new_asg_id:
                set_sellado_paid(
                    PersonalTrainingAssignment.objects.get(pk=new_asg_id),
                    True,
                )

        # A sellado payment moved away or retyped must recompute the OLD
        # target's flag. That includes an in-place retype on the same target
        # (otherwise the flag would stay stuck on paid). Recomputed only while
        # the flag currently reads paid, to preserve the renewal reset.
        if old_concept == "sellado" and (
            new_concept != "sellado"
            or new_enr_id != old_enr_id
            or new_asg_id != old_asg_id
        ):
            if old_enr_id and (
                old_enr_id != new_enr_id or new_concept != "sellado"
            ):
                old_enr = Enrollment.objects.get(pk=old_enr_id)
                if old_enr.sellado_paid:
                    set_sellado_paid(
                        old_enr,
                        sellado_paid_exists(enrollment=old_enr),
                    )
            if old_asg_id and (
                old_asg_id != new_asg_id or new_concept != "sellado"
            ):
                old_asg = PersonalTrainingAssignment.objects.get(pk=old_asg_id)
                if old_asg.sellado_paid:
                    set_sellado_paid(
                        old_asg,
                        sellado_paid_exists(assignment=old_asg),
                    )

    def create(self, validated_data):
        subscription = validated_data.get("subscription")
        enrollment = validated_data.get("enrollment")
        assignment = validated_data.get("personal_training_assignment")
        outing_enrollment = validated_data.get("outing_enrollment")
        concept = validated_data.get("concept", "subscription")

        validated_data = self._apply_snapshots(
            validated_data,
            subscription,
            enrollment,
            assignment,
            outing_enrollment,
            concept,
        )

        with transaction.atomic():
            self._lock_and_validate(
                validated_data,
                subscription,
                enrollment,
                assignment,
                outing_enrollment,
                concept,
            )
            payment = super().create(validated_data)
            self._reconcile_after_write(payment)

        return payment

    def update(self, instance, validated_data):
        old_sub_id = instance.subscription_id
        old_enr_id = instance.enrollment_id
        old_asg_id = instance.personal_training_assignment_id
        old_outing_enr_id = instance.outing_enrollment_id
        old_concept = instance.concept

        subscription = validated_data.get("subscription", instance.subscription)
        enrollment = validated_data.get("enrollment", instance.enrollment)
        assignment = validated_data.get(
            "personal_training_assignment",
            instance.personal_training_assignment,
        )
        outing_enrollment = validated_data.get(
            "outing_enrollment",
            instance.outing_enrollment,
        )
        concept = validated_data.get("concept", instance.concept)

        validated_data = self._apply_snapshots(
            validated_data,
            subscription,
            enrollment,
            assignment,
            outing_enrollment,
            concept,
        )

        with transaction.atomic():
            self._lock_and_validate(
                validated_data,
                subscription,
                enrollment,
                assignment,
                outing_enrollment,
                concept,
            )
            payment = super().update(instance, validated_data)
            self._reconcile_after_write(
                payment,
                old_sub_id=old_sub_id,
                old_enr_id=old_enr_id,
                old_asg_id=old_asg_id,
                old_outing_enr_id=old_outing_enr_id,
                old_concept=old_concept,
            )

        return payment