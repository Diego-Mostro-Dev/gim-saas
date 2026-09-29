"""Auditoría read-only de los bugs de dinero conocidos.

Sólo imprime contadores y member_ids. No escribe nada: toda la ejecución
transcurre dentro de un único transaction.atomic() que nunca se commitea y
termina en rollback explícito.

Las secciones #1, #2, #4/#6, #5, #19 y #48 replican la semántica de
subscriptions/services.py para poder dimensionar el daño en producción sin
disparar la tarea de renovación.

La sección #1 calcula el daño dos veces: con la semántica member-level actual
—la que genera el bug— y con la semántica period-level que implementó el fix,
para que una sola corrida muestre el antes y el después.

Las secciones F7/P1 a F7/P5 son los contadores de la Fase 7.0: los bugs que
ninguno de los contadores anteriores puede ver (nacieron de revisión de código,
no de datos). Cada uno reporta **dos** números, ``confirmados`` y ``armados``,
porque un ``0`` solo no distingue entre "el bug no existe" y "nunca se probó" —
ver PLAN-dinero.md sección 1.9.

Esta auditoría es una proyección read-only: replica la semántica de períodos,
pero NO modela los guards del renovador (pago, plan base, miembro activo,
gym activo). La verificación del código real es el arnés
``audit_renewal_dryrun`` (Fase 1), que ejecuta ``auto_renew_subscriptions``
dentro de un rollback.
"""

import os
from collections import defaultdict
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.db.models import Sum
from django.db.utils import OperationalError
from django.utils import timezone

from members.models import Member
from subscriptions.domain import SubscriptionDomain
from subscriptions.models import PlanChangeRequest, Subscription, SubscriptionItem
from subscriptions.services import (
    calculate_subscription_total,
    get_first_day_of_next_month,
    get_last_day_of_month,
    member_discount_percent,
    member_total_outstanding_debt,
    subscription_original_total,
)

WRITE_PREFIXES = (
    "INSERT",
    "UPDATE",
    "DELETE",
    "TRUNCATE",
    "ALTER",
    "DROP",
    "CREATE",
    "GRANT",
    "REVOKE",
)

MAX_IDS_SHOWN = 20


def _is_write(sql):
    stripped = sql.lstrip().upper()
    return stripped.startswith(WRITE_PREFIXES)


def _collect_candidates(today):
    """Classify renewal candidates under the current and the fixed semantics.

    Current (buggy) semantics, as shipped before Fase 3: a member is skipped
    if *any* of its expired subscriptions already has a successor. One
    successor for July masks a missing August. This audit still projects it
    to quantify the damage that the fix repairs.

    Fixed semantics (Fase 3, the real auto-renew code): a candidate is
    skipped only when a successor overlaps *its own* target period.

    Both are computed here so a single run shows the damage measured with the
    bug and the damage that would remain after the fix. It is a period
    projection only — it does not model the renewal guards (payment status,
    base plan, member/gym activity); the authoritative verification of the
    real code is the arnés ``audit_renewal_dryrun`` (Fase 1).
    """
    candidates = list(
        Subscription.objects.filter(end_date__lt=today, auto_renew=True).values(
            "id", "member_id", "end_date", "gym__active"
        )
    )

    member_ids = {c["member_id"] for c in candidates}
    windows = defaultdict(list)
    for row in Subscription.objects.filter(member_id__in=member_ids).values(
        "member_id", "start_date", "end_date"
    ):
        windows[row["member_id"]].append((row["start_date"], row["end_date"]))

    # A candidate whose target period starts in the current month is a live
    # loss; an earlier one is inert history that will never be charged.
    month_start = today.replace(day=1)

    for c in candidates:
        target_start = get_first_day_of_next_month(c["end_date"])
        c["target_start"] = target_start
        c["target_end"] = get_last_day_of_month(target_start)
        c["covered"] = any(
            start <= c["target_end"] and end >= c["target_start"]
            for start, end in windows[c["member_id"]]
        )

    # ── Current semantics: member-level skip ──────────────────────
    members_with_successor = {c["member_id"] for c in candidates if c["covered"]}
    wrongly_skipped = [
        c
        for c in candidates
        if c["member_id"] in members_with_successor and not c["covered"]
    ]
    will_renew_current = [
        c for c in candidates if c["member_id"] not in members_with_successor
    ]
    live_loss = [c for c in wrongly_skipped if c["target_start"] >= month_start]
    stale_backlog = [c for c in wrongly_skipped if c["target_start"] < month_start]

    # ── Fixed semantics: period-level skip ────────────────────────
    covered = [c for c in candidates if c["covered"]]
    uncovered = [c for c in candidates if not c["covered"]]

    # An uncovered candidate whose target period already started would create
    # a subscription for a month that is already over. That is inert backlog,
    # not a live renewal, so the fix has to skip it instead of back-filling.
    def is_live(candidate):
        return candidate["target_start"] >= month_start

    uncovered_live = [c for c in uncovered if is_live(c)]
    uncovered_stale = [c for c in uncovered if not is_live(c)]
    renew_active_gym = [c for c in uncovered_live if c["gym__active"]]
    renew_inactive_gym = [c for c in uncovered_live if not c["gym__active"]]
    stale_active_gym = [c for c in uncovered_stale if c["gym__active"]]
    stale_inactive_gym = [c for c in uncovered_stale if not c["gym__active"]]

    return {
        "total": len(candidates),
        "covered": covered,
        "current_will_renew": will_renew_current,
        "wrongly_skipped": wrongly_skipped,
        "live_loss": live_loss,
        "stale_backlog": stale_backlog,
        "uncovered": uncovered,
        "uncovered_live": uncovered_live,
        "uncovered_stale": uncovered_stale,
        "renew_active_gym": renew_active_gym,
        "renew_inactive_gym": renew_inactive_gym,
        "stale_active_gym": stale_active_gym,
        "stale_inactive_gym": stale_inactive_gym,
        "inactive_gym_total": [c for c in candidates if not c["gym__active"]],
    }


