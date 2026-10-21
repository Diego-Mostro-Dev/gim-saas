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
| **K1. Portal del socio** | ACC-26 (el portal no puede dar de baja una inscripción), ADD-06, ADD-18, ADD-24, ADD-25. | Tests de alta/baja del portal + `pnpm build` | ⬜ |
| **K2. Add-ons: solapes, renovaciones y bajas** | ADD-16, ADD-28 (P10), ADD-14, ADD-22, ADD-04, ADD-15. | Tests de salidas/actividades/PT + invariantes de dinero | ⬜ |
| **K3. Faltas, no-show y recuperaciones** | ADD-27 (P8), ADD-29 (P15), ADD-05. | `activities/tests_phase_k.py` | ⬜ |
| **K4. Asistencia y horarios** | ACC-02, ACC-03, ACC-04, ACC-14, ACC-16, CFG-04 (≡ ACC-13), ACC-10 (UI). | `attendance/tests_phase_k.py` + `makemigrations --check` | ⬜ |
| **K5. Dinero y socios** | ACC-23, DIN-17, ACC-19. | Arnés Fase B (I1–I8) + `audit_money_bugs` sin armados | ⬜ |
| **K6. Baja lógica de socios** | ACC-20 (`Member.deleted_at`). | Tests de baja/reactivación + filtros de listados | ⬜ |
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

**Estado al 2026-10-21:** 106 hallazgos — 65 cerrados, 13 decisiones de negocio, **28 abiertos**
(cada uno con su sub-fase) y **0 a verificar**. La K se divide en 9 sub-fases; **un commit por
sub-fase** y no se arranca la N+1 sin cerrar la N (mismo método que A→J: repro en rojo →
fix → gate contra Postgres descartable → CI verde).

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

**K1 · Portal del socio** — `ACC-26`, `ADD-06`, `ADD-18`, `ADD-24`, `ADD-25`.
`ACC-26` es el más visible: hay que crear el endpoint público de baja (hoy no existe) y apuntar
el servicio del front. `ADD-06` son dos líneas (`txt` importado + `useGym()`) que eliminan un
`ReferenceError` latente que tumba **todo** el portal de actividades.
**Gate:** test de API de alta/baja desde el portal + `pnpm build` + lint sin errores nuevos.

**K2 · Add-ons: solapes, renovaciones y bajas** — `ADD-16`, `ADD-28`, `ADD-14`, `ADD-22`,
`ADD-04`, `ADD-15`.
`ADD-16` reusa el validador de solape que ya existe para actividades. `ADD-28` porta el guard
`other_active` de PT (y hay que mirar la variante cross-suscripción). `ADD-14`/`ADD-22` son el
mismo fix: hoy renovar con saldo impago da 400 y **bloquea una acción del staff** (propuesta:
permitirlo con un override explícito). `ADD-04`/`ADD-15` es un solo fix: la restauración
selectiva (el front ya manda `restore_schedules` y el backend lo ignora).
**Gate:** tests de salidas/actividades/PT + invariantes de dinero.

**K3 · Faltas, no-show y recuperaciones** — `ADD-27`, `ADD-29`, `ADD-05`.
`ADD-27` implica atar el crédito de recuperación a una falta concreta (enrollment + fecha) en
actividades y en PT; hoy los dos mecanismos se prueban por separado y nunca juntos, que es
justo donde aparece el bug. `ADD-29` es que el watermark no avance sobre faltas no cobradas.
`ADD-05` agrega `duration_minutes` a `ScheduleSlot` (default 60) y actualiza los 4 call sites
que asumen 1 h.
**Gate:** `activities/tests_phase_k.py` con los tests combinados `grant → cron` que hoy faltan.

**K4 · Asistencia y horarios** — `ACC-02`, `ACC-03`, `ACC-04`, `ACC-14`, `ACC-16`, `CFG-04`,
`ACC-10`.
Primero los S (día cerrado en el path de staff, `409` en "ya entró hoy" + el front que redirige
igual, cooldown y límite mensual para el staff, la nota en inglés de la cancelación silenciosa),
después `ACC-14` (aprobar un cambio no puede dejar dos horarios activos ni violar
`weekly_visits`) y `ACC-02` (campo en `Gym` + migración + los dos paths + la UI de
Configuración). `ACC-10` se cierra corrigiendo el texto de la UI.
**Gate:** `attendance/tests_phase_k.py` + `makemigrations --check` limpio.

**K5 · Dinero y socios** — `ACC-23`, `DIN-17`, `ACC-19`.
`ACC-23`: el coseguro no puede quedar en 0 por un nombre mal escrito (+ backfill). `DIN-17`:
sacar el fallback `total += plan.price` y migrar las **65 filas** que hoy caen en él (el
precio histórico no está en la fila: hay que fijar el criterio de `price_snapshot` antes de
programar). `ACC-19`: constraint en DB + mensaje explícito.
**Gate:** arnés de la Fase B (I1–I8) verde sin `expectedFailure` + `audit_money_bugs` sin
"armados" nuevos.

**K6 · Baja lógica de socios** — `ACC-20`.
`Member.deleted_at` + `DELETE` → 405 + filtros en todos los listados (y "reactivar"). Es la
sub-fase más invasiva: hay que revisar cada queryset que liste socios (panel, portal,
selects, reportes).
**Gate:** tests de baja/reactivación + verificación de que el historial queda intacto.

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
Deja de perder plata (`ADD-27`, `ADD-28`, `DIN-17`, `ACC-23`), arregla el botón roto del
portal (`ACC-26`) y cierra el registro. K4, K6 y K7 pueden ir post-release.

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
