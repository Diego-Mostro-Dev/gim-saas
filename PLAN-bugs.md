# Plan — Bugs generales pre-lanzamiento

Rama de trabajo: `development`. Test runner: Django (`manage.py test`), no hay pytest.

Objetivo: dejar el producto listo para **vender y cobrar** sin sorpresas — que no se le
cobre de más a un socio, que el gimnasio no pierda plata por una configuración mal puesta,
que las suscripciones no se rompan y que nadie quede trabado por un bug.

Este plan **no** reemplaza a `PLAN-dinero.md` / `BUG-Pagos.md` (que cubren el motor de
dinero, fases 0-7, P12-P29, todos cerrados). Es la continuación general: toma los hallazgos
de las 12 auditorías descriptivas (`AUDITORIA-*.md`), los re-verifica, y agrega la
auditoría de los módulos que no tenían ninguna (comunidad, rutinas).

El registro vivo está en **`BUGS.md`**. Este documento es el plan; aquél es el inventario.

---

## Decisiones tomadas (2026-10-19)

- **Alcance:** todo, incluidos comunidad y rutinas.
- **Barra de release:** bloqueantes **+** todo lo documentado **+** higiene y performance.
- **Documento:** un único `BUGS.md` en la raíz, en español, como fuente de verdad. Las
  `AUDITORIA-*.md` quedan como manual descriptivo (no se duplica su contenido).
- **Hallazgos de negocio** (no son bugs): se documentan como pendientes, no se arreglan.
- **Método:** el de `PLAN-dinero.md` — repro en rojo (`@unittest.expectedFailure`) → fix →
  se quita la marca → gate contra Postgres descartable → **un commit por fase, y no se
  arranca la fase N+1 sin cerrar la N**.

---

## Cómo se identifica cada bug

- **ID por área:** `DIN` dinero/suscripción · `CFG` configuración/catálogo · `ADD` add-ons
  (actividades/PT/salidas) · `ACC` acceso/portal/asistencia/horarios · `RUT` rutinas ·
  `COM` comunidad · `REF` robustez/higiene/performance/cobertura.
- **Severidad:**
  - `CRÍTICO` — cobra de más a un socio, hace perder plata al gimnasio, deja a un socio
    válido sin poder usar/pagar algo, o da 500 en un flujo de dinero.
  - `ALTO` — inconsistencia de estado/dato o flujo roto con workaround.
  - `MEDIO` — molesto o sólo con configuración rara.
  - `BAJO` — cosmético/higiene.
- **Estado:** 🔴 abierto · 🟡 a verificar · 🟢 cerrado · ⚪ decisión de negocio.

---

## Fases (orden de ejecución)