def _scan_members():
    members = list(Member.objects.filter(active=True).select_related("discount"))

    pt_without_item = []
    trapped = []
    comp_with_total = []

    for member in members:
        subscription = SubscriptionDomain.get_current_subscription(member)

        if subscription is None:
            if member_total_outstanding_debt(member)["total"] > 0:
                trapped.append(member.id)
            continue

        if member.personal_training_assignments.filter(active=True).exists():
            if not subscription.items.filter(
                item_type="personal_training", status="active"
            ).exists():
                pt_without_item.append(member.id)

        if member.is_comp and calculate_subscription_total(subscription) > 0:
            comp_with_total.append(member.id)

    return {
        "active": len(members),
        "pt_without_item": pt_without_item,
        "trapped": trapped,
        "comp_with_total": comp_with_total,
    }


def _comp_closed_period_items(today):
    """Paid items left in already-closed periods of courtesy members.

    Not live debt: subscription_remaining_balance zeroes the balance of an
    is_comp member, and the current period is reported separately. These are
    price_snapshot values that leaked into courtesy subscriptions of past
    months. Reported for review, never repaired automatically.
    """
    return list(
        SubscriptionItem.objects.filter(
            subscription__member__is_comp=True,
            subscription__end_date__lt=today,
            status="active",
            price_snapshot__gt=0,
        )
        .values(
            "subscription__member_id",
            "subscription_id",
            "subscription__start_date",
            "subscription__end_date",
            "item_type",
            "price_snapshot",
        )
        .order_by("subscription__member_id", "subscription__end_date")
    )


def _stuck_plan_changes(today):
    return list(
        PlanChangeRequest.objects.filter(
            status="approved", effective_date__lte=today
        ).values("id", "member_id")
    )


# ── Fase 7.0: contadores de los bugs que nacieron de revisión de código ──
#
# Ninguno de estos cuatro es visible para los contadores de arriba: el #48 sólo
# mira el mes en curso y en un solo sentido (cortesía con total > 0, nunca
# "pago de menos"), y ninguno mira la modalidad de la asignación de PT ni el
# saldo a favor. Por eso se miden con su propio par confirmado/armado: un 0 sin
# el número de armados no distingue entre "el bug no existe" y "nunca se
# ejercitó" (PLAN-dinero.md, sección 1.9).


