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
| **J. Higiene, performance y cobertura/CI** | N+1, admin con scope, filtro de gym en consultas de dinero, y sumar al CI las apps que hoy no corren. | CI corre todas las apps | ⬜ |
| **K. Cierre** | `BUGS.md` final + decisiones de negocio + checklist de release. | — | ⬜ |

**Orden obligatorio**: A → B → C → D → E → F → G → H → I → J → K. La B es el "GPS": una vez
que existe la red de invariantes, cada fix de C-F se valida contra ella.

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
activities outings personal_training routines community
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

---

## Decisiones de negocio (no se arreglan, se documentan)

Viven en `BUGS.md` → sección "Pendientes". Resumen: prorrateo de recuperación, crédito no
aplicado al recuperar, precios viejos que no se propagan a socios ya inscriptos, sin
reembolsos, sin pago online, sin recordatorios por email/WhatsApp, `allow_member_schedule_changes`
legacy, y bloqueo desde día 1 del socio con primer pago pendiente.

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
