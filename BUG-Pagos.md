# BUG-Pagos — bugs de dinero post-Fase 7

Estado: 2026-10-06 — 11 abiertos (P19-P28, P12), 3 cerrados (P14, P16, P13 → diferido),
0 en curso.

Método: un commit por fase. Al terminar cada fase se corre su gate; si no coincide, se
frena y se reporta. No se arranca la fase N+1 sin cerrar la N.

Gate global de cada fase: `cd backend && .venv/bin/python manage.py test subscriptions
members attendance payments` contra Postgres 16 descartable (`DATABASE_URL` apuntando
ahí, no a staging). Ver nota de entorno al final.

## Tabla maestra

| # | Sev | Origen | Fase | Estado | Bug | Gate |
|---|---|---|---|---|---|---|
| P19 | ALTO | revisión 2026-10-05 | 1 | ⬜ abierto | `concept`/`applied_to` escribibles por la API: `PaymentSerializer` no los protege | POST falsificado → 400, cero `Payment`, `member_credit_balance == 0` |
| P20 | ALTO | revisión 2026-10-05 | 1 | ⬜ abierto | re-tipado de crédito a `subscription` evade la validación (hoy no hay ninguna sobre `concept`) | PATCH de un crédito con `concept:"subscription"` → 400, conserva `concept="credit"` |
| P21 | ALTO | escalado de P14 | 2 | ⬜ abierto | `apply_plan_change` reprecia sin `sync_subscription_paid` | reprecio a la baja de un período pagado → crédito acuñado; a la alta → `paid=False`; y un pago nuevo ya no se rechaza |
| P22 | MEDIO | revisión 2026-10-05 | 3 | ⬜ abierto | `paid=` escrito a mano en `create_next_subscription` (`services.py:1314`) y `recover_member` (`services.py:1418`) | total 0 → `paid` y `payment_status` coinciden |
| P23 | MEDIO | revisión 2026-10-05 | 3 | ⬜ abierto | el serializer de outstanding expone el flag en un queryset con `remaining > 0` | toda fila devuelta tiene `paid=False` |
| P24 | MEDIO | revisión 2026-10-05 | 4 | ⬜ abierto | `get_is_recoverable` omite `outing_enrollments` (y dos divergencias más con `recover_member`) | socio con solo deuda de outings → no recuperable, y el POST coincide |
| P25 | MEDIO | revisión 2026-10-05 | 5 | ⬜ abierto | `/outstanding` pagina y después anexa todo el gym a `data` | `len(results) <= count`, y `sum(remaining)` de una página no excede el total |
| P26 | BAJO | revisión 2026-10-05 | 6 | ⬜ abierto | `float()` sobre importes en `config/api/dashboard.py` | todo `amount`/`remaining` de la respuesta es `str` |
| P27 | BAJO | revisión 2026-10-05 | 1 | ⬜ abierto | CI no corre `payments` | el workflow lista `payments` y sus tests corren |
| P28 | BAJO | revisión 2026-10-05 | 7 | ⬜ abierto | higiene: N+1, admin sin scope, consultas sin filtro de gym | sin regresión de query count |
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

---

### Fase 1 — Integridad de la API de pagos

⬜ **pendiente.** P19, P20, P27. **Dos commits**, deliberadamente separados: si los 4
tests preexistentes de `payments` fallan al entrar a CI, hay que poder atribuirlo al
harness y no al fix.

**Archivos:** `payments/serializers.py`, `payments/tests.py`,
`.github/workflows/backend-tests.yml`.

**Commit 1.1 — CI**
`.github/workflows/backend-tests.yml:65`: agregar `payments` al comando del job y
justificarlo en el comentario existente.

Riesgo: es la primera corrida de esos 4 tests (`PaymentDebtTests` son los únicos en
`payments/tests.py`). Usan helpers que existen en `core/testing.py` y se ven sanos. Si
alguno falla, es preexistente.

**Commit 1.2 — el fix**
`payments/serializers.py:38`: `read_only_fields = ["gym"]` → `["gym", "applied_to"]`.

Nuevo `validate_concept` junto a los demás `validate_*`:

- rechaza `value == "credit"` — es un artefacto contable interno, lo acuña
  `ensure_overpayment_credit` (`services.py:457`) y lo parte `consume_member_credit`
  (`services.py:514`), ninguno por la API. Permitirlo invierte el signo del que dependen
  `member_credit_balance`, `credit_recorded_for` y `credit_realized_for`;
- si `self.instance` es un crédito, rechaza **cualquier** cambio de `concept`.

