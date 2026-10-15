# BUG-Pagos — bugs de dinero post-Fase 7

Estado: 2026-10-15 — 2 abiertos (P28, P12), 11 cerrados (P19, P20, P21, P22,
P23, P24, P25, P26, P27, P29, P16), P14 escalado a P21, P13 diferido. Fases 0, 1, 2, 3, 4, 5 y 6 cerradas.

Método: un commit por fase. Al terminar cada fase se corre su gate; si no coincide, se
frena y se reporta. No se arranca la fase N+1 sin cerrar la N.

Gate global de cada fase: `cd backend && .venv/bin/python manage.py test subscriptions
members attendance payments plans config` contra Postgres 16 descartable (`DATABASE_URL`
apuntando ahí, no a staging). Ver nota de entorno al final.

## Tabla maestra

| # | Sev | Origen | Fase | Estado | Bug | Gate |
|---|---|---|---|---|---|---|
| P19 | ALTO | revisión 2026-10-05 | 1 | ✅ **cerrado** (Fase 1) | `concept`/`applied_to` escribibles por la API: `PaymentSerializer` no los protege | POST falsificado → 400, cero `Payment`, `member_credit_balance == 0` |
| P20 | ALTO | revisión 2026-10-05 | 1 | ✅ **cerrado** (Fase 1) | re-tipado de crédito a `subscription` evade la validación (hoy no hay ninguna sobre `concept`) | PATCH de un crédito con `concept:"subscription"` → 400, conserva `concept="credit"` |
| P21 | ALTO | escalado de P14 | 2 | ✅ **cerrado** (Fase 2) | `apply_plan_change` reprecia sin `sync_subscription_paid` | reprecio a la baja → crédito acuñado; a la alta → `paid=False`; pago sobre período sin saldo → 400 "ya no tiene saldo pendiente" |
| P22 | MEDIO | revisión 2026-10-05 | 3 | ✅ **cerrado** (Fase 3) | `paid=` escrito a mano en `create_next_subscription` (`services.py:1341`) y `recover_member` (`services.py:1446`) | total 0 → `paid` y `payment_status` coinciden |
| P23 | MEDIO | revisión 2026-10-05 | 3 | ✅ **cerrado** (Fase 3) | el serializer de outstanding expone el flag en un queryset con `remaining > 0` | toda fila devuelta tiene `paid=False` |
| P24 | MEDIO | revisión 2026-10-05 | 4 | ✅ **cerrado** (Fase 4) | `get_is_recoverable` omite `outing_enrollments` (y dos divergencias más con `recover_member`) | socio con solo deuda de outings → no recuperable, y el POST coincide |
| P25 | MEDIO | revisión 2026-10-05 | 5 | ✅ **cerrado** (Fase 5) | `/outstanding` pagina y después anexa todo el gym a `data` | `len(results) <= count`, y `sum(remaining)` de una página no excede el total |
| P26 | BAJO | revisión 2026-10-05 | 6 | ✅ **cerrado** (Fase 6) | `float()` sobre importes en `config/api/dashboard.py` | todo `amount`/`remaining` de la respuesta es `str` |
| P27 | BAJO | revisión 2026-10-05 | 1 | ✅ **cerrado** (`068e59b`) | CI no corre `payments` | el workflow lista `payments` y sus tests corren |
| P28 | BAJO | revisión 2026-10-05 | 7 | ⬜ abierto | higiene: N+1, admin sin scope, consultas sin filtro de gym | sin regresión de query count |
| P29 | ALTO | repro 2026-10-14 | 2 | ✅ **cerrado** (Fase 2a) | `ensure_overpayment_credit` (`services.py:486`) medía lo ya acuñado con `credit_recorded_for` (`services.py:438`), que sumaba también el crédito **consumido** del período (`applied_to`). Con un reprecio a la baja posterior, creía que el exceso ya se devolvió y no acuñaba: el socio perdía la diferencia | crédito consumido + reprecio a la baja → `member_credit_balance` devuelve el exceso |
| P12 | MEDIO | PLAN-dinero | fuera de este plan | ⬜ abierto | borrar una suscripción en el admin deja sus `Payment` con `subscription=NULL` | — (no tiene fase asignada) |
| P14 | BAJO | PLAN-dinero → escalado | → P21 | ✅ escalado | `subscription.paid` desincronizado cuando el total cambia | su descripción no capturaba que el período queda impagable; el fix real es P21 |
| P13 | BAJO | PLAN-dinero | 7 | ⬜ diferido | el fallback `total += subscription.plan.price` reintroduce el precio vigente | — |
| P16 | MEDIO | PLAN-dinero | — | ✅ **cerrado** (`35262ad`) | el bulk de créditos de la renovación no filtraba `applied_to__isnull=False` | — |