| Fase | Qué | Gate para cerrarla | Estado |
|---|---|---|---|
| **A. Registro + triage** | Crear `BUGS.md`; volcar los hallazgos de las 12 auditorías + `BUG-Pagos`; re-verificar cada uno contra `development`. | Cada hallazgo con estado real y repro | ✅ **hecha** (2026-10-19) |
| **B. Arnés de invariantes de dinero** | Suite que recorre el ciclo real por API (alta → pago → renovación → cambio de plan → add-ons → recuperación → sobrepago) y afirma invariantes de dinero. Extiende el patrón read-only de `audit_money_bugs`. | Verde sobre el código actual; los rojos nuevos entran a `BUGS.md` | ✅ **hecha** (2026-10-19; 11 tests verdes, sin rojos nuevos) |
| **C. Configuración a prueba de balas** | Validaciones: precio > 0 (planes y add-ons), `access_block_day > payment_due_day` (ya está), visitas semanales en alta y cambio de plan, asimetría de `monthly_price` en modo sesiones, unidades horas/días, `community.discount`. | Una validación, un test | ✅ **hecha** (2026-10-19; 22 tests nuevos, 10 rojos sin fix) |
| **D. Cobro de add-ons y ciclo de baja** | Que desactivar una actividad/salida/PT corte o alinee su línea de facturación; unenroll sin huérfanos; sellado al renovar paquete. | "Desactivar ⇒ no se cobra el add-on" | ✅ **hecha** (2026-10-19; 11 tests nuevos, 8 rojos sin fix) |
| **E. Acceso y portal** | Los rompe-flujo de `ACC` + 500s con lock: cupo que se rechaza a sí mismo, throttle por IP, cooldown con rechazados, filtro "Aprobadas", render de actividades, link mágico, doble registro/pedido. | Un socio válido nunca recibe 429/400/500 indebido | ✅ **hecha** (2026-10-20; 20 tests nuevos en `attendance/tests_phase_e.py` + ACC-25 en `accounts/tests.py`; ACC-17 cerrado como decisión de negocio) |
| **F. Suscripción y recuperación** | `DIN-04` a `DIN-15`: crédito no consumido, cortesía vs auto-renew, impago inicial que renueva, lock de recovery, 201 siempre. | Matrices de cambio de plan / cortesía / recuperación | ✅ **hecha** (2026-10-20; 14 tests nuevos en `test_money_fase_f.py`; DIN-11/13/16 quedan como decisiones de negocio) |
| **G. Sesiones y faltas** | No-show en fechas sin clase (`ADD-07`), faltas/recuperación de PT (`ADD-21`), salidas sin no-show (`ADD-11`), descuento fuera de ventana (`ACC-08`). | Invariante de paquete: sesiones consumidas = asistidas + faltas justificadas | ✅ **hecha** (2026-10-20; 16 tests nuevos en `activities/tests_phase_g.py` + 5 en `tests_sessions_invariants.py`; ADD-11 queda como decisión de negocio) |
| **H. Rutinas** | `RUT-01` a `RUT-09`: control de rol, soft delete, unicidad de rutina activa, huérfanos, endpoint público, cobertura. | `routines` con tests | ✅ **hecha** (2026-10-20; 16 tests nuevos en `routines/tests_phase_h.py`; RUT-06/RUT-08 quedan como decisiones de negocio; sumar `routines` al CI → Fase J) |
| **I. Comunidad** | `COM-01` a `COM-06`: soft delete, duplicados, `discount` sin validar, socio inactivo en el endpoint público, tests. | `community` con tests + auditoría | ✅ **hecha** (2026-10-20; 15 tests en `community/tests.py` + `AUDITORIA-COMUNIDAD.md`; COM-01/COM-02 quedan como decisiones de negocio; COM-06 re-verificado 🟢) |
| **J. Higiene, performance y cobertura/CI** | N+1, admin con scope, filtro de gym en consultas de dinero, y sumar al CI las apps que hoy no corren. | CI corre todas las apps | ✅ **hecha** (2026-10-20; REF-01/02/03/06 cerrados + REF-07 (N+1), REF-08 (admin sin scope) y REF-09 (500 sin FRONTEND_URL, destapado por CI) nuevos y cerrados; REF-05 queda ⚪ (lint de frontend con deuda preexistente); CI corre todas las apps + job de build de frontend; gate 395 tests) |
| **K0. Saneamiento del registro** | Re-verificar los 11 🟡 que quedaban, corregir las fichas obsoletas, cerrar los no-reproducidos, dar de alta los hallazgos nuevos (ACC-26, ADD-27/28/29) y dejar cada 🔴 con su sub-fase. | `BUGS.md` con 0 🔴 sin sub-fase asignada | ✅ **hecha** (2026-10-21; 11 🟡 re-verificados, 4 fichas nuevas, 5 cerradas sin código, 1 reabierta, 4 fichas obsoletas corregidas, 106 hallazgos = 65 🟢 / 13 ⚪ / 28 🔴, 0 a verificar; borrador de `RELEASE-CHECKLIST.md`) |
| **K1. Portal del socio** | ACC-26 (el portal no puede dar de baja una inscripción), ADD-06, ADD-18, ADD-24, ADD-25. | Tests de alta/baja del portal + `pnpm build` | ✅ **hecha** (2026-10-21; `DELETE /api/activities/public/<token>/` + 10 tests nuevos; `ReferenceError` del portal y botón "Renovar" duplicado arreglados; el horario reconciliado ahora avisa; 405 tests) |
| **K2. Add-ons: solapes, renovaciones y bajas** | ADD-16, ADD-28 (P10), ADD-14, ADD-22, ADD-04, ADD-15. | Tests de salidas/actividades/PT + invariantes de dinero | ✅ **hecha** (2026-10-21; validador de solape compartido `core/overlap.py`; el ítem de la oferta sobrevive mientras haya otro horario; renovación con saldo impago con override explícito; la reactivación restaura sólo los horarios apagados con la oferta; 449 tests) |
| **K3. Faltas, no-show y recuperaciones** | ADD-27 (P8), ADD-29 (P15), ADD-05. | `activities/tests_phase_k.py` | ✅ **hecha** (2026-10-21; la recuperación queda atada a la falta que perdona; el watermark sólo avanza hasta la última falta cobrada; `ScheduleSlot.duration_minutes` con la duración real en los 4 chequeos; 466 tests) |
| **K4. Asistencia y horarios** | ACC-02, ACC-03, ACC-04, ACC-14, ACC-16, CFG-04 (≡ ACC-13), ACC-10 (UI). | `attendance/tests_phase_k.py` + `makemigrations --check` | ✅ **hecha** (2026-10-21; ventana de check-in en `Gym` + los dos paths + la UI; `409` en el duplicado y el front distingue el éxito; día cerrado en el path de staff; cooldown y máximo mensual para el staff; la cancelación silenciosa sólo al aprobar y con nota en español; aprobar re-verifica el horario viejo y `weekly_visits`; la UI deja de prometer vigencia futura; 482 tests) |
| **K5. Dinero y socios** | ACC-23, DIN-17, ACC-19. | Arnés Fase B (I1–I8) + `audit_money_bugs` sin armados | ✅ **hecha** (2026-10-22; fallback de precio eliminado + 65 filas legacy con `price_snapshot = 0`; obra social sin match marcada y enlazable desde el panel + select en el alta pública; teléfono único por gym con constraint parcial y limpieza en la migración; 47 tests nuevos; arnés 125→27, las 27 de `seed` → `DIN-20`; 529 tests) |
| **K6. Baja lógica de socios** | ACC-20 (`Member.deleted_at`). | Tests de baja/reactivación + filtros de listados | ✅ **hecha** (2026-10-25; `Member.deleted_at` + managers `objects`/`all_objects`, `DELETE` → 405, `POST deactivate`/`reactivate`, filtros en todos los listados operativos y validación de teléfono/capacidad al reactivar; pestaña "Dados de baja" en el panel; 26 tests nuevos; 553 tests) |
| **K7. Higiene de frontend y CI** | REF-05 (lint a 0 y bloqueante en el CI), ADD-19, ADD-03. | `pnpm lint` en 0 + `pnpm build` + suite completa | ⬜ |
| **K8. Cierre y release** | `RELEASE-CHECKLIST.md`, `BUGS.md` final, merge a `main` y monitoreo. | Checklist ejecutada de punta a punta en staging | ⬜ |

