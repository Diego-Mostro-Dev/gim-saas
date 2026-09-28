"""Arnés read-only: ejecuta el código real de renovación y verifica el resultado.

Diferencias con ``audit_money_bugs``:

- El audit NUNCA llama a ``auto_renew_subscriptions``: sus números no cambian
  cuando el fix se aplica, así que no sirven de criterio de aceptación.
- Este comando SÍ ejecuta ``auto_renew_subscriptions()`` — el código real de
  producción — pero dentro de un ``transaction.atomic()`` que termina en
  rollback explícito: nada se persiste. Cualquier escritura que el código
  intente (renovaciones, plan changes, etc.) se descarta en el rollback.

Imprime, además, un diagnóstico independiente con la semántica period-level
que implementa la Fase 3 de PLAN-dinero.md, para que el bug H1 sea visible:
el código hoy renueva 0 socios mientras 45 de Gym Demo siguen congelados.

Uso (read-only, seguro en staging y producción):

    .venv/bin/python manage.py audit_renewal_dryrun
    .venv/bin/python manage.py audit_renewal_dryrun --gym 9
"""

import time
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import connection, transaction
from django.utils import timezone

from subscriptions.models import Subscription, TaskRun
from subscriptions.services import (
    auto_renew_subscriptions,
    get_first_day_of_next_month,
    get_last_day_of_month,
    get_subscription_payment_status,
)
from plans.services import get_base_plan_for_gym

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

TASK_NAME = "subscription_maintenance"


def _is_write(sql):
    return sql.lstrip().upper().startswith(WRITE_PREFIXES)