### Hallazgos heredados de PLAN-dinero.md

P12 abierto · P13 diferido a Fase 7 · **P16 cerrado** (`35262ad`, 2026-10-05: el bulk de
`_collect_renewal_candidates` ahora delega en `consumed_credit_by_subscription`, que sí
filtra) · P14 escalado → P21.

> Nota: el borrador del plan decía `ab56e53` como evidencia de P16. `ab56e53` creó el
> helper con el filtro correcto (y movió el gate a Postgres); el fix del bulk que P16
> describe es `35262ad`.

---

## Fases

### Fase 0 — este registro

✅ **hecha** (2026-10-06). `BUG-Pagos.md` + puntero en `PLAN-dinero.md`. Sólo docs, 1 commit.

**Archivos:** `BUG-Pagos.md`, `PLAN-dinero.md`.

**Gate:** — (docs).

#### Fase 0 (repro) — ✅ **hecha** (2026-10-14)

Reproducciones que fijan el estado actual **antes** de tocar el motor. Se marcan
`@unittest.expectedFailure`: la suite queda verde y cada test se convierte en el
criterio de aceptación de su fase (se le quita la marca al arreglar).

**Archivos:** `payments/tests.py`, `subscriptions/test_money_bugs.py`.

- **Los 4 `PaymentDebtTests` preexistentes** fallaban por el prorrateo (`ab46bdc`,
  2026-10-08): `open_month_subscription` abría con la fecha de hoy y, después del
  `payment_due_day` (default 10), el alta se prorrateaba, así que el total no era el
  `plan.price` que los tests afirman. **Arreglo:** abrir el período con fecha explícita
  (día 1 del mes). CI no corría `payments`, por eso no se había visto (es P27).
- **P19/P20 — `PaymentConceptIntegrityTests`** (clase nueva en `payments/tests.py`, 5
  tests): POST de crédito; la amplificadora con un sobrepago real; `applied_to`
  falsificado; re-tipado a `subscription`; `enrollment` con monto negativo.
- **P21 — `PlanChangeRepricingTests`** (en `subscriptions/test_money_bugs.py`, 2 tests):
  reprecio a la baja debe acuñar el sobrepago; a la alta debe dejar `paid=False`.
- **P29 — `ConsumedCreditRepricingTests`** (en `subscriptions/test_money_bugs.py`, 1
  test): sobrepago real → renovación consume el crédito → reprecio a la baja del período
  nuevo; hoy el socio no recupera el exceso.