**Orden obligatorio**: A → B → C → D → E → F → G → H → I → J → K0 → K1 → K2 → K3 → K4 → K5 →
K6 → K7 → K8. La B es el "GPS": una vez que existe la red de invariantes, cada fix de C-F se
valida contra ella.

---

## Entorno de gates

Neon no deja crear `test_neondb` (el rol `gim_app` no tiene `CREATEDB`) y los tests de dinero
dependen de locks reales de fila, así que el gate **no** corre contra staging ni SQLite. Se usa
el cluster Postgres 16 descartable en `/tmp` documentado en `BUG-Pagos.md` (sección "Cluster
descartable sin sudo"):

```bash
export PGBIN=/usr/lib/postgresql/16/bin
$PGBIN/initdb -D /tmp/opencode/pgtest -U postgres -A trust
$PGBIN/pg_ctl -D /tmp/opencode/pgtest \
  -o "-p 55432 -k /tmp/opencode/pgsock -c listen_addresses=127.0.0.1" \
  -l /tmp/opencode/pgtest.log start

cd backend
DATABASE_URL="postgres://postgres@127.0.0.1:55432/postgres" \
DB_SSLMODE=disable ENVIRONMENT=development \
.venv/bin/python manage.py test subscriptions members attendance payments plans config \
activities outings gyms admins accounts personal_training routines community profiles seed core
```

### Fase B — arnés de invariantes

- Checker read-only: `backend/core/money_invariants.py` → `check_money_invariants(gym)`
  (invariantes I1–I8: un plan activo, `price_snapshot >= 0`, `paid == (remaining == 0)`,
  sobrepago respaldado por crédito, sin solape de períodos, cortesía sin deuda, deudores
  recalculados, crédito bien formado).
- Suite: `backend/subscriptions/test_money_invariants.py`. Corre solo con
  `.venv/bin/python manage.py test subscriptions.test_money_invariants`.
- Las transiciones de cron usan el endpoint real `POST /api/system/tasks/?force=true`
  (`X-Task-Key`) con `SCHEDULED_TASKS_ENABLED=False` para no dispararse en cada escritura.
- Si un invariante se rompe de verdad, el caso se marca `@unittest.expectedFailure` citando
  el ID de `BUGS.md`; el fix de la fase que corresponda lo desmarca.

### Fase C — configuración a prueba de balas

Cierra `CFG-09`, `CFG-12`, `CFG-14`, `CFG-01` (backend + frontend) y la validación de `COM-02`.
Todo a nivel **serializer** (sin `CheckConstraint` ni migraciones), por decisión de la fase.

- `core/mixins.py` → `BillingPriceMixin.apply_billing_price_rules`: fuerza `monthly_price = 0`
  en `billing_mode == "sessions"` (también al editar) y exige `> 0` en `"monthly"`. Lo usan
  Activity, Outing y PT.
- `plans/serializers.py` y `admins/serializers.py`: `price > 0` (excepto `is_base` en planes);
  el wizard no puede crear planes a $0.
- `ScheduleDomain.enforce_weekly_visits` (en `subscriptions/domain.py`): aplicado en el alta
  (`members/services.py`) y en la aprobación de cambio de plan (`subscriptions/views.py`),
  antes de escribir nada.
- `gyms/serializers.py`: `schedule_change_{notice,cooldown}_hours` como `IntegerField(min_value=0)`
  con mensajes en español; frontend unificado a **horas** en ambas UIs.
- `community/serializers.py`: `discount` obligatorio y no en blanco.
- `audit_money_bugs`: nuevo chequeo F7/P6 para add-ons en modo sesiones armados.
- `gyms/views.py`: cargar feriados sin `year` usa el año actual (`CFG-15`, detectado por el gate).
- Gate (apps): `subscriptions members attendance payments plans config activities outings
  personal_training gyms community admins` → **263/263 verde**.

### Fase D — cobro de add-ons y ciclo de baja

Cierra `ADD-01`, `ADD-09`, `ADD-02`, `ADD-10` y `DIN-18`. Dos decisiones de producto
(aprobadas antes de programar):

1. **Baja de add-on = "cortar ya":** desactivar una actividad/salida/oferta de PT da de baja las
   inscripciones activas y cancela los `SubscriptionItem` de la oferta en las suscripciones **no
   vencidas** (período en curso y futuros ya generados), resincronizando el saldo. Es equivalente
   a desinscribir socio por socio; si el período ya estaba pago, saldo a favor.
2. **Sellado al ampliar paquete = "no re-cobrar":** `renew_package` deja de resetear
   `sellado_paid` (una vez por inscripción).

- `subscriptions/services.py` → `cancel_addon_items(member_ids, **item_filters)`: pieza
  compartida (cancela ítems no vencidos + `sync_subscription_paid` con lock).
- `activities/enrollment_service.py` → `cut_activity_billing`; `outings/enrollment_service.py` →
  `cut_outing_billing`; `personal_training/assignment_service.py` → `cut_service_billing`
  (dan de baja inscripciones/asignaciones activas y llaman a `cancel_addon_items`).
- Disparo en la transición activo→inactivo: `Activity.save()` / `Outing.save()` y nuevo
  `PersonalTrainingService.save()` (cubre todos los caminos de baja, no sólo el `destroy`).
- Portal: `activities/public_views.py` y `outings/public_views.py` filtran
  `schedule.active` + `activity.active`/`outing.active` (no más huérfanas).
- `renew_package` (actividades y PT): se quita `sellado_paid = False`.
- **Consecuencia documentada:** dar de baja inscripciones borra el sellado/paquete pendiente de
  esos socios (`gym_sellado_debt`/`member_activity_package_debt` filtran `active=True`); se
  prioriza no cobrar de más al socio.
- **Hallazgo nuevo del gate:** `ACC-25` (login con contraseña incorrecta → 500; Axes sin
  `request`) — rojo preexistente, fuera del alcance de D, registrado para la Fase E.
- Tests: `activities/tests_deactivation.py`, `outings/tests_deactivation.py`,
  `personal_training/tests_deactivation.py` (11 tests; 8 rojos antes del fix).
- Gate (apps): `subscriptions members attendance payments plans config activities outings
  personal_training gyms community admins routines` → **274/274 verde**.

### Fase J — higiene, performance y cobertura/CI

Cierra `REF-06`, `REF-03`, `REF-01`, `REF-02` y suma dos hallazgos nuevos (`REF-07`, `REF-08`).
`REF-05` pasa a ⚪ (lint de frontend con deuda preexistente). Verificado con tests rojo→verde.

- `members/serializers.py`: `validate_discount` → `validate_discount_id` (el campo real es
  `discount_id` con `source="discount"`); tests en `members/tests.py`.
- `subscriptions/services.py`: `member_credit_balance`, `credit_recorded_for` y
  `consume_member_credit` filtran por `gym`; tests `CrossGymCreditIsolationTests`.
- N+1 (`REF-07`): prefetch de `member__subscription_set` en los listados semanal/estado
  (`attendance/views.py`), `select_related` en recuperaciones/pedidos de cambio e items de
  suscripción, y `gym_closed_dates_set` lee el prefetch cache. Tests `assertNumQueries` en
  `attendance/tests_phase_j.py`.
- Admin (`REF-08`): `core/admin.py` → `GymScopedAdminMixin`, aplicado a `gyms`, `subscriptions`,
  `plans`, `attendance`, `routines`, `community`, `profiles`. Tests `core/tests_admin_scoping.py`.
- Cobertura/CI (`REF-01`/`REF-02`): `profiles/tests.py`, `seed/tests.py`, `core/tests.py`;
  `.github/workflows/backend-tests.yml` corre todas las apps y suma un job de `pnpm build`.
- CI rojo al sumar `gyms`/`admins` (`REF-09`): `settings.FRONTEND_URL` era `None` sin la env
  var y `None + str` rompía el alta de gimnasio y la vista SEO pública. Default `""` +
  guardas en los call sites; tests `gyms.tests.FrontendUrlMissingTests`.
- Gate: **395 tests OK** + `makemigrations --check` limpio; `pnpm build` verde. El gate corre
  también **sin `FRONTEND_URL`** (env limpio) para reproducir el CI:
  `env -u FRONTEND_URL ...` o quitando la línea de `.env`.

---

### Fase K — plan detallado (K0 → K8)

**Objetivo:** cerrar el registro (`BUGS.md` sin 🔴 sin dueño), arreglar lo que queda vivo —en
orden de impacto sobre la plata y sobre lo que el socio ve— y salir con un checklist de
release ejecutable.

**Estado al 2026-10-25:** 107 hallazgos — 90 cerrados, 13 decisiones de negocio, **4 abiertos**
(cada uno con su sub-fase) y **0 a verificar**. La K se divide en 9 sub-fases; **un commit por
sub-fase** y no se arranca la N+1 sin cerrar la N (mismo método que A→J: repro en rojo →
fix → gate contra Postgres descartable → CI verde). K0, K1, K2, K3, K4, K5 y K6 están hechas;
sigue **K7** (higiene de frontend y CI).

#### Decisiones tomadas (2026-10-21)

| Decisión | Alternativa descartada | Por qué |
|---|---|---|
| **ACC-10**: se corrige la promesa de la UI ("aplica al aprobar"), no se implementa la vigencia futura | Campo `effective_date` + job diferido + estado `approved` (~2 días, migración) | La UI promete algo que el backend no hace; prometer en falso es peor que no prometer |
| **ACC-02**: campo `checkin_window_minutes` en `Gym`, default 0 = sin ventana | Regla global fija (±2 h del horario) | No rompe a los gimnasios ya instalados y cada gym decide su tolerancia |
| **ACC-20**: baja lógica con `Member.deleted_at` | Hard delete con `ProtectedError` | Se pierde historial de pagos y asistencias. **No** se reutiliza `active`: `active=False` significa "suspendido" y el portal debe seguir accesible (COM-01) |
| **ACC-19**: se mantiene el teléfono único por gimnasio, con mensaje explícito y constraint en DB | Permitir teléfono repetido | Es una restricción consciente y ahora con un mensaje que dice en qué gimnasio choca |
| **REF-05**: entra en la K — lint a 0 y `pnpm lint` bloqueante en el CI | Dejarlo como tarea de frontend | El CI sin lint deja pasar errores de React en el portal del socio |

#### Qué vino de las fases anteriores (triaje del 2026-10-21)

El registro tenía 17 🔴 y 11 🟡. Al re-verificar **los 11 🟡** (los que nadie había mirado
desde las auditorías) y contrastar con el código:

- **4 fichas nuevas**:
  - `ACC-26` (ALTO) — **el portal no puede dar de baja una inscripción**: el botón "Cancelar
    inscripción" hace POST al endpoint de **alta** (`activities/public_views.py:44`) y siempre
    responde 409. Regresión de `664737a` (2026-09-02). **No estaba en ninguna auditoría.**
  - `ADD-27` (MEDIO) = **P8** de la Fase 8 de `PLAN-dinero.md`: una recuperación perdona **dos**
    faltas (`no_show_service.py:42-58, 107-111, 286-307`).
  - `ADD-28` (MEDIO) = **P10**: darse de baja de un horario **corta el cobro de toda la oferta**
    (actividades y salidas no tienen el guard `other_active` que sí tiene PT). Regresión de la
    Fase D.
  - `ADD-29` (BAJO) = **P15**: el watermark avanza sobre faltas que nunca se cobraron.
- **5 fichas que se cierran sin código**: `ADD-12` (lo resolvió ACC-08 en la Fase G),
  `ADD-26` (no se reproduce: la PT es recurrente semanal), `ADD-23` / `ADD-17` / `ACC-22`
  (decisiones de negocio), `ACC-13` (duplicado de `CFG-04`).
- **1 ficha que se reabre**: `ADD-06` — la re-verificación de la Fase E fue incorrecta (el
  commit `5a87ad3` no tocó `MemberActivities.jsx`): el `ReferenceError` sigue en el código,
  sólo que hoy la rama está muerta por la Fase D.
- **4 fichas obsoletas corregidas**: `ACC-01`, `ACC-05`, `ACC-06`, `ACC-11` (la tabla decía
  🟢, la ficha decía 🔴).
- **De `PLAN-dinero.md`**: los pendientes #11–#16 (TaskRun real, socios congelados, deuda de
  los 38 bloqueados, backfill de snapshot, números unknowable) entran a "Pendientes" de
  `BUGS.md` como decisiones de negocio/verificación operativa.