Por ser validadores de campo, DRF sólo los invoca si el campo viene en el payload: un
PATCH de `notes` sobre un crédito sigue funcionando, y el chequeo dispara exactamente
cuando alguien toca `concept`. Eso es lo que cubre P20, que `read_only_fields` no cubre.

**Tests** — `payments/tests.py`, clase nueva sobre `BaseAPITest`:

1. `POST {subscription, concept:"credit", amount:"50000.00"}` → 400, cero `Payment`.
2. **La amplificadora.** Reproceso el período a la baja vía ORM (patrón de
   `test_lowered_total_creates_credit_for_the_member`) para generar un sobrepago real,
   luego el POST falsificado → 400 y `member_credit_balance == 0`. Sin el fix acuña
   `sobrepago + 50.000` en el mismo request.
3. `applied_to` falsificado: creo un crédito abierto legítimo, PATCH con
   `applied_to=<otro período>` → el saldo del socio y `credit_realized_for` no se mueven.
4. Re-tipado: PATCH de un crédito con `concept:"subscription"` → 400, conserva
   `concept="credit"`.
5. `POST {enrollment, concept:"credit", amount:"-999999.00"}` → 400. En `validate()` no
   entra ninguna rama para `credit`, así que hoy no hay validación de monto alguna; sin
   esto, un `amount_paid` negativo borra la deuda del paquete.

**Qué NO incluye:** `CheckConstraint` en el modelo (descartado), y el 400 explícito para
`applied_to` (queda como `read_only_fields`: 200 que ignora en silencio — micro-decisión
cerrada el 2026-10-06).

**Gate:** los 5 tests nuevos + los 4 preexistentes de `payments` verdes, y el workflow
mostrando `payments` en la corrida.

**Commit:** `fix(payments): concept y applied_to no se escriben por la API` (+ el commit
previo del CI).

---

### Fase 2 — `apply_plan_change`: el sobrepago que no se acuña

⬜ **pendiente.** P21. Un commit. El bug de plata real más grande que queda.

**Archivos:** `subscriptions/services.py`, `subscriptions/test_money_bugs.py`.

**El fix** — `subscriptions/services.py:1804-1814`, rama "el período ya existe": tras
`ensure_subscription_item(period_sub)`, llamar `sync_subscription_paid` con la
suscripción bloqueada. La rama está dentro de un `atomic()` (`:1773`), así que sólo hay
que tomar el lock.

Tres consecuencias que el fix cierra de una:

- el sobrepago de un reprecio a la baja se acuña como crédito;
- `paid` se recalcula en un reprecio a la alta;
- `remaining` deja de ser negativo, y con eso `_validate_amount`
  (`payments/serializers.py:117,133`) vuelve a aceptar pagos sobre ese período.

**Tests** — en `subscriptions/test_money_bugs.py`, siguiendo el patrón de las clases que
ya existen (`MoneyBugRenewalTests`, `CourtesyCreditFrozenDiscountTests`):

1. Período pagado, se reprecia a la baja → crédito acuñado por la diferencia,
   `member_credit_balance` sube.
2. Período pagado, se reprecia a la alta → `paid` pasa a `False`.
3. Repricing a la baja y luego un pago nuevo por el saldo → aceptado (no 400 con saldo
   negativo).

**Qué NO incluye:** los otros tres escritores sin sync — `mutate_membership` ya llama
`sync_subscription_paid` (`domain.py:268`); `create_next_subscription` y `recover_member`
son Fase 3.

**Gate:** `manage.py test subscriptions members attendance payments` verde contra
Postgres, y los 3 tests nuevos pasando sin tocar `ensure_overpayment_credit`.

**Commit:** `fix(subscriptions): apply_plan_change sincroniza paid y acuña el sobrepago`.

---

### Fase 3 — Que el flag `paid` no mienta

⬜ **pendiente.** P22, P23. Un commit. Son el mismo tema: el flag desnormalizado
contando cosas que no son suyas.

**Archivos:** `subscriptions/services.py`, `subscriptions/serializers.py`.

**P22 — dejar de escribirlo a mano**

- `create_next_subscription` (`services.py:1314`): `paid=is_comp` → derivarlo.
- `recover_member` (`services.py:1418`): `paid=False` → derivarlo.

El test `test_toggle_delegates_paid_and_never_writes_it_by_hand` ya afirma la invariante
para `mutate_membership`; estas dos rutas la violan en silencio.

