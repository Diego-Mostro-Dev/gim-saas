"""Invariantes de dinero de un gimnasio (Fase B, PLAN-bugs.md).

Este módulo es la "red de invariantes": recorre el estado persistido de un
gimnasio (suscripciones, ítems, pagos y créditos) y afirma las identidades
contables que el motor de dinero promete. No escribe nada: es 100% read-only,
igual que el patrón de ``audit_money_bugs``.

Uso típico desde una suite (el escenario muta el estado y después afirma):

    violations = check_money_invariants(gym)
    self.assertEqual(violations, [])

Y desde auditoría (reporte legible de lo que hoy no cierra):

    for line in check_money_invariants(gym):
        print(line)

Diseño: las comparaciones evitan apoyarse en la misma función que produjo el
valor. Por ejemplo, ``paid`` (denormalizado) se contrasta contra el saldo
recalculado, y el sobrepago se contrasta contra el crédito efectivamente
registrado. Los chequeos que sí reusan funciones del servicio comparan
**lectores independientes** entre sí (p. ej. ``gym_debtor_member_ids`` contra
``member_total_outstanding_debt``), que es donde las divergencias reales
aparecen.
"""

from collections import defaultdict
from decimal import Decimal


ZERO = Decimal("0")


def _fmt(value):
    try:
        return f"{value:.2f}"
    except (TypeError, ValueError):
        return str(value)


def _active_items(subscription):
    return [item for item in subscription.items.all() if item.status == "active"]