**Decisión (resuelta en Fase 2):** llamar `sync_subscription_paid` en la rama "el período ya
existe" **no** alcanzaba para que `_validate_amount` volviera a aceptar pagos sobre ese
período: ese cálculo (`payments/serializers.py`) no clampea el saldo y tampoco descuenta el
sobrepago, así que un período repreciado a la baja seguía con `remaining` negativo. Se
resolvió clampeando: un período con `remaining <= 0` se rechaza con un 400 limpio ("Este
período ya no tiene saldo pendiente."), sin exponer el número negativo (es P21c).

**Gate:** `manage.py test subscriptions members attendance payments plans` contra
Postgres 16 descartable → 129 tests, `OK (expected failures=8)`.

**Commit:** `test(pagos): repros de Fase 0 para la integridad de concept/applied_to y el reprecio`.

---

### Fase 1 — Integridad de la API de pagos

✅ **hecha** (2026-10-14). P19, P20, P27. **Un commit:** el del CI (P27) ya estaba hecho
desde antes (`068e59b` ya incluye `payments` en el comando del job y lo justifica citando
P27), así que sólo quedó el fix y desmarcar los repros.

**Archivos:** `payments/serializers.py`, `payments/tests.py`.

**Commit 1.1 — CI** ✅ ya estaba (no requirió cambio).
`.github/workflows/backend-tests.yml:68`: el comando ya es
`python manage.py test subscriptions members attendance payments plans` (desde `068e59b`).

**Commit 1.2 — el fix** ✅ hecho.
`payments/serializers.py`: `read_only_fields = ["gym", "applied_to"]`.

Nuevo `validate_concept` junto a los demás `validate_*`:

- rechaza `value == "credit"` — es un artefacto contable interno, lo acuña
  `ensure_overpayment_credit` y lo parte `consume_member_credit`, ninguno por la API.
  Permitirlo invierte el signo del que dependen `member_credit_balance`,
  `credit_recorded_for` y `credit_realized_for`;
- si `self.instance` es un crédito, rechaza **cualquier** cambio de `concept`.

Por ser validadores de campo, DRF sólo los invoca si el campo viene en el payload: un
PATCH de `notes` sobre un crédito sigue funcionando, y el chequeo dispara exactamente
cuando alguien toca `concept`. Eso es lo que cubre P20, que `read_only_fields` no cubre.

**Tests** — `payments/tests.py`, `PaymentConceptIntegrityTests` sobre `BaseAPITest`
(existían como repro `expectedFailure` desde la Fase 0; en esta fase se les quitó la
marca y quedaron verdes):

1. `POST {subscription, concept:"credit", amount:"50000.00"}` → 400, cero `Payment`.
2. **La amplificadora.** Con un sobrepago real ya registrado, el POST falsificado → 400 y
   el saldo del socio intacto. Sin el fix acuñaba `sobrepago + 50.000` en el mismo request.
3. `applied_to` falsificado: PATCH con `applied_to=<otro período>` → 200 que lo ignora
   (read-only); el saldo del socio y el del período ajeno no se mueven.
4. Re-tipado: PATCH de un crédito con `concept:"subscription"` → 400, conserva
   `concept="credit"`.
5. `POST {enrollment, concept:"credit", amount:"-999999.00"}` → 400. En `validate()` no
   entra ninguna rama para `credit`; sin esto, un `amount_paid` negativo borraba la deuda
   del paquete.

**Qué NO incluye:** `CheckConstraint` en el modelo (descartado), y el 400 explícito para
`applied_to` (queda como `read_only_fields`: 200 que ignora en silencio — micro-decisión
cerrada el 2026-10-06).

**Gate:** ✅ `manage.py test subscriptions members attendance payments plans` contra
Postgres 16 descartable → 129 tests, `OK` (los 5 nuevos sin marca + los 4 preexistentes).

**Commit:** `fix(payments): concept y applied_to no se escriben por la API`.

---

### Fase 2 — `apply_plan_change`: el sobrepago que no se acuña — ✅ **hecha** (2026-10-14)

P21 (a/b) + P21c. **Un commit.** P29 se resolvió por separado como **Fase 2a**.

**Archivos:** `subscriptions/services.py`, `payments/serializers.py`,
`subscriptions/test_money_bugs.py`, `payments/tests.py`.

**El fix** — `subscriptions/services.py`, rama "el período ya existe" de `apply_plan_change`:
se re-consulta la suscripción con `select_for_update()` (la rama ya está dentro de un
`atomic()`) y, cuando el plan cambió, tras cancelar el ítem viejo y crear el nuevo con
`ensure_subscription_item`, se llama a `sync_subscription_paid(period_sub)`. Con eso:

- el sobrepago de un reprecio a la baja se acuña como crédito;
- `paid` se recalcula en un reprecio a la alta.

**P21c** — `_validate_amount` (`payments/serializers.py:136`): si `remaining <= 0` (período ya
cubierto por lo cobrado) se responde 400 "Este período ya no tiene saldo pendiente.", sin el
saldo negativo que antes aparecía en el mensaje.

**Tests:**

1. `PlanChangeRepricingTests` (`subscriptions/test_money_bugs.py`): se le quitó
   `expectedFailure` a los 2 tests de la Fase 0 — a la baja acuña el crédito, a la alta deja
   `paid=False`.
2. `SubscriptionOverpaidPeriodTests` (`payments/tests.py`, nuevo): período pagado y
   repreciado a la baja → POST → 400 con "no tiene saldo pendiente" y sin `-$`.

**Qué NO incluye:** los otros tres escritores sin sync — `mutate_membership` ya llama
`sync_subscription_paid` (`domain.py:268`); `create_next_subscription` y `recover_member`
son Fase 3.

**Gate:** ✅ `manage.py test subscriptions members attendance payments plans` contra
Postgres 16 descartable → 130 tests, `OK` (0 expected failures).

**Commit:** `fix(subscriptions): apply_plan_change sincroniza e idempotencia de crédito`.

#### Fase 2a — P29 (B2): el crédito consumido suprime el reembolso — ✅ **hecha** (2026-10-14)

**Un commit**, independiente de P21.

**El bug.** `ensure_overpayment_credit` (`services.py:486-521`) compara el sobrepago contra
`credit_recorded_for` (`services.py:438`), que sumaba las filas con
`Q(subscription=período)|Q(applied_to=período)`. Cuando un sobrepago se consumía en el
período (fila con `subscription=período`, `applied_to=origen`), ya aparecía como
"registrado" y un exceso posterior (reprecio a la baja del período destino) nunca se acuñaba.

**El fix.** `credit_recorded_for` pasa a medir el crédito **originado** por el período:

```
Q(applied_to=período) | Q(subscription=período, applied_to__isnull=True)
```

Una fila abierta cuenta por `subscription` (origen); una fila consumida cuenta por
`applied_to` (origen) y **deja** de contar por `subscription` (destino). Único llamador:
`services.py:512`. Mantiene la idempotencia del origen (una fila movida sigue contando en
`applied_to=origen`) y no duplica cuando `sync` corre dos veces (el crédito recién acuñado
queda abierto en el período y se cuenta).

**Test.** `ConsumedCreditRepricingTests` (`subscriptions/test_money_bugs.py`, 1 test) — se
le quitó la marca `expectedFailure` de la Fase 0 y queda verde: septiembre pagado de más
(50.000) → reprecial a 0 → crédito abierto de 50.000; octubre (50.000) lo consume entero;
reprecio de octubre a 20.000 → `member_credit_balance == 30000.00`.

**Gate:** ✅ `manage.py test subscriptions members attendance payments plans` contra
Postgres 16 descartable → 129 tests, `OK (expected failures=2)` (sólo P21a/P21b).

**Commit:** `fix(subscriptions): credit_recorded_for mide el crédito originado, no el tocado`.

---

### Fase 3 — Que el flag `paid` no mienta — ✅ **hecha** (2026-10-14)

P22, P23. **Un commit.** El flag desnormalizado contaba cosas que no son suyas.

**Archivos:** `subscriptions/services.py`, `subscriptions/serializers.py`,
`subscriptions/test_money_bugs.py`.

**P22 — dejar de escribirlo a mano**

- `create_next_subscription` (`services.py`): se quitó `paid=is_comp` (y la variable
  local `is_comp`); al final de la transacción, tras copiar ítems, consumir crédito y
  aplicar el PCR, se llama `sync_subscription_paid(new_sub)`.
- `recover_member` (`services.py`): se quitó `paid=False`; al final, tras
  `_finalize_plan_change`, se llama `sync_subscription_paid(new_sub)`.

En ambas el lock es innecesario: la fila la crea la misma transacción (INSERT), así que ya
está tomada hasta el commit. Es el mismo patrón que `mutate_membership`
(`domain.py:282-285`: "``paid`` es derivado, nunca escrito acá").

**P23 — no exponerlo donde no puede ser cierto**

`MemberOutstandingSubscriptionSerializer.paid` (`serializers.py:286`) pasa de
`BooleanField(source="subscription.paid")` a un `SerializerMethodField` que devuelve
`obj["remaining"] <= 0`. El queryset que lo alimenta (`member_total_outstanding_debt`)
sólo trae filas con `remaining > 0`, así que derivarlo del saldo vuelve imposible la
contradicción `paid=True` con deuda.

> **Fuera de alcance (nota).** Quedan dos escritores manuales de `paid` sin tocar, por
> decisión de alcance de esta fase: `mutate_membership` rama "sin suscripción vigente"
> (`domain.py:308`, `paid=comp`) — mismo bug de fondo con descuento 100%, pero en un
> branch que el toggle no ejercita — y el alta de socios (`members/services.py:167`,
> `paid=True` para comp), que es correcto por construcción porque comp fuerza
> `remaining = 0`. Si alguna vez se retoma "paid nunca se escribe", empezar por ahí.

**Tests:** `PaidFlagDerivationTests` (`subscriptions/test_money_bugs.py`, 3 tests):
renovación con total 0 (descuento 100%) → `paid` y `payment_status` coinciden; recovery
con total 0 → ídem; fila de `/api/subscriptions/member/<id>/outstanding/` con el flag
stale en `True` → devuelve `paid=False` con `remaining > 0`. Se escribieron como
`expectedFailure` (rojos sobre el código viejo) y se les quitó la marca al arreglar.

**Gate:** ✅ `manage.py test subscriptions members attendance payments plans` contra
Postgres 16 descartable → 133 tests, `OK` (0 expected failures).

**Commit:** `fix(subscriptions): paid se deriva, nunca se escribe ni se expone donde es falso`.

---

### Fase 4 — Una sola regla de deuda — ✅ **hecha** (2026-10-14)

P24. **Un commit.**

**Archivos:** `members/serializers.py`, `members/tests.py`.

`get_is_recoverable` reimplementaba en memoria las precondiciones de
`recover_member` y se había desincronizado en tres puntos:

1. **Omisión de outings (B3).** Recorría `activity_enrollments` y
   `personal_training_assignments` pero no `outing_enrollments`.
   `recover_member` valida contra `member_total_outstanding_debt`, que sí suma
   `member_outing_package_debt` (`services.py:1106`). → botón visible que
   responde 400 "deuda pendiente".
2. **Precedencia `has_future`/`has_current` invertida.** El serializer cortaba
   por `has_future` antes de resolver el caso "hay suscripción vigente";
   `recover_member` chequea `current_sub` primero (Case A, `services.py:1428`) y
   recién después la futura (`:1435`). → un socio con período vigente + futuro
   podía recuperarse por el POST y el badge lo ocultaba.
3. **Plan base.** El serializer usaba `latest_sub.plan.is_base`; `recover_member`
   usa el plan resuelto por `_resolve_plan` (`:1440`), que honra un PCR aprobado.
   → con PCR aprobado a un plan no-base el POST procedía y el badge no.

El fix de raíz es que `get_is_recoverable` **derive** de
`member_total_outstanding_debt` y `_resolve_plan`, en vez de mantener una
segunda implementación. El método ahora espeja el orden de `recover_member`:
comp → sin historial → deuda (`total > 0`) → período vigente (Case A:
`return not obj.active`) → futura → `_resolve_plan` y rechazo del base. Se
eliminó todo el cálculo manual de deuda (sellados, paquetes, `total - paid`).

> `is_comp → False` se preserva (regla de UI; `recover_member` no la tiene).
> Costo aceptado: las dos llamadas a helpers pegan a la base **por socio**; el
> listado (`MemberViewSet`, sin paginación) ya no es query-constante.

**Tests:** `members/tests.py`, clase `RecoveryEndpointTests`, 3 tests que
afirman badge **y** POST juntos (se escribieron como `expectedFailure`, rojos
sobre el código viejo): sólo deuda de un paquete de salidas → `is_recoverable`
False y POST 400 "deuda pendiente"; inactivo con período vigente + futuro → True
y POST 201 (reactiva); base expirada + PCR aprobado a plan no-base → True y POST
201 con el plan pedido.

**Gate:** ✅ `manage.py test subscriptions members attendance payments plans`
contra Postgres 16 descartable → 136 tests, `OK` (0 expected failures).

**Commit:** `fix(members): is_recoverable deriva de member_total_outstanding_debt`.

---

### Fase 5 — `/outstanding`: la paginación

✅ **cerrado** (2026-10-15). P25. Un commit.

**Archivos:** `subscriptions/views.py`, `subscriptions/test_money_bugs.py`.

`subscriptions/views.py:189-266`: `data = serializer.data` era la página, y después se le
anexaban **todas** las filas de paquetes y sellados del gym. `count` venía de
`len(subscriptions)`. Un cliente que sumara `remaining` sobre `results` sobre-reportaba la
deuda del gym y, siguiendo `next`, recibía las filas no-suscripción repetidas en cada
página.

**Fix:** se arma una lista unificada (suscripciones + paquetes + sellados) y se pagina
entera, así que las páginas particionan el total. Se conserva la forma de cada fila, así
que `fetchAllPages` (frontend) sigue funcionando y deja de duplicar.

**Tests** (`OutstandingPaginationTests`): con page size 2 y 5 filas, `len(results) <= count`
y `<= page_size`; la suma de `remaining` de una página no excede el total y la de todas las
páginas lo iguala; las filas no-suscripción aparecen una sola vez; el filtro por gym sigue
cerrando.

**Gate:** gate global (140 tests, 0 `expectedFailure`) + los cuatro casos nuevos, que
fallan sobre el código previo.

**Commit:** `fix(subscriptions): outstanding no muta la página con filas de todo el gym`.

---

### Fase 6 — La frontera de serialización

✅ **cerrado** (2026-10-15). P26. Un commit. Display-only, pero era lo único que mostraba un
número directamente incorrecto.

**Archivos:** `config/api/dashboard.py`, `config/api/tests.py`, `config/api/__init__.py`.

`dashboard.py:117`: `f"${float(pay.amount):,.0f}"` descartaba centavos — un pago de $12,50
se mostraba **$12**. Quedó `f"${pay.amount:,.2f}"`, igual que `payments/serializers.py`
(`f"${remaining:,.2f}"`): conserva centavos y el separador de miles. Los otros seis
`float()` — sobre `remaining` (`:193, :217, :236, :255`, suscripción, paquete de actividad,
PT y salidas) y sobre ingresos (`:309-310`) — pasaron a `str(...)`. `current_month_revenue`
y `previous_month_revenue` caen a `Decimal("0.00")` en vez de `0` para que el string sea
siempre decimal (`"0.00"`, no `"0"`).

El diagnóstico: el motor de cálculo está sano — cero `FloatField` monetarios, cero
`round()` sobre importes, las dos divisiones cuantizan con `ROUND_HALF_UP`. El defecto era
que `dashboard.py` (`members/views.py:296` y `routines/views.py` también) arma el JSON a
mano y salta el `DecimalField` de DRF, que es lo que evita la coerción a `float`. Una
causa raíz, siete sitios.

**Tests:** `DashboardSerializationTests` afirma que `currentMonthRevenue` y
`previousMonthRevenue` son `str` con el valor exacto (`"5000.00"`), que **toda** fila de
`pendingPayments` trae `remaining` `str` y no vacío, y que la descripción de pago muestra
`$5,000.00`. Los tres fallan sobre el código previo.

**Extras que aparecieron al agregar `config` al gate** (nunca corrió, ver abajo): se agregó
`config/api/__init__.py` (faltaba, así que `manage.py test config` descubría 0 tests por no
poder recursar en un namespace package) y se corrigió una aserción stale en
`BackupEndpointTests.test_backup_failure_returns_500` (`'error'` → `'detail'`, que es lo
que devuelve `backup.py:230`; roja desde `479b78f` y jamás ejecutada).

**Qué NO incluye:** `members/views.py:296` y `routines/views.py` — están en la app
`routines`, que no tiene archivo de tests. Quedan anotados en P28.

**Gate:** `subscriptions members attendance payments plans config` (149 tests, 0
`expectedFailure`), con `config` agregado al gate global y al CI.

**Commit:** `fix(config): dashboard serializa importes como string, no float`.

---

### Fase 7 — Higiene (diferible)

⬜ **pendiente.** P28, más P13 de `PLAN-dinero.md`. Encaja en un commit o en ninguno.

**Archivos:** `members/views.py`, `activities/serializers.py`, `activities/public_views.py`,
`subscriptions/services.py`, `subscriptions/admin.py`.

- **N+1:**
  - `members/views.py:253` — `activity.schedules.filter(active=True)` descarta el
    `prefetch_related` de `:239`, y `enrolled_count` es una query por schedule
    (`1 + N_schedules` por request).
  - `activities/public_views.py:28` + `activities/serializers.py:331` (2N, porque
    `get_exhausted` no reutiliza la anotación — **el fix ya está escrito dos archivos más
    arriba**, en `activities/serializers.py:198`).
  - `_package_debt_entries` sin `select_related("member")` en la variante member
    (`services.py:751-760`; las versiones gym-wide sí lo tienen, `:778`).
- **Admin sin scope de gym:** `subscriptions/admin.py` expone `paid` y `price_snapshot`
  editables, sin pasar por `sync_subscription_paid`. Hoy inofensivo porque `is_staff` no
  se setea en ningún lado del código, así que sólo hay superusuarios.
- **Consultas de dinero sin filtro de gym:** `member_credit_balance`, `credit_recorded_for`,
  `consume_member_credit`, `_member_open_credit_subquery`. Inocuas mientras `Member.gym`
  sea inmutable, pero esa invariante está en un comentario, no en el esquema.

**Gate:** gate global + query count sin regresión en los tests que ya lo miden.

**Commit:** opcional — `chore: higiene de queries y admin (P28/P13)`.

---

## Verificación global

Al cerrar cada fase: `cd backend && .venv/bin/python manage.py test subscriptions members
attendance payments` contra Postgres 16, más el gate propio de la fase. Al terminar todo,
esta tabla con las 10 filas P19-P28 en cerrado, P16 ya cerrado desde `35262ad` y P12 con
decisión tomada (o explícitamente fuera de alcance).

## Nota de entorno (actualizada 2026-10-06)

El borrador decía que nada podía correr en local porque faltaba `django-axes`. Ya está
instalado (`axes==8.3.1`, `manage.py check` bootea con Django 6.0.8), así que el gate
local **es posible**: falta sólo un Postgres descartable, porque `backend/.env` apunta
`DATABASE_URL` a Neon staging y contra staging no se puede crear `test_neondb` (rol sin
CREATEDB — lo mismo que obligó a `ab56e53` a mover el gate a CI). El Postgres local de la
máquina acepta conexiones en `/var/run/postgresql:5432` pero no tiene el rol `gim_app`.