#### Sub-fases

**K0 · Saneamiento del registro** — sólo `.md` — ✅ **hecha** (2026-10-21).
Corrigió las fichas obsoletas, cerró los no-reproducidos, dio de alta
`ACC-26`/`ADD-27`/`28`/`29` y dejó cada 🔴 con su sub-fase. **Gate cumplido:** `BUGS.md` con 0
filas 🔴 sin sub-fase asignada y tabla/fichas coherentes (verificado con un script sobre la
tabla maestra).

**K1 · Portal del socio** — `ACC-26`, `ADD-06`, `ADD-18`, `ADD-24`, `ADD-25` — ✅ **hecha**
(2026-10-21).
- **ACC-26**: `DELETE /api/activities/public/<token>/` con `schedule_id` en el body. No exige
  `can_operate` (darse de baja no se penaliza) y no exige horario activo. 403 para
  `billing_mode="sessions"`. 10 tests en `backend/activities/tests_phase_k.py`.
- **ADD-06**: el gym del portal sale del **outlet context**, no de `useGym()` (que es el del
  staff). Se importa `txt` y se borra un import muerto.
- **ADD-18**: un solo botón "Renovar" (condición `isPackage`): el backend sí renueva los
  paquetes de cortesía a precio 0.
- **ADD-24**: `reconcileSlot` devuelve `changed` y los 4 llamados avisan con un toast.
- **ADD-25**: el estado `approved` de PT sale de `STATUS_CHOICES` (migración `0003`).
**Gate:** 405 tests OK contra Postgres 16 descartable + `pnpm build` + `pnpm lint` (91 → 88
problemas) + `makemigrations --check` limpio.

