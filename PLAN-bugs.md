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
| **C. Configuración a prueba de balas** | Validaciones: precio > 0 (planes y add-ons), `access_block_day > payment_due_day` (ya está), visitas semanales en alta y cambio de plan, asimetría de `monthly_price` en modo sesiones, unidades horas/días, `community.discount`. | Una validación, un test | ⬜ |
| **D. Cobro de add-ons y ciclo de baja** | Que desactivar una actividad/salida/PT corte o alinee su línea de facturación; unenroll sin huérfanos; sellado al renovar paquete. | "Desactivar ⇒ no se cobra el add-on" | ⬜ |
| **E. Acceso y portal** | Los rompe-flujo de `ACC` + 500s con lock: cupo que se rechaza a sí mismo, throttle por IP, cooldown con rechazados, filtro "Aprobadas", render de actividades, link mágico, doble registro/pedido. | Un socio válido nunca recibe 429/400/500 indebido | ⬜ |
| **F. Suscripción y recuperación** | `DIN-04` a `DIN-15`: crédito no consumido, cortesía vs auto-renew, impago inicial que renueva, lock de recovery, 201 siempre. | Matrices de cambio de plan / cortesía / recuperación | ⬜ |
| **G. Sesiones y faltas** | No-show en fechas sin clase (`ADD-07`), faltas/recuperación de PT (`ADD-21`), salidas sin no-show (`ADD-11`), descuento fuera de ventana (`ACC-08`). | Invariante de paquete: sesiones consumidas = asistidas + faltas justificadas | ⬜ |
| **H. Rutinas** | `RUT-01` a `RUT-09`: control de rol, soft delete, unicidad de rutina activa, huérfanos, endpoint público, cobertura. | `routines` con tests | ⬜ |
| **I. Comunidad** | `COM-01` a `COM-06`: soft delete, duplicados, `discount` sin validar, socio inactivo en el endpoint público, tests. | `community` con tests + auditoría | ⬜ |
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