**P23 — no exponerlo donde no puede ser cierto**
`subscriptions/serializers.py:286`: `paid = serializers.BooleanField(source="subscription.paid")`.
El queryset que lo alimenta descarta `remaining <= 0` (`services.py:1052-1054`), así que
toda fila devuelta tiene `remaining > 0` y el flag, por definición, debería ser `False`.
Derivar de `remaining` hace la contradicción imposible en vez de improbable.

**Tests:** total 0 (descuento 100% o plan base) → `paid` y `payment_status` coinciden,
por las dos rutas. Toda fila de `/outstanding` con `remaining > 0` devuelve `paid=False`.

**Gate:** gate global + esos asserts.

**Commit:** `fix(subscriptions): paid se deriva, nunca se escribe ni se expone donde es falso`.

---

### Fase 4 — Una sola regla de deuda

⬜ **pendiente.** P24. Un commit.

**Archivos:** `members/serializers.py`, `members/tests.py`.

`get_is_recoverable` (`members/serializers.py:258-408`) recorre `activity_enrollments` y
`personal_training_assignments` pero no `outing_enrollments`. `recover_member` valida
contra `member_total_outstanding_debt`, que sí incluye `member_outing_package_debt`
(`services.py:1073`). Resultado: botón visible que responde 400.

El fix de raíz es que `get_is_recoverable` derive de `member_total_outstanding_debt` y de
`_resolve_plan`, en vez de mantener una segunda implementación. Eso también cierra las
otras dos divergencias: la precedencia `has_future`/`has_current` está invertida respecto
de `recover_member`, y el serializer usa `latest_sub.plan.is_base` donde `recover_member`
honra un PCR aprobado.

> Parcial ya tocado: `70374fe` (2026-10-05) hizo que el método reste el crédito
> realizado. La omisión de outings y las dos divergencias siguen.

**Tests:** socio con sólo deuda de outings → `is_recoverable=False`; socio con PCR
aprobado y `has_future` + `has_current` → el badge y el POST coinciden.

**Qué NO incluye:** la divergencia "vivo vs congelado" del `discount_percent` entre portal
y suscripción — es cosmética y de otro archivo.

**Gate:** gate global + esos asserts, y que el POST de `recover_member` coincida con el
flag en los mismos fixtures.

**Commit:** `fix(members): is_recoverable deriva de member_total_outstanding_debt`.

---

### Fase 5 — `/outstanding`: la paginación

⬜ **pendiente.** P25. Un commit.

**Archivos:** `subscriptions/views.py`, tests.

`subscriptions/views.py:196-265`: `data = serializer.data` es la página, y después se le
anexan **todas** las filas de paquetes y sellados del gym. `count` viene de
`len(subscriptions)`. Un cliente que sume `remaining` sobre `results` sobre-reporta la
deuda del gym.

El fix tiene dos caminos: paginar sobre una lista unificada de filas, o devolver lo
no-suscripción en una clave aparte sin tocar `data`. Recomendado: la segunda — no cambia
el contrato de las filas y elimina la mutación del payload paginado.

**Tests:** con más filas que el page size, `len(results) <= count`; `sum(remaining)` de la
primera página no excede el total del gym; el filtro por gym sigue cerrando.

**Gate:** gate global + esos asserts.

**Commit:** `fix(subscriptions): outstanding no muta la página con filas de todo el gym`.

---

### Fase 6 — La frontera de serialización

⬜ **pendiente.** P26. Un commit. Display-only, pero es lo único que muestra un número
directamente incorrecto.

**Archivos:** `config/api/dashboard.py`, tests.

`dashboard.py:117`: `f"${float(pay.amount):,.0f}"` descarta centavos — un pago de $12,50
se muestra **$12**. Más seis `float()` sobre `remaining` (`:193, :217, :236, :255`) y
sobre ingresos (`:309-310`).

El diagnóstico: el motor de cálculo está sano — cero `FloatField` monetarios, cero
`round()` sobre importes, las dos divisiones cuantizan con `ROUND_HALF_UP`. El defecto es
que `dashboard.py` (`members/views.py:296` y `routines/views.py` también) arman el JSON a
mano y saltan el `DecimalField` de DRF, que es lo que evita la coerción a `float`. Una
causa raíz, siete sitios.

**Tests:** un test que afirme que todo `amount` y `remaining` de la respuesta del
dashboard es `str`. Es el test que hoy falta y es el punto de entrada más barato para
blindar la frontera.

**Qué NO incluye:** `members/views.py:296` y `routines/views.py` — están en la app
`routines`, que no tiene archivo de tests. Quedan anotados en P28.

**Gate:** gate global + el assert de `str`.

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