def _pt_package_bill():
    """F7/P1 — cuota mensual de PT facturada encima de un paquete de sesiones.

    El ítem de PT llega por dos caminos de escritura que ninguno mira la
    modalidad de la asignación: ``ensure_pt_items_for_active_assignments``
    (``services.py:197``) y ``_copy_personal_training_items``
    (``services.py:88``, llamado desde 4 sitios). El ítem es la evidencia común
    a los dos, así que el contador cuenta ítems, no asignaciones.
    """
    from personal_training.models import (
        PersonalTrainingAssignment,
        PersonalTrainingService,
    )

    package_services = defaultdict(set)
    for row in PersonalTrainingAssignment.objects.filter(
        active=True, modality="package"
    ).values("member_id", "service_id"):
        package_services[row["member_id"]].add(row["service_id"])

    items = list(
        SubscriptionItem.objects.filter(
            item_type="personal_training",
            status="active",
            personal_training__isnull=False,
        ).values(
            "subscription__member_id",
            "subscription_id",
            "personal_training_id",
            "price_snapshot",
        )
    )

    confirmed = [
        row
        for row in items
        if row["personal_training_id"]
        in package_services.get(row["subscription__member_id"], ())
    ]

    armed = list(
        PersonalTrainingService.objects.filter(
            billing_mode="sessions", active=True, monthly_price__gt=0
        ).values("id", "gym_id", "name", "monthly_price")
    )

    return {
        "confirmed": confirmed,
        "armed": armed,
        "armed_monthly_total": sum(
            (row["monthly_price"] for row in armed), Decimal("0")
        ),
    }


def _comp_items_by_scope(today):
    """F7/P2-P3 — ítems con precio en la suscripción de un socio cortesía.

    Sale partido por período porque los históricos están **fuera de alcance por
    decisión explícita** (sólo se reportan): exigir ``= 0`` global sería
    inalcanzable por decisión, no por descuido. El gate de la 7.1 es
    ``vigente = 0`` y ``cerrados`` que no crezca.
    """
    rows = list(
        SubscriptionItem.objects.filter(
            subscription__member__is_comp=True,
            status="active",
            price_snapshot__gt=0,
        ).values(
            "subscription__member_id",
            "subscription_id",
            "subscription__start_date",
            "subscription__end_date",
            "item_type",
            "price_snapshot",
        )
    )

    def covers_today(row):
        return (
            row["subscription__start_date"] <= today <= row["subscription__end_date"]
        )

    comp_members = [
        m["id"] for m in Member.objects.filter(is_comp=True, active=True).values("id")
    ]
    with_subscription = set(
        Subscription.objects.filter(
            member_id__in=comp_members,
            start_date__lte=today,
            end_date__gte=today,
        ).values_list("member_id", flat=True)
    )

    return {
        "current": [row for row in rows if covers_today(row)],
        "closed": [row for row in rows if not covers_today(row)],
        "current_total": sum(
            (row["price_snapshot"] for row in rows if covers_today(row)),
            Decimal("0"),
        ),
        "comp_members": len(comp_members),
        "armed": [m for m in comp_members if m not in with_subscription],
    }


def _settlement_snapshot():
    """F7/P4 y F7/P5 — liquidación de toda suscripción que tenga algún pago.

    Un agregado sobre pagos y un ``prefetch_related("items")``, así toda la
    comparación pasa por Python y no hay N+1.

    ``frozen`` es el total de contrato sin descuento (a lo que el socio se
    pactó); ``live`` es lo que devuelve ``calculate_subscription_total`` hoy, que
    lee ``Discount.active``/``discount_percent`` en el momento. Divergen apenas
    el socio tiene descuento, y ``paid`` es lo que realmente entró a caja.
    """
    from payments.models import Payment

    paid_by_sub = {
        row["subscription_id"]: row["paid"]
        for row in Payment.objects.filter(subscription__isnull=False)
        .values("subscription_id")
        .annotate(paid=Sum("amount"))
    }

    # El saldo a favor (Fase 7.3) se crea con importe negativo y con la
    # suscripción que lo consumió en ``subscription``; ``applied_to`` guarda el
    # origen. Mientras esa columna no exista, este grupo siempre da 0: el
    # contador simplemente no encuentra nada que cubrir, que es lo honesto.
    credit_by_sub = defaultdict(lambda: Decimal("0"))
    for row in (
        Payment.objects.filter(concept="credit", subscription__isnull=False)
        .values("subscription")
        .annotate(amount=Sum("amount"))
    ):
        credit_by_sub[row["subscription"]] += abs(row["amount"])

    rows = []
    for sub in Subscription.objects.filter(pk__in=paid_by_sub).select_related(
        "member", "member__discount", "plan"
    ).prefetch_related("items"):
        member = sub.member
        live = calculate_subscription_total(sub)
        paid = paid_by_sub[sub.pk]
        rows.append(
            {
                "subscription_id": sub.pk,
                "member_id": sub.member_id,
                "is_comp": member.is_comp,
                "has_discount": getattr(member, "discount", None) is not None,
                "discount_percent": member_discount_percent(member),
                "frozen": subscription_original_total(sub),
                "live": live,
                "paid": paid,
                "overpayment": paid - live,
                "underpaid": live - paid,
                "credit": credit_by_sub.get(sub.pk, Decimal("0")),
                "start_date": sub.start_date,
                "end_date": sub.end_date,
            }
        )

    return rows