**K2 · Add-ons: solapes, renovaciones y bajas** — `ADD-16`, `ADD-28`, `ADD-14`, `ADD-22`,
`ADD-04`, `ADD-15` — ✅ **hecha** (2026-10-21), en cuatro commits.
- **ADD-16** (solapes): el problema de fondo era que cada app llevaba su propia copia de la
  comprobación y las copias se desfasaron (actividades la tenía, PT la tenía, salidas no).
  `backend/core/overlap.py` es ahora la fuente única de las cuatro fuentes de solape
  (horario fijo del gimnasio, actividades, salidas y PT) y devuelve un código de conflicto que
  cada app traduce a su texto. Salidas: valida en `enroll_member` y en la solicitud del portal.
  Actividades y PT: se les agrega la dimensión "salidas" que les faltaba — si sólo validara el
  lado de las salidas, el orden de las anotaciones cambiaría la regla.
  19 tests (14 salidas + 2 actividades + 3 PT).
- **ADD-28** (bajas): `_cancel_activity_items` y `_cancel_outing_items` cancelan el ítem sólo
  cuando no queda ninguna inscripción activa **de la misma oferta**, con el mismo criterio que
  `_cancel_pt_items`. La baja masiva de una oferta desactivada no cambia.
  11 tests.
- **ADD-14`/`ADD-22` (renovaciones):** la regla "cobrar antes de renovar" se mantiene; lo que
  cambia es que el staff puede forzar la renovación con saldo impago con un override explícito
  (`allow_unpaid` en el backend + confirmación en el front), en vez de quedarse bloqueado. Se
  aplicó también a actividades, que tenía el mismo bug aunque la ficha no lo listara.
  10 tests.
- **ADD-04`/`ADD-15` (reactivación):** nuevo flag `auto_deactivated` en `ActivitySchedule` y
  `OutingSchedule`: la cascada que apaga los horarios al desactivar la oferta los marca, y al
  reactivar vuelven **sólo** esos; los apagados a mano siguen apagados. `restore_schedules`
  (que el front ya mandaba y el backend ignoraba) deja la oferta activa sin tocar horarios.
  Migraciones `activities/0016` y `outings/0004` con backfill. La respuesta trae
  `restored_schedules` y el front lo dice ("reactivada con 2 horarios").
  8 tests.