def check_money_invariants(gym):
    """Return a list of human-readable money invariant violations for ``gym``.

    Empty list means every invariant holds. The caller decides what to do with
    a non-empty list (fail a test, print an audit report, etc.).

    Invariants:
      I1  cada suscripción tiene exactamente un ítem de plan activo.
      I2  todo ítem activo tiene ``price_snapshot >= 0``.
      I3  el flag ``paid`` coincide con el saldo recalculado; un comp nunca
          tiene saldo pendiente.
      I4  todo sobrepago está respaldado por crédito registrado.
      I5  los períodos de un socio no se solapan ni repiten ``start_date``.
      I6  un comp nunca es deudor ni figura en ``gym_debtor_member_ids``.
      I7  ``gym_debtor_member_ids`` y ``member_total_outstanding_debt`` marcan
          exactamente a los mismos socios.
      I8  el crédito a favor está bien formado: ninguna fila es positiva,
          toda fila abierta conserva su período de origen y toda fila
          consumida apunta a un período del mismo socio y gimnasio.
    """

    from members.models import Member
    from payments.models import Payment
    from subscriptions.models import Subscription
    from subscriptions.services import (
        credit_recorded_for,
        gym_debtor_member_ids,
        member_credit_balance,
        member_total_outstanding_debt,
        subscription_remaining_balance,
    )

    violations = []

    subscriptions = list(
        Subscription.objects.filter(gym=gym)
        .select_related("member", "plan")
        .prefetch_related("items")
    )

    # ── I1 / I2: ítems ────────────────────────────────────────────────
    for sub in subscriptions:
        active = _active_items(sub)
        plan_items = [item for item in active if item.item_type == "plan"]
        if len(plan_items) != 1:
            violations.append(
                f"I1 socio {sub.member_id} sub {sub.id}: "
                f"{len(plan_items)} ítems de plan activos (se espera 1)"
            )
        for item in active:
            if item.price_snapshot is None or item.price_snapshot < ZERO:
                violations.append(
                    f"I2 socio {sub.member_id} sub {sub.id}: "
                    f"price_snapshot={item.price_snapshot} en {item.item_type}"
                )

    # ── I3 / I4: saldo, flag paid y sobrepago respaldado ──────────────
    for sub in subscriptions:
        balance = subscription_remaining_balance(sub)
        expected_paid = balance["remaining"] == ZERO
        if sub.paid != expected_paid:
            violations.append(
                f"I3 socio {sub.member_id} sub {sub.id}: paid={sub.paid} "
                f"pero remaining={_fmt(balance['remaining'])} "
                f"(se espera paid={expected_paid})"
            )
        if sub.member.is_comp and balance["remaining"] != ZERO:
            violations.append(
                f"I3 socio {sub.member_id} sub {sub.id}: comp con saldo "
                f"pendiente {_fmt(balance['remaining'])}"
            )

        overpayment = balance["overpayment"]
        if overpayment > ZERO:
            recorded = credit_recorded_for(sub)
            if recorded < overpayment:
                violations.append(
                    f"I4 socio {sub.member_id} sub {sub.id}: sobrepago "
                    f"{_fmt(overpayment)} sin crédito que lo respalde "
                    f"(crédito registrado={_fmt(recorded)})"
                )

    # ── I5: períodos por socio ────────────────────────────────────────
    by_member = defaultdict(list)
    for sub in subscriptions:
        by_member[sub.member_id].append(sub)
    for member_id, member_subs in by_member.items():
        ordered = sorted(member_subs, key=lambda s: (s.start_date, s.end_date))
        for previous, following in zip(ordered, ordered[1:]):
            if following.start_date <= previous.end_date:
                violations.append(
                    f"I5 socio {member_id}: períodos solapados "
                    f"{previous.start_date}→{previous.end_date} y "
                    f"{following.start_date}→{following.end_date}"
                )
            if following.start_date == previous.start_date:
                violations.append(
                    f"I5 socio {member_id}: dos suscripciones con "
                    f"start_date {previous.start_date}"
                )

    # ── I6 / I7: deuda por socio ──────────────────────────────────────
    members = list(Member.objects.filter(gym=gym))
    debtor_ids = gym_debtor_member_ids(gym)
    expected_debtors = set()

    for member in members:
        debt = member_total_outstanding_debt(member)
        if debt["total"] < ZERO:
            violations.append(
                f"I7 socio {member.id}: deuda total negativa "
                f"{_fmt(debt['total'])}"
            )
        if member.is_comp:
            if debt["total"] != ZERO:
                violations.append(
                    f"I6 socio {member.id}: comp con deuda "
                    f"{_fmt(debt['total'])}"
                )
            if member.id in debtor_ids:
                violations.append(
                    f"I6 socio {member.id}: comp marcado como deudor"
                )
        elif debt["total"] > ZERO:
            expected_debtors.add(member.id)

    if debtor_ids != expected_debtors:
        only_index = sorted(debtor_ids - expected_debtors)
        only_debt = sorted(expected_debtors - debtor_ids)
        violations.append(
            f"I7 índice de deudores difiere del recálculo: "
            f"solo en índice={only_index}, solo con deuda={only_debt}"
        )

    # ── I8: crédito a favor bien formado ──────────────────────────────
    credit_rows = list(
        Payment.objects.filter(gym=gym, concept="credit").select_related(
            "applied_to", "subscription"
        )
    )
    for row in credit_rows:
        if row.amount >= ZERO:
            violations.append(
                f"I8 pago {row.id}: crédito con monto no negativo {row.amount}"
            )
        if row.applied_to_id is None:
            # Fila abierta: todavía parqueada en el período que la originó.
            if row.subscription_id is None:
                violations.append(
                    f"I8 pago {row.id}: crédito abierto sin período de origen"
                )
        else:
            # Fila consumida: no puede cruzar de socio ni de gimnasio.
            if (
                row.applied_to.member_id != row.member_id
                or row.applied_to.gym_id != gym.id
            ):
                violations.append(
                    f"I8 pago {row.id}: crédito consumido por el período "
                    f"{row.applied_to_id} de otro socio o gimnasio"
                )

    for member in members:
        service_open = member_credit_balance(member)
        if service_open < ZERO:
            violations.append(
                f"I8 socio {member.id}: saldo a favor abierto negativo "
                f"{_fmt(service_open)}"
            )

    return violations