def _uncredited_overpayments(snapshot):
    """F7/P4 — sobrepago sin saldo a favor que lo cubra.

    ``is_comp`` se excluye a propósito: ``subscription_remaining_balance`` fuerza
    ``paid_amount = total`` para los cortesía (``services.py:363-372``), así que
    un cortesía con un pago real jamás aparecería como sobrepago. Contarlos
    daría un ``0`` limpio sobre una pérdida real.
    """
    confirmed = [
        row
        for row in snapshot
        if not row["is_comp"]
        and row["overpayment"] > 0
        and row["credit"] < row["overpayment"]
    ]
    armed = [
        row
        for row in snapshot
        if not row["is_comp"]
        and row["overpayment"] <= 0
        and row["live"] > 0
        and row["paid"] >= row["live"]
    ]
    return {
        "confirmed": confirmed,
        "confirmed_total": sum(
            (row["overpayment"] for row in confirmed), Decimal("0")
        ),
        "armed": armed,
        "armed_total": sum((row["live"] for row in armed), Decimal("0")),
        "scanned": len(snapshot),
    }


def _unfrozen_discount_periods(snapshot, today):
    """F7/P5 — período ya facturado cuyo total sigue vivo con un campo editable.

    ``calculate_subscription_total`` lee ``member.discount`` en el momento
    (``services.py:261``), así que un período ya pagado se puede repreziar
    después. Las dos direcciones cuestan plata distinta y van separadas:

    - ``paid > live``: el total bajó después del cobro. El excedente no tiene a
      dónde ir (es P4) y el gym lo pierde.
    - ``paid < live``: el total subió después del cobro. El período pasa a
      ``overdue`` y después a ``blocked``: el socio pierde el acceso de un mes
      que ya pagó.
    """
    confirmed = [
        row
        for row in snapshot
        if row["has_discount"] and row["paid"] != row["live"]
    ]
    resurrected = [row for row in confirmed if row["underpaid"] > 0]
    overpaid = [row for row in confirmed if row["overpayment"] > 0]

    active_discount_members = list(
        Member.objects.filter(
            discount__isnull=False,
            discount__active=True,
            discount__discount_percent__gt=0,
        ).values("id")
    )
    with_open_subscription = set(
        Subscription.objects.filter(
            member_id__in=[m["id"] for m in active_discount_members],
            start_date__lte=today,
            end_date__gte=today,
        ).values_list("member_id", flat=True)
    )
    armed = [
        m["id"] for m in active_discount_members if m["id"] in with_open_subscription
    ]

    return {
        "confirmed": confirmed,
        "resurrected": resurrected,
        "resurrected_total": sum(
            (row["underpaid"] for row in resurrected), Decimal("0")
        ),
        "overpaid": overpaid,
        "overpaid_total": sum(
            (row["overpayment"] for row in overpaid), Decimal("0")
        ),
        "armed": armed,
        "with_discount": len(
            [row for row in snapshot if row["has_discount"]]
        ),
        "totals_differ": len(
            [row for row in snapshot if row["has_discount"] and row["live"] != row["frozen"]]
        ),
    }