**Gate:** 449 tests OK contra Postgres 16 descartable + `pnpm build` + `pnpm lint` (88, sin
errores nuevos) + `makemigrations --check` limpio.

**K3 · Faltas, no-show y recuperaciones** — `ADD-27`, `ADD-29`, `ADD-05` — ✅ **hecha**
(2026-10-21), en un commit (`1b2acff`).
- **ADD-27** (una recuperación, una falta): `SessionRecovery` gana `forgiven_date`,
  `forgiven_enrollment` y `forgiven_assignment`. Al otorgar el recupero queda anotada la falta
  que perdona, y los créditos ya enlazados dejan de cubrir faltas nuevas; si al otorgarlo no
  hay ninguna falta registrada, el crédito queda en vuelo y el cron lo enlaza a una falta
  pendiente. Espejo en PT. Los créditos legados no se pueden backfillear (no se sabe qué falta
  perdonaron) y siguen como antes.
  5 tests (3 actividades + 2 PT).
- **ADD-29** (watermark): `_deduct_activity_enrollment` y `_deduct_pt_assignment` devuelven
  `(created, last_charged, pending)`; el watermark sólo avanza hasta la última falta cobrada
  cuando quedan pendientes, así que el rango se vuelve a recorrer y las faltas no se pierden.
  4 tests (2 actividades + 2 PT).
- **ADD-05** (duración real del bloque): `ScheduleSlot.duration_minutes` (default 60,
  migración `attendance/0026`) y la aritmética de horarios en un solo lugar
  (`backend/core/times.py`). Los 4 call sites que asumían 1 h usan la duración real
  (inscripción en actividad, alta de socio con agenda, ventana del recupero, validación de
  onboarding); la API acepta `duration_minutes` (15–480 min) y `Settings.jsx` la muestra y la
  deja editar. El lado PT ya usaba `start_time`/`end_time` reales.
  8 tests (3 actividades + 5 API en `attendance/tests_phase_k3.py`).
**Gate:** 466 tests OK contra Postgres 16 descartable + `pnpm build` + `pnpm lint` (88, sin
errores nuevos) + `makemigrations --check` limpio.

**K4 · Asistencia y horarios** — `ACC-02`, `ACC-03`, `ACC-04`, `ACC-14`, `ACC-16`, `CFG-04`,
`ACC-10`.
Primero los S (día cerrado en el path de staff, `409` en "ya entró hoy" + el front que redirige
igual, cooldown y límite mensual para el staff, la nota en inglés de la cancelación silenciosa),
después `ACC-14` (aprobar un cambio no puede dejar dos horarios activos ni violar
`weekly_visits`) y `ACC-02` (campo en `Gym` + migración + los dos paths + la UI de
Configuración). `ACC-10` se cierra corrigiendo el texto de la UI.
**Hecho (2026-10-21, `3ea3b21`):**
- `ACC-02`: `Gym.checkin_window_minutes` (0 = sin ventana, default que no rompe los gyms
  instalados; la ventana va de (inicio − N) hasta el fin real del bloque, ADD-05). El path
  público acepta cualquiera de los bloques activos del socio del día; el de staff compara el
  bloque del pedido. Campo en la UI de configuración del gym.