class Command(BaseCommand):
    help = (
        "Ejecuta el código real de renovación dentro de un rollback y reporta "
        "contadores, queries, escrituras (deben ser 0) y el desglose de guards "
        "con la semántica por período del fix."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--gym",
            type=int,
            help="Limitar la simulación a un gym por su pk.",
        )
        parser.add_argument(
            "--max-ids",
            type=int,
            default=20,
            help="Cantidad máxima de member_ids a listar (default: 20).",
        )

    def handle(self, *args, **options):
        today = timezone.localdate()
        month_start = today.replace(day=1)
        max_ids = options["max_ids"]
        gym = options["gym"]

        self.stdout.write("=" * 68)
        self.stdout.write("AUDIT RENEWAL DRYRUN — read-only")
        self.stdout.write(
            f"DB host  : {connection.settings_dict.get('HOST')}"
        )
        self.stdout.write(
            f"DB name  : {connection.settings_dict.get('NAME')}"
        )
        self.stdout.write(f"Fecha local (TIME_ZONE): {today}")
        if gym is not None:
            self.stdout.write(f"Gym filtrado por pk: {gym}")
        self.stdout.write("=" * 68)
        self.stdout.write("")

        connection.force_debug_cursor = True
        connection.queries_log.clear()

        try:
            diag = self._diagnose(today, month_start, gym)
            diag_queries = len(connection.queries_log)
            result, elapsed = self._run_real_renovation(gym)
            real_queries = len(connection.queries_log) - diag_queries
            last_task = self._last_task_run()
            total_queries = len(connection.queries_log)
        finally:
            connection.force_debug_cursor = False

        writes = [q["sql"] for q in connection.queries_log if _is_write(q["sql"])]

        self._report(
            diag, result, elapsed, last_task, writes, real_queries, total_queries, max_ids
        )

    # ── diagnóstico period-level (independiente del código) ──────────────
    def _diagnose(self, today, month_start, gym):
        qs = Subscription.objects.filter(end_date__lt=today, auto_renew=True)
        if gym is not None:
            qs = qs.filter(gym_id=gym)
        expired = list(
            qs.select_related("member", "gym", "plan", "member__discount")
        )

        windows = defaultdict(list)
        member_ids = {s.member_id for s in expired}
        for r in Subscription.objects.filter(
            member_id__in=member_ids
        ).values("member_id", "start_date", "end_date"):
            windows[r["member_id"]].append((r["start_date"], r["end_date"]))

        base_by_gym = {}

        def base_plan_id(sub):
            bp = base_by_gym.get(sub.gym_id, _NOT_FOUND)
            if bp is _NOT_FOUND:
                plan = get_base_plan_for_gym(sub.gym)
                bp = plan.pk if plan else None
                base_by_gym[sub.gym_id] = bp
            return bp

        counters = defaultdict(int)
        covered_ids = []
        stale = []
        renewing = []
        blocked = []

        for sub in expired:
            target_start = get_first_day_of_next_month(sub.end_date)
            target_end = get_last_day_of_month(target_start)

            if any(
                a <= target_end and b >= target_start
                for a, b in windows[sub.member_id]
            ):
                counters["covered"] += 1
                covered_ids.append(sub.member_id)
                continue

            if target_start < month_start:
                counters["skipped_stale_backlog"] += 1
                stale.append(
                    (sub.id, sub.member_id, sub.gym.name, sub.end_date, sub.paid)
                )
                continue

            if not sub.gym.active:
                counters["skipped_inactive_gym"] += 1
                continue

            bp = base_plan_id(sub)
            if (
                bp
                and bp == sub.plan_id
                and not sub.gym.allow_activity_without_membership
                and not sub.member.is_comp
            ):
                counters["skipped_base_plan"] += 1
                continue

            if not sub.member.active:
                counters["skipped_inactive_member"] += 1
                continue

            if (
                get_subscription_payment_status(sub, at_date=sub.end_date)
                == "blocked"
            ):
                counters["skipped_blocked"] += 1
                blocked.append((sub.id, sub.member_id, sub.gym.name))
                continue

            counters["candidates"] += 1
            renewing.append(
                (sub.id, sub.member_id, sub.gym.name, target_start, target_end)
            )

        return {
            "raw": len(expired),
            "counters": counters,
            "covered_ids": covered_ids,
            "stale": stale,
            "blocked": blocked,
            "renewing": renewing,
        }

    # ── código real, dentro de un rollback ───────────────────────────────
    def _run_real_renovation(self, gym):
        try:
            with transaction.atomic():
                t0 = time.monotonic()
                result = auto_renew_subscriptions(gym)
                elapsed = time.monotonic() - t0
                transaction.set_rollback(True)
        except Exception as exc:  # noqa: BLE001 — el comando debe reportar
            return {"_error": f"{type(exc).__name__}: {exc}"}, None
        result["_elapsed"] = elapsed
        return result, elapsed

    def _last_task_run(self):
        try:
            run = (
                TaskRun.objects.filter(name=TASK_NAME)
                .order_by("-last_run")
                .first()
            )
            if run is None:
                return None
            return {
                "last_run": str(run.last_run),
                "status": run.last_status,
                "duration": run.last_duration_seconds,
                "result": run.last_result,
            }
        except Exception as exc:  # noqa: BLE001
            return {"_error": f"{type(exc).__name__}: {exc}"}

    # ── reporte ─────────────────────────────────────────────────────────
    def _report(self, diag, result, elapsed, last_task, writes, real_queries, total_queries, max_ids):
        counters = diag["counters"]
        c = counters

        self.stdout.write("1) DESGLOSE POR GUARD — candidatos crudos, semántica por período")
        self.stdout.write(f"    candidatos crudos (end_date < hoy, auto_renew) : {diag['raw']}")
        self.stdout.write(
            f"    con sucesora que cubre el target (limpiar auto_renew) : {c['covered']}"
        )
        self.stdout.write(
            f"    skipped_stale_backlog (mes cerrado, sin sucesora)     : {c['skipped_stale_backlog']}"
        )
        self.stdout.write(
            f"    skipped_inactive_gym                                  : {c['skipped_inactive_gym']}"
        )
        if c["skipped_base_plan"]:
            self.stdout.write(
                f"    skipped_base_plan                                     : {c['skipped_base_plan']}"
            )
        self.stdout.write(
            f"    skipped_inactive_member                               : {c['skipped_inactive_member']}"
        )
        self.stdout.write(
            f"    skipped_blocked (impago al vencimiento)               : {c['skipped_blocked']}"
        )
        self.stdout.write(
            f"    candidatos reales a renovar                           : {c['candidates']}"
        )
        total = sum(
            c[k]
            for k in (
                "covered",
                "skipped_stale_backlog",
                "skipped_inactive_gym",
                "skipped_base_plan",
                "skipped_inactive_member",
                "skipped_blocked",
                "candidates",
            )
        )
        mark = "OK" if total == diag["raw"] else "!! NO SUMAN"
        self.stdout.write(f"    SUMA ({mark})                                    : {total}")
        self.stdout.write("")

        self.stdout.write("2) CÓDIGO REAL (baseline; dentro de rollback)")
        if result is None:
            self.stdout.write(f"    ERROR: {result}")
            self.stdout.write("")
        else:
            elapsed = result.pop("_elapsed", None)
            for key in (
                "renewed",
                "skipped_already",
                "failed",
                "plan_changes_applied",
                "plan_changes_failed",
            ):
                self.stdout.write(f"    {key:<24}: {result.get(key, '-')}")
            extra = {k: v for k, v in result.items() if k not in (
                "renewed", "skipped_already", "failed",
                "plan_changes_applied", "plan_changes_failed",
            )}
            if extra:
                for k, v in extra.items():
                    self.stdout.write(f"    {k:<24}: {v}")
            if elapsed:
                self.stdout.write(f"    duración de la llamada              : {elapsed:.1f}s")
            self.stdout.write("")
            self.stdout.write("    comparación con el último TaskRun:")
            if isinstance(last_task, dict):
                self.stdout.write(
                    f"      last_run  : {last_task.get('last_run')} "
                    f"({last_task.get('status')}, {last_task.get('duration')}s)"
                )
                lr = last_task.get("result") or {}
                matches = (
                    result.get("renewed") == lr.get("renewed")
                    and result.get("skipped_already") == lr.get("skipped_already")
                    and result.get("failed") == lr.get("failed")
                )
                self.stdout.write(
                    f"      coincide con TaskRun.last_result ({lr.get('renewed')} / "
                    f"{lr.get('skipped_already')} / {lr.get('failed')}): "
                    f"{'SÍ' if matches else 'NO — investigar'}"
                )
            else:
                self.stdout.write(f"      {last_task}")
            self.stdout.write("")

        self.stdout.write("3) SOCIOS QUE RENOVARÍAN CON EL FIX (member_ids)")
        if not diag["renewing"]:
            self.stdout.write("    (ninguno)")
        for sid, mid, gname, ts, te in diag["renewing"]:
            self.stdout.write(
                f"    sub {sid} member {mid}  {gname}  target {ts} -> {te}"
            )
        self.stdout.write("")

        self.stdout.write("4) CONGELADOS POR H1 — target en mes cerrado, sin sucesora")
        self.stdout.write(
            f"    (no se rellenan; se limpia auto_renew y se cuentan) : {len(diag['stale'])}"
        )
        for sid, mid, gname, end, paid in diag["stale"][:max_ids]:
            self.stdout.write(
                f"    sub {sid} member {mid:<6} {gname:<14} end {end} paid={paid}"
            )
        if len(diag["stale"]) > max_ids:
            self.stdout.write(f"    (+{len(diag['stale']) - max_ids} más, usar --max-ids)")
        self.stdout.write("")

        self.stdout.write("5) SOCIOS BLOQUEADOS POR IMPAGO (no se renuevan)")
        self.stdout.write(
            f"    cantidad: {len(diag['blocked'])}"
        )
        for sid, mid, gname in diag["blocked"][:max_ids]:
            self.stdout.write(f"    sub {sid} member {mid:<6} {gname}")
        if len(diag["blocked"]) > max_ids:
            self.stdout.write(f"    (+{len(diag['blocked']) - max_ids} más, usar --max-ids)")
        self.stdout.write("")

        self._ids(
            "6) member_ids cubiertos por su propio período (a limpiar)",
            diag["covered_ids"],
            max_ids,
        )
        self.stdout.write("")

        self.stdout.write("-" * 68)
        self.stdout.write(f"Queries del diagnóstico: {total_queries - real_queries}")
        self.stdout.write(f"Queries de la llamada real: {real_queries}")
        self.stdout.write(f"Queries totales: {total_queries}")
        self.stdout.write(f"Escrituras detectadas: {len(writes)}")
        if writes:
            for sql in writes[:10]:
                self.stdout.write(f"  !! {sql[:140]}")
        self.stdout.write("Transacción: rollback explícito, nada persistido.")
        self.stdout.write("-" * 68)

    def _ids(self, label, ids, max_ids):
        if not ids:
            self.stdout.write(f"    {label:<58} : (ninguno)")
            return
        unique = sorted(set(ids))
        shown = ", ".join(str(i) for i in unique[:max_ids])
        rest = len(unique) - max_ids
        suffix = f" (+{rest} más)" if rest > 0 else ""
        self.stdout.write(f"    {label:<58} : {shown}{suffix}")


_NOT_FOUND = object()