class Command(BaseCommand):
    help = "Auditoría read-only de los bugs de dinero conocidos. No escribe nada."

    def add_arguments(self, parser):
        parser.add_argument(
            "--max-ids",
            type=int,
            default=MAX_IDS_SHOWN,
            help="Cuántos member_ids listar por sección.",
        )

    def handle(self, *args, **options):
        engine = connection.settings_dict["ENGINE"]
        if "sqlite" in engine:
            self.stderr.write("ABORTA: la base conectada no es PostgreSQL/Neon.")
            return

        try:
            connection.ensure_connection()
        except OperationalError as exc:
            host = connection.settings_dict.get("HOST")
            self.stderr.write("=" * 68)
            self.stderr.write("NO SE PUDO CONECTAR A LA BASE")
            self.stderr.write(f"  host intentado : {host}")
            self.stderr.write(f"  usuario        : {connection.settings_dict.get('USER')}")
            self.stderr.write(f"  detalle        : {exc.__class__.__name__}")
            for line in str(exc).splitlines():
                if line.strip():
                    self.stderr.write(f"  postgres       : {line.strip()}")
            self.stderr.write("")
            self.stderr.write("Revisá NEON_AUDIT_PASSWORD y NEON_AUDIT_USER en")
            self.stderr.write("backend/.env.audit-prod")
            self.stderr.write("=" * 68)
            return

        self.stdout.write("=" * 68)
        self.stdout.write("AUDITORÍA DE DINERO — read-only")
        self.stdout.write(f"DB host  : {connection.settings_dict.get('HOST')}")
        self.stdout.write(f"DB name  : {connection.settings_dict.get('NAME')}")
        self.stdout.write(f"ENVIRONMENT: {os.getenv('ENVIRONMENT', '') or '(sin definir)'}")
        self.stdout.write("=" * 68)

        max_ids = options["max_ids"]
        today = timezone.localdate()
        self.stdout.write(f"Fecha local (TIME_ZONE): {today}")
        self.stdout.write("")

        connection.force_debug_cursor = True
        connection.queries_log.clear()

        try:
            with transaction.atomic():
                candidates = _collect_candidates(today)
                members = _scan_members()
                plan_changes = _stuck_plan_changes(today)
                closed_items = _comp_closed_period_items(today)
                settlement = _settlement_snapshot()
                f7_p1 = _pt_package_bill()
                f7_p2 = _comp_items_by_scope(today)
                f7_p4 = _uncredited_overpayments(settlement)
                f7_p5 = _unfrozen_discount_periods(settlement, today)
                transaction.set_rollback(True)
        finally:
            connection.force_debug_cursor = False

        writes = [q["sql"] for q in connection.queries_log if _is_write(q["sql"])]

        self.stdout.write("#1  Renovaciones perdidas (bug #1)")
        self.stdout.write(
            f"    candidatos vencidos (end_date < hoy, auto_renew)     : {candidates['total']}"
        )
        self.stdout.write("")
        self.stdout.write("    [hoy]  semántica member-level — mide el bug")
        self.stdout.write(
            f"      se renuevan                                        : {len(candidates['current_will_renew'])}"
        )
        self.stdout.write(
            f"      salteados por tener EL SOCIO ya renovado           : {len(candidates['wrongly_skipped'])}"
        )
        self.stdout.write(
            f"        de los cuales, pérdida del período actual         : {len(candidates['live_loss'])}"
        )
        self.stdout.write(
            f"        de los cuales, rezago histórico inerte            : {len(candidates['stale_backlog'])}"
        )
        self._ids(
            "member_ids con pérdida actual",
            [c["member_id"] for c in candidates["live_loss"]],
            max_ids,
        )
        self._ids(
            "member_ids con rezago histórico",
            [c["member_id"] for c in candidates["stale_backlog"]],
            max_ids,
        )
        self.stdout.write("")
        self.stdout.write("    [post #1]  semántica period-level — lo que queda")
        self.stdout.write(
            f"      saltados OK (sucesora en SU propio período)        : {len(candidates['covered'])}"
        )
        self.stdout.write(
            f"      sin sucesora                                        : {len(candidates['uncovered'])}"
        )
        self.stdout.write(
            f"        target en el mes en curso -> se renuevan          : {len(candidates['uncovered_live'])}"
        )
        self.stdout.write(
            f"          en gym activo                                     : {len(candidates['renew_active_gym'])}"
        )
        self.stdout.write(
            f"          en gym inactivo (#19 los salta)                  : {len(candidates['renew_inactive_gym'])}"
        )
        self.stdout.write(
            f"        target en meses ya cerrados -> rezago inerte      : {len(candidates['uncovered_stale'])}"
        )
        self.stdout.write(
            f"          en gym activo                                     : {len(candidates['stale_active_gym'])}"
        )
        self.stdout.write(
            f"          en gym inactivo                                  : {len(candidates['stale_inactive_gym'])}"
        )
        self._ids(
            "member_ids rezago inerte a no back-fillear",
            [c["member_id"] for c in candidates["uncovered_stale"]],
            max_ids,
        )
        self.stdout.write("")

        self.stdout.write("#2  PT activo sin ítem de PT en la suscripción vigente")
        self.stdout.write(f"    socios activos revisados                      : {members['active']}")
        self.stdout.write(
            f"    PT activo sin item PT (bug #2, NO auto-repara)  : {len(members['pt_without_item'])}"
        )
        self._ids("member_ids", members["pt_without_item"], max_ids)
        self.stdout.write("")

        self.stdout.write("#4/#6  Socios SIN suscripción y con deuda (atrapados)")
        self.stdout.write(
            f"    atrapados (bug #6, consecuencia de #1)        : {len(members['trapped'])}"
        )
        self._ids("member_ids", members["trapped"], max_ids)
        self.stdout.write("")

        self.stdout.write("#5  PlanChangeRequest approved con effective_date vencida")
        self.stdout.write(
            f"    requests trabadas (se auto-reparan con el fix)  : {len(plan_changes)}"
        )
        self._ids("member_ids", [r["member_id"] for r in plan_changes], max_ids)
        self.stdout.write("")

        self.stdout.write("#19  Candidatos de renovación en gym con active=False")
        self.stdout.write(
            f"    candidatos totales en gym inactivo              : {len(candidates['inactive_gym_total'])}"
        )
        self.stdout.write(
            f"    sin sucesora: hoy se renovarían (bug #19)       : {len(candidates['renew_inactive_gym'])}"
        )
        self._ids(
            "member_ids que se renovarían sin el fix",
            [c["member_id"] for c in candidates["renew_inactive_gym"]],
            max_ids,
        )
        self.stdout.write("")

        self.stdout.write("#48  Socios is_comp=True con total de suscripción > 0")
        self.stdout.write(
            f"    deuda fantasma en la suscripción vigente      : {len(members['comp_with_total'])}"
        )
        self._ids("member_ids", members["comp_with_total"], max_ids)
        self.stdout.write(
            f"    ítems pagados en periodos ya cerrados (histórico): {len(closed_items)}"
        )
        self._ids(
            "member_ids con ítems históricos pagados",
            [row["subscription__member_id"] for row in closed_items],
            max_ids,
        )
        for row in closed_items[:max_ids]:
            self.stdout.write(
                f"      socio {row['subscription__member_id']:<6} "
                f"susc {row['subscription_id']:<6} "
                f"{row['subscription__start_date']} -> {row['subscription__end_date']}  "
                f"{row['item_type']:<18} {row['price_snapshot']}"
            )
        if len(closed_items) > max_ids:
            self.stdout.write(
                f"      (+{len(closed_items) - max_ids} ítems más, usar --max-ids para verlos)"
            )
        self.stdout.write("")

        self.stdout.write("=" * 68)
        self.stdout.write("FASE 7.0 — contadores de P1 a P5 (confirmados / armados)")
        self.stdout.write(
            "Un 0 solo no prueba nada: 'armados' es cuántos están a un paso."
        )
        self.stdout.write("=" * 68)
        self.stdout.write("")

        self.stdout.write("F7/P1  PT por paquete que además genera cuota mensual")
        self.stdout.write(
            f"    confirmados (ítem de PT sobre asignación 'package') : "
            f"{len(f7_p1['confirmed'])}"
        )
        self._ids(
            "member_ids",
            [row["subscription__member_id"] for row in f7_p1["confirmed"]],
            max_ids,
        )
        self.stdout.write(
            f"    armados (servicio 'sessions' con monthly_price > 0)   : "
            f"{len(f7_p1['armed'])}"
        )
        for row in f7_p1["armed"][:max_ids]:
            self.stdout.write(
                f"      gym {row['gym_id']:<6} servicio {row['id']:<6} "
                f"{row['name'][:40]:<40} {row['monthly_price']}/mes"
            )
        self.stdout.write(
            f"      cuota mensual en juego si se asigna un paquete     : "
            f"{f7_p1['armed_monthly_total']}"
        )
        self.stdout.write("")

        self.stdout.write("F7/P2-P3  Toggle del pase de cortesía")
        self.stdout.write(
            f"    socios is_comp activos                              : "
            f"{f7_p2['comp_members']}"
        )
        self.stdout.write(
            f"    confirmados, período VIGENTE (debe ser 0)           : "
            f"{len(f7_p2['current'])}"
        )
        self._ids(
            "member_ids vigente",
            [row["subscription__member_id"] for row in f7_p2["current"]],
            max_ids,
        )
        self.stdout.write(
            f"    confirmados, períodos CERRADOS (histórico, no se tocan): "
            f"{len(f7_p2['closed'])}"
        )
        self._ids(
            "member_ids cerrados",
            [row["subscription__member_id"] for row in f7_p2["closed"]],
            max_ids,
        )
        self.stdout.write(
            f"    armados (is_comp SIN suscripción que cubra hoy)     : "
            f"{len(f7_p2['armed'])}"
        )
        self._ids("member_ids armados", f7_p2["armed"], max_ids)
        self.stdout.write("")

        self.stdout.write("F7/P4  Sobrepago sin saldo a favor que lo cubra")
        self.stdout.write(
            f"    suscripciones con pago revisadas                    : {f7_p4['scanned']}"
        )
        self.stdout.write(
            f"    confirmados (paid > total, sin crédito, sin is_comp): "
            f"{len(f7_p4['confirmed'])}"
        )
        self._ids(
            "member_ids",
            [row["member_id"] for row in f7_p4["confirmed"]],
            max_ids,
        )
        self.stdout.write(
            f"      sobrepago total que se pierde                     : "
            f"{f7_p4['confirmed_total']}"
        )
        self.stdout.write(
            f"    armados (pagadas y liquidadas, total > 0)           : "
            f"{len(f7_p4['armed'])}"
        )
        self.stdout.write(
            f"      facturación que puede abrir un sobrepago          : "
            f"{f7_p4['armed_total']}"
        )
        self.stdout.write("")

        self.stdout.write("F7/P5  Período facturado cuyo total depende de un campo vivo")
        self.stdout.write(
            f"    suscripciones con pago y descuento asignado        : {f7_p5['with_discount']}"
        )
        self.stdout.write(
            f"    de ellas, total vivo != total de contrato           : "
            f"{f7_p5['totals_differ']}"
        )
        self.stdout.write(
            f"    confirmados (paid != total vivo)                   : "
            f"{len(f7_p5['confirmed'])}"
        )
        self.stdout.write(
            f"  A) el total SUBIÓ después del cobro: queda debiendo    : "
            f"{len(f7_p5['resurrected'])}  ({f7_p5['resurrected_total']})"
        )
        self._ids(
            "     member_ids que deben de más",
            [row["member_id"] for row in f7_p5["resurrected"]],
            max_ids,
        )
        self.stdout.write(
            f"  B) el total BAJÓ después del cobro: queda sobrepagado  : "
            f"{len(f7_p5['overpaid'])}  ({f7_p5['overpaid_total']})"
        )
        self._ids(
            "     member_ids que pagan de más",
            [row["member_id"] for row in f7_p5["overpaid"]],
            max_ids,
        )
        self.stdout.write(
            f"    armados (descuento activo y suscripción abierta)   : "
            f"{len(f7_p5['armed'])}"
        )
        self._ids("member_ids armados", f7_p5["armed"], max_ids)
        self.stdout.write("")

        self.stdout.write("-" * 68)
        self.stdout.write(f"Queries ejecutadas: {len(connection.queries_log)}")
        self.stdout.write(f"Escrituras detectadas: {len(writes)}")
        if writes:
            for sql in writes[:10]:
                self.stdout.write(f"  !! {sql[:140]}")
        self.stdout.write("Transacción: rollback explícito, nada persistido.")
        self.stdout.write("-" * 68)

    def _ids(self, label, ids, max_ids):
        if not ids:
            self.stdout.write(f"    {label:<44} : (ninguno)")
            return
        unique = sorted(set(ids))
        shown = ", ".join(str(i) for i in unique[:max_ids])
        rest = len(unique) - max_ids
        suffix = f" (+{rest} más)" if rest > 0 else ""
        self.stdout.write(f"    {label:<44} : {shown}{suffix}")