- `ACC-03`: el serializer de staff valida `GymClosedDate` (400).
- `ACC-04`: el duplicado (normal o intercambio) responde 409 y el front no redirige ante
  `data.success === false`.
- `ACC-14`: al aprobar se re-verifica que el horario viejo siga activo (si el staff editó la
  ficha, 400: el socio tiene que volver a pedirlo) y se valida `weekly_visits` antes de tocar
  la ficha.
- `ACC-16`: los pedidos pendientes de horario/intercambio se cancelan sólo al **aprobar** el
  cambio de plan (al rechazar ya no se tocan) y la nota `admin_notes` —lo único que ve el socio
  en el portal— queda en español.
- `CFG-04` (≡ `ACC-13`): cooldown y máximo mensual en un helper compartido
  (`attendance/utils.check_schedule_change_limits`) que usan los tres caminos.
- `ACC-10`: el panel deja de decir "Vigente: {fecha}" y aclara que el cambio se aplica al
  aprobarlo (decisión del 2026-10-21: no se implementa la vigencia futura). De paso, el panel
  reconoce el estado `executed` (la etiqueta y el filtro "Aprobadas" ya no quedan vacíos).
- Tests: 15 nuevos (11 en `attendance/tests_phase_k4.py`, 2 en `subscriptions/tests_phase_k4.py`),
  todos en rojo antes del fix.
**Gate:** 482 tests OK contra Postgres 16 descartable + `pnpm build` + `pnpm lint` (88, sin
errores nuevos) + `makemigrations --check` limpio.

**K5 · Dinero y socios** — `ACC-23`, `DIN-17`, `ACC-19`.
**Hecho (2026-10-22):**
- `DIN-17` (`2498e33`): se quita el fallback `total += plan.price`; `calculate_subscription_total`
  suma sólo los ítems y `_report_missing_plan_item` deja un ERROR en logs si falta el ítem. La
  migración `subscriptions/0024_backfill_missing_plan_items` crea el ítem de las **65 filas
  legacy** con `price_snapshot = 0` (decisión: lo efectivamente cobrado — están vencidas y sin
  pagos) y `paid = True`, idempotente. Medido sobre la copia local de staging: 65 → 0 filas en
  el fallback y el arnés bajó de 125 a 27 violaciones (las 27 son datos de `seed/base.py`, nueva
  ficha `DIN-20`, no código de facturación); `audit_money_bugs` idéntico antes/después.
- `ACC-23` (`11e2d5c`): decisión "no bloquear el alta, marcar y enlazar". `insurance_unverified`
  en el serializer, badge + filtro + botón de un clic en el panel (`MemberForm` abre el combo),
  endpoint público `GET /api/public/health-insurances/<code>/` y select de obras en
  `Register.jsx` con "Otra obra social...". Signal de re-enlace al crear/renombrar una obra
  (`members/insurance.py`, `members/signals.py`) y comando `relink_insurances --gym|--all`.
  WARNING en logs cuando el nombre no matchea. Backfill: 0 filas en staging.
- `ACC-19` (`85a20d6`): `UniqueConstraint(gym, phone)` parcial (teléfonos vacíos afuera) +
  `IntegrityError` → 400 con "Ya existe un socio con ese teléfono en este gimnasio." en staff y
  alta pública. La migración `members/0019` limpia los duplicados **antes** de crear el índice
  (`phone_cleanup.py`, keeper = el más antiguo, sufijo `-<id>`) y el comando
  `cleanup_duplicate_phones` permite el dry-run. Re-medición en producción (sólo lectura): **1
  grupo real** (`gym_id=9`, `000-0000`, socios 882/883/884) — la cifra anterior de 12 grupos
  agrupaba por nombre de gym y era un falso positivo.
- Tests: 47 nuevos (11 en `subscriptions/tests_phase_k5.py`, 21 + 15 en
  `members/tests_phase_k5.py`).
**Gate:** 529 tests OK contra Postgres 16 descartable + `pnpm build` + `pnpm lint` (88, sin
errores nuevos, deuda de K7) + `makemigrations --check` limpio + arnés de la Fase B (I1–I8)
verde sin `expectedFailure` + `audit_money_bugs` sin "armados" nuevos.

**K6 · Baja lógica de socios** — `ACC-20`.
**Hecho (2026-10-25):**
- `Member.deleted_at` (migración `members/0020`) + managers `objects` (sólo vivos) y
  `all_objects` (todos). `soft_delete()` marca la baja, apaga `active` y `auto_renew`;
  `reactivate()` limpia `deleted_at` y vuelve a `active`.
