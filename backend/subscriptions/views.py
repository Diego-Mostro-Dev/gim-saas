from django.db import transaction
from django.db.models import OuterRef, Prefetch, Subquery, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.timezone import now

from rest_framework import status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ParseError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from core.viewsets import GymModelViewSet

from attendance.models import AttendanceSchedule, ScheduleChangeRequest, ScheduleSlot, ScheduleSwapRequest
from members.models import Member
from members.query import only_alive_members

from payments.models import Payment

from .models import Subscription, SubscriptionItem, PlanChangeRequest, PlannedSchedule
from .serializers import (
    SubscriptionSerializer,
    PlanChangeRequestSerializer,
    PlanChangeRequestActionSerializer,
    MemberOutstandingDebtSerializer,
    OutstandingSubscriptionSerializer,
)
from .domain import (
    ScheduleDomain,
    ScheduleError,
    SubscriptionConflictError,
)
from .services import (
    _open_period_with_credit,
    calculate_effective_date,
    cancel_future_plan_change,
    get_last_day_of_month,
    gym_activity_package_debt,
    gym_outstanding_subscriptions,
    gym_outing_package_debt,
    gym_personal_training_package_debt,
    gym_sellado_debt,
    member_total_outstanding_debt,
    recover_member,
)


class SubscriptionView(viewsets.ReadOnlyModelViewSet):
    lookup_value_regex = r"[0-9]+"

    # Fase 7 (P4): los créditos a favor se restan aparte (credit_realized_for),
    # así que quedan fuera del agregado de cobrado.
    _paid_amount_subquery = Subquery(
        Payment.objects.filter(
            subscription=OuterRef("pk"),
        )
        .exclude(concept="credit")
        .order_by()
        .values("subscription")
        .annotate(paid=Sum("amount"))
        .values("paid")
    )

    # El mismo filtro que credit_realized_for, pero resuelto para las N filas
    # del listado en una sola query. Sin esto el serializer caía al default
    # (credit_realized=None -> una query por suscripción) y el endpoint costaba
    # 226 queries para un gym mediano. Negado para cumplir el mismo contrato
    # que el service: Decimal positivo.
    _credit_realized_subquery = Subquery(
        Payment.objects.filter(
            subscription=OuterRef("pk"),
            concept="credit",
            applied_to__isnull=False,
        )
        .order_by()
        .values("subscription")
        .annotate(credit=-Sum("amount"))
        .values("credit")
    )

    # Equivalente bulk de member_credit_balance: el saldo abierto del socio.
    # Va por member_id y no por una caché en la instancia porque
    # select_related crea un Member distinto por fila de suscripción, así que
    # la caché por instancia nunca acierta y la consulta se repetía N veces.
    _member_open_credit_subquery = Subquery(
        Payment.objects.filter(
            member_id=OuterRef("member_id"),
            concept="credit",
            applied_to__isnull=True,
        )
        .order_by()
        .values("member")
        .annotate(credit=-Sum("amount"))
        .values("credit")
    )

    # Primer período del socio, para derivar is_first sin el exists() por
    # suscripción de get_subscription_payment_status. Sin filtro de gym a
    # propósito: es lo que hace hoy ese exists(), y el socio pertenece a un
    # solo gym igual.
    _member_first_created_subquery = Subquery(
        Subscription.objects.filter(member_id=OuterRef("member_id"))
        .order_by("created_at")
        .values("created_at")[:1]
    )

    queryset = (
        Subscription.objects.all()
        .select_related("member__insurance", "member__discount", "plan", "gym")
        .annotate(
            _paid_amount=_paid_amount_subquery,
            _credit_realized=_credit_realized_subquery,
            _member_open_credit=_member_open_credit_subquery,
            _member_first_created=_member_first_created_subquery,
        )
        .prefetch_related(
            Prefetch(
                "items",
                queryset=SubscriptionItem.objects.select_related(
                    "activity", "plan", "outing"
                ),
            ),
            Prefetch(
                "member__plan_change_requests",
                queryset=PlanChangeRequest.objects.filter(
                    status="approved",
                    effective_date__gt=timezone.localdate(),
                ).select_related("requested_plan"),
                to_attr="_pending_plan_change_requests",
            ),
        )
    )
    serializer_class = SubscriptionSerializer
    pagination_class = None

    def get_queryset(self):
        queryset = super().get_queryset()
        gym = self.request.user.profile.gym
        member_id = self.request.query_params.get("member")
        queryset = only_alive_members(queryset).filter(gym=gym)
        if member_id:
            try:
                member_id = int(member_id)
            except (TypeError, ValueError):
                raise ParseError("El parámetro member no es válido.")
            queryset = queryset.filter(member_id=member_id)
        return queryset

    @action(detail=False, methods=["post"], url_path="reopen")
    def reopen(self, request):
        gym = request.user.profile.gym

        member_id = request.data.get("member_id")
        if member_id is None:
            return Response(
                {"detail": "member_id es obligatorio."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            member_id = int(member_id)
        except (TypeError, ValueError):
            return Response(
                {"detail": "member_id debe ser un entero válido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        member = get_object_or_404(Member, id=member_id, gym=gym)

        try:
            sub, created = recover_member(member)
        except SubscriptionConflictError as exc:
            return Response(
                {"detail": str(exc)},
                status=exc.status_code,
            )

        return Response(
            SubscriptionSerializer(sub).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="member/(?P<member_id>[0-9]+)/outstanding")
    def member_outstanding(self, request, member_id):
        gym = request.user.profile.gym
        member = get_object_or_404(Member, id=member_id, gym=gym)

        debt = member_total_outstanding_debt(member)
        debt["member_id"] = member.id

        return Response(MemberOutstandingDebtSerializer(debt).data)

    @action(detail=False, methods=["get"], url_path="outstanding")
    def outstanding(self, request):
        gym = request.user.profile.gym

        rows = list(
            OutstandingSubscriptionSerializer(
                gym_outstanding_subscriptions(gym), many=True
            ).data
        )

        def _debt_row(member, plan_name, total, paid_amount, remaining):
            return {
                "subscription_id": None,
                "member_id": member.id,
                "member_name": f"{member.first_name} {member.last_name}",
                "plan_name": plan_name,
                "payment_status": "pending",
                "items": [],
                "total": str(total),
                "paid_amount": str(paid_amount),
                "remaining": str(remaining),
            }

        for pkg in gym_activity_package_debt(gym):
            rows.append(
                _debt_row(
                    pkg["member"],
                    f"{pkg['name']} · paquete de sesiones",
                    pkg["total"],
                    pkg["paid_amount"],
                    pkg["remaining"],
                )
            )

        for pkg in gym_personal_training_package_debt(gym):
            rows.append(
                _debt_row(
                    pkg["member"],
                    f"{pkg['name']} · paquete de sesiones",
                    pkg["total"],
                    pkg["paid_amount"],
                    pkg["remaining"],
                )
            )

        for pkg in gym_outing_package_debt(gym):
            rows.append(
                _debt_row(
                    pkg["member"],
                    f"{pkg['name']} · paquete de sesiones",
                    pkg["total"],
                    pkg["paid_amount"],
                    pkg["remaining"],
                )
            )

        for sellado in gym_sellado_debt(gym):
            rows.append(
                _debt_row(
                    sellado["member"],
                    f"Sellado · {sellado['name']}",
                    sellado["amount"],
                    "0.00",
                    sellado["amount"],
                )
            )

        paginator = PageNumberPagination()
        page = paginator.paginate_queryset(rows, request, view=self)
        if page is None:
            return Response(rows)
        return paginator.get_paginated_response(page)


class PlanChangeRequestViewSet(GymModelViewSet):
    queryset = PlanChangeRequest.objects.all()
    serializer_class = PlanChangeRequestSerializer
    pagination_class = None

    def get_serializer_class(self):
        if self.action in ("approve", "reject", "cancel"):
            return PlanChangeRequestActionSerializer
        return PlanChangeRequestSerializer

    def get_queryset(self):
        return only_alive_members(
            super().get_queryset()
        ).select_related(
            "member__insurance", "member", "requested_plan", "reviewed_by",
        ).prefetch_related("planned_schedules").annotate(
            _fallback_plan_name=Subquery(
                Subscription.objects.filter(
                    member=OuterRef("member"),
                ).order_by("-created_at").values("plan__name")[:1]
            ),
        )

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return self._handle_action(request, pk, "approved")

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        return self._handle_action(request, pk, "rejected")

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        return self._handle_action(request, pk, "cancelled_by_staff")

    def _handle_action(self, request, pk, new_status):
        instance = self.get_object()

        allowed = instance.status == "pending"
        if new_status == "cancelled_by_staff" and instance.status == "approved" and (
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

        # Se lee y se valida antes de transar: ejecutar el cambio abre la nueva
        # suscripción y reescribe los horarios, así que el límite de visitas del
        # plan pedido tiene que frenarlo antes de que haya nada que deshacer.
        effective_date = calculate_effective_date(instance.member)
        if new_status == "approved":
            try:
                ScheduleDomain.enforce_weekly_visits(
                    member=instance.member,
                    target_count=len(instance.target_schedules_snapshot or []),
                    limit=instance.requested_plan.weekly_visits,
                )
            except ScheduleError as e:
                return Response(
                    {"detail": str(e)},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        with transaction.atomic():
            if new_status == "approved":
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
                    current_sub = Subscription.objects.filter(
                        member=instance.member
                    ).order_by("-created_at").first()
                    # Fase F (DIN-04): mismo helper que la renovación para que
                    # el cambio inmediato consuma el saldo a favor. PT lo cubre
                    # ``ensure_pt_items_for_active_assignments`` dentro de
                    # ``open_subscription``, así que no se copia acá.
                    _open_period_with_credit(
                        member=instance.member,
                        plan=instance.requested_plan,
                        start_date=month_start,
                        end_date=month_end,
                        auto_renew=current_sub.auto_renew if current_sub else True,
                        origin="plan_change",
                        source_sub=current_sub,
                        copy_personal_training=False,
                    )

                    self._synchronize_schedules(instance)
            elif new_status == "cancelled_by_staff" and instance.status == "approved":
                cancel_future_plan_change(instance, cancel_status="cancelled_by_staff")
                instance.refresh_from_db()
            else:
                serializer.save(
                    reviewed_by=request.user,
                    reviewed_at=now_value,
                )

            # ACC-16: sólo el cambio de plan **aprobado** deja obsoletos
            # los pedidos de horario e intercambio del socio. Al rechazar o
            # cancelar el cambio de plan, los pedidos siguen siendo válidos
            # y se cancelaban sin motivo (y con una nota en inglés).
            if new_status == "approved":
                self._cancel_pending_schedule_requests(
                    instance.member, instance.gym
                )

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
        """Cancela los pedidos de horario/intercambio del socio.

        La nota es lo único que el socio ve en el portal, así que va en
        español y explica por qué se canceló (ACC-16).
        """
        note = "Se canceló porque se aprobó tu cambio de plan."

        ScheduleChangeRequest.objects.filter(
            member=member, gym=gym, status="pending"
        ).update(status="cancelled_by_staff", reviewed_at=now(), admin_notes=note)

        ScheduleSwapRequest.objects.filter(
            member=member, gym=gym, status="pending"
        ).update(status="cancelled", reviewed_at=now(), admin_notes=note)