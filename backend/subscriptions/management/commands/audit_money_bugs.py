"""Auditoría read-only de los bugs de dinero conocidos.

Sólo imprime contadores y member_ids. No escribe nada: toda la ejecución
transcurre dentro de un único transaction.atomic() que nunca se commitea y
termina en rollback explícito.

Las secciones #1, #2, #4/#6, #5, #19 y #48 replican la semántica de
subscriptions/services.py para poder dimensionar el daño en producción sin
disparar la tarea de renovación.

La sección #1 calcula el daño dos veces: con la semántica member-level actual
—la que genera el bug— y con la semántica period-level que se implementará en
el fix, para que una sola corrida muestre el antes y el después.
"""

import os
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.db.utils import OperationalError
from django.utils import timezone

from members.models import Member
from subscriptions.domain import SubscriptionDomain
from subscriptions.models import PlanChangeRequest, Subscription, SubscriptionItem
from subscriptions.services import (
    calculate_subscription_total,
    get_first_day_of_next_month,
    get_last_day_of_month,
    member_total_outstanding_debt,
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

    Current (buggy) semantics, as implemented in
    subscriptions/services.py:_find_already_renewed_members: a member is
    skipped if *any* of its expired subscriptions already has a successor.
    One successor for July masks a missing August.

    Fixed semantics: a candidate is skipped only when a successor overlaps
    *its own* target period.

    Both are computed here so a single run shows the damage measured with the
    bug and the damage that would remain after the fix.
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