- `DELETE /api/members/<id>/` → **405**. La baja es `POST /api/members/<id>/deactivate/` y la
  reactivación `POST /api/members/<id>/reactivate/`; `GET /api/members/?deleted=1` lista los
  dados de baja. El panel suma la pestaña **"Dados de baja"** con el botón de reactivar.
- Filtros operativos en actividades, salidas, asistencias, PT, rutinas, adjuntos,
  suscripciones, deudores, dashboard y portal. El historial financiero se conserva: los pagos
  siguen visibles aunque el socio esté dado de baja y las suscripciones no se borran.
- Reactivar valida que el teléfono siga libre y que no se hayan ocupado las capacidades
  (horario de gimnasio, actividad, salida o entrenador de PT); si hay conflicto responde 400
  con `conflicts`.
- La migración `0019` usa el modelo histórico para la limpieza de teléfonos: así puede correr
  antes de que exista `deleted_at` en una base nueva.
- Tests: 26 nuevos en `members/tests_phase_k6.py`.
**Gate:** 553 tests OK contra Postgres 16 descartable + `makemigrations --check` limpio.

**K7 · Higiene de frontend y CI** — `REF-05`, `ADD-19`, `ADD-03`.
`REF-05`: declarar `__BUILD_ID__`/`__APP_VERSION__`/`process` en `eslint.config.js`, arreglar
la deuda de `react-hooks` v7 hasta dejar el lint en 0, y recién entonces volver `pnpm lint`
bloqueante en el CI. `ADD-19` expone el PATCH de trainer/horario (feature que el backend ya
soporta). `ADD-03`: el cambio de horario del portal, atómico o muerto.
**Gate:** `pnpm lint` en 0 + `pnpm build` + suite completa verde.

**K8 · Cierre y release** — `RELEASE-CHECKLIST.md` final, `BUGS.md` sin 🔴, `PLAN-bugs.md`
cerrado, merge `development` → `main` (que despliega Render vía `Procfile`) y monitoreo con
`scripts/monitor.sh`.
**Gate:** checklist ejecutada de punta a punta en staging + `monitor.sh` verde.

#### Corte mínimo publicable

Si hay que liberar antes de terminar la K entera: **K0 + K1 + K2 + K3 + K5 + K8** (~5 días).
Deja de perder plata (`ADD-27` 🟢, `ADD-28` 🟢, `DIN-17`, `ACC-23`), arregla el botón roto del
portal (`ACC-26`) y cierra el registro. K7 puede ir post-release.

**Estimación total:** ~10 días de trabajo efectivo (K6 y K7 son las que más engordan; K7
parcial = sólo `REF-05`).

---

## Decisiones de negocio (no se arreglan, se documentan)

Viven en `BUGS.md` → sección "Pendientes" (13 filas). Resumen: prorrateo de recuperación, crédito
no aplicado al recuperar, precios viejos que no se propagan a socios ya inscriptos, sin
reembolsos, sin pago online, sin recordatorios por email/WhatsApp, `allow_member_schedule_changes`
legacy, y bloqueo desde día 1 del socio con primer pago pendiente.

**Sumadas en el triaje de la K (2026-10-21):** las salidas en modo sesiones no se ofrecen en el
portal (`ADD-17`) · desvincular PT no toca los períodos ya generados (`ADD-23`) · quitar la
cortesía exige elegir un plan de pago (`ACC-22`) · el teléfono sigue siendo único por gimnasio
(`ACC-19`, con mensaje explícito) · y las 5 decisiones heredadas de `PLAN-dinero.md` (socios
congelados, deuda de los bloqueados, backfill de snapshot, números unknowable, TaskRun real).

---

## Riesgos y supuestos

- **Las fases D y F cambian comportamiento de producto** (dejar de cobrar al desactivar, cómo
  tratar la recuperación). Cada fix necesita un **criterio de aceptación escrito antes de
  programar**; si el negocio no lo comparte, pasa a ⚪ en vez de arreglarse.
- El triage de la Fase A ya confirmó que **varios hallazgos de las auditorías están viejos**
  (ya arreglados) y que aparecieron otros nuevos (comunidad, `CFG-14`). Conviene re-correr el
  triage al cerrar cada fase.
- **El frontend no tiene tests** (sólo `lint`/`build`), así que los bugs de render del portal
  (p. ej. `ADD-06`) se verifican a mano. Agregar Vitest queda como opción de la Fase J.
- Alcance "todo + higiene" es multi-sprint; la tabla de `BUGS.md` da el tamaño real.

---

## Cómo retomar

1. Leer `BUGS.md` (tabla maestra + fichas) y este plan.
2. Respetar el orden de fases y el gate de cada una.
3. Un commit por fase. Al cerrar una fase: actualizar el estado en `BUGS.md` y este plan.
4. Si un hallazgo resulta ser decisión de negocio, moverlo a "Pendientes" y seguir.
5. **Fase K:** arrancar por **K0** (sólo `.md`, sin riesgo) y seguir K0 → K1 → … → K8. Cada
   sub-fase cierra sus IDs en `BUGS.md` y actualiza la tabla de fases de este plan.
6. El checklist de release vive en **`RELEASE-CHECKLIST.md`** (borrador en K0, se completa en K8).
