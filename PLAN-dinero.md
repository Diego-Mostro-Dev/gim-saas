# Plan — Bugs de dinero en suscripciones

Rama de trabajo: `development`.
Test runner: Django (`manage.py test`). No hay pytest.

> **Nota sobre `main` (corregido 2026-09-28).** Este documento decía antes "`main` no se
> toca". Ya no es cierto: `main` y `development` tienen **el mismo árbol** (`5b618156`), con
> `development` 0 commits adelante y 25 atrás (los 25 son merges de `development` hacia `main`).
> Las Fases 0-6 **están en la rama que usa producción**. Verificar el estado real:
>
> ```bash
> git rev-list --left-right --count main...development   # -> 25  0
> git rev-parse main^{tree} development^{tree}            # -> idénticos
> ```

## CÓMO RETOMAR ESTE TRABAJO

Estado: **Fases 0-7 commiteadas en `development`. La 7 cierra el 2026-10-02** con dos bugs que no
estaban en el alcance original, P17 y P18, que aparecieron al escribir la matriz de tests del
toggle de cortesía (detalle en "P17 en detalle" y "P18 en detalle").

> **Los bugs post-Fase 7 (P19-P28) viven en `BUG-Pagos.md`** (registro agregado 2026-10-06).
> De esta lista, **P16 está cerrado** (`35262ad`), **P14 escaló a P21** de ese registro y P13
> quedó diferido a su Fase 7. Todo lo demás sigue abierto allá.

**El gate cambió de base el 2026-10-01** (`ab56e53`). Antes era SQLite; ahora el gate de la Fase 7
corre contra **Postgres real**, que es lo que hace CI (`.github/workflows/backend-tests.yml`
levanta un `postgres:16` y corre `manage.py test subscriptions`). SQLite ya no sirve como
referencia: `ScheduledTaskClaimTests` se apoya en el lock de fila de Postgres, que en SQLite no
existe porque las escrituras se serializan solas, así que en SQLite el test pasaba sin ejercitar
la garantía que dice comprobar. Para una corrida local rápida:

```
cd backend && .venv/bin/python manage.py test subscriptions
```

con `DATABASE_URL` apuntando a un Postgres descartable. Si sólo se quiere iterar sobre lógica de
precio y no sobre concurrencia, SQLite sirve, pero lo que entonces se mide no es el gate.

| Fase | Qué | Estado | Commit |
|---|---|---|---|
| 0 | Métricas del audit por período | **CERRADA** | `bf6b28a` (+ docs `0d76102`) |
| 1 | Arnés read-only `audit_renewal_dryrun` | **CERRADA** | `d14dfc9` |
| 2 | Limpiar `auto_renew` + eliminar N+1 + orden de guards | **CERRADA** | `51022c1` |
| 3 | #1: skip por período, no por socio | **CERRADA** | `7401f0a` |
| 4 | Claim atómico + atómico por socio | **CERRADA** | `4b8022a` |
| 5 | Guards de escritura #2 y #48 | **CERRADA** | `a5271ed` |
| 6 | Tests focalizados | **CERRADA** | `23438bf` |
| 7 | Bugs ALTO de precio, pase de cortesía y PT por paquete | **CERRADA** en código (2026-10-02); checklist de cierre abierto | 7.0 `6bd6a91` · 7.1 `9185300`, `baa7fb8`, `2eba60b`, `35c3577` · 7.2 `22107ff` · 7.3 `a06f6f2` · P17 `a000871` · P18 `9a051c8` · bulk `ab56e53` |

Reglas para retomar:

1. Leé las secciones 1 y 2 (contexto y decisiones). Son el porqué.
2. **No rehagas la Fase 0.** Ya está commiteada. Sus números verificados están en la
   sección 3, Fase 0. La nueva verificación es el arnés de la Fase 1, no el audit.
3. Ejecutá las fases de la sección 3 **en orden**, una por vez. No arranques la Fase N+1
   sin cerrar la N. La Fase 7 tiene orden propio: **7.0 → 7.2 → 7.1 → 7.3 → 7.4**.
4. Después de cada fase, corré su criterio de verificación. Si no coincide, **frená** y
   reportá en vez de seguir.
5. Un commit por fase, con los mensajes de la sección 4.
6. Al final, la verificación global de la sección 5.
7. **La 7.0 va primera y es de sólo lectura, a propósito.** Es la única de la fase que no se
   puede deshacer fácil: un saldo a favor mal calculado escribe filas que después hay que
   migrar a mano. La Fase 2 aprendió lo mismo con su `UPDATE` de limpieza.

Pendientes sueltos que **no** son parte de ninguna fase, para que no se pierdan:

- Los números de esta versión del plan se midieron contra **staging** el 2026-09-28. Antes
  de implementar, correr el arnés de la Fase 1 contra **producción** (read-only) para
  confirmar que el diagnóstico no se movió.
- Los 45 socios de `Gym Demo` congelados quedan sin suscripción al aplicar la Fase 3. Si el
  negocio quiere reactivarlos, se usa `recover_member` (`services.py:888`), **no** el
  auto-renovador. Es decisión de negocio, fuera del plan.
- Los ítems históricos del socio 827 (Diego Salvado, julio y agosto, 25.000) **no** se tocan.
  Sólo se reportan.
- **La Fase 7 nace de revisión de código, no de métricas.** Los 7 bugs que corrige (P1-P7) no
  los detectó ningún contador: el `audit_money_bugs` actual sólo implementa
  **#1, #2, #4, #5, #6, #19 y #48**. Por eso la Fase 7 arranca con una 7.0 de métricas
  propias — sin línea base medida, no hay forma de probar que la 7.1 corrigió algo.
- **Impacto real de los bugs de la Fase 7 al 2026-09-28: $0.** El único gym real (`Sinkro`)
  tiene 0 socios, así que ninguno de estos caminos se ha ejercido con dinero de verdad. Se
  corrigen ahora porque la ventana es antes de que entre el primer socio real, no porque
  hayan costado plata.

---

## QUÉ FALTA HACER

Todo lo pendiente en un solo lugar, con el gate que hay que cumplir para poder cerrarlo.
**Orden de ejecución de la Fase 7: `7.0 → 7.2 → 7.1 → 7.3 → 7.4`.**

### Trabajo de código (Fase 7)

| # | Qué | Dónde | Gate para cerrarlo | Estado |
|---|---|---|---|---|
| 1 | **7.0** — 4 contadores read-only con pares `confirmados`/`armados` | `audit_money_bugs.py` | `Escrituras: 0` + los 8 números medidos en staging **y** producción | ✅ **hecho** (2026-09-29) |
| 2 | **7.2** — PT por paquete no genera cuota mensual | `services.py` (dos vías) + alta/edición de servicio | test de paquete sin ítem de PT por las **dos** vías + arnés **sin cambios** | ✅ **hecho** (2026-09-29) |
| 3 | **7.1a** — `is_comp` se persiste antes de calcular precios | `members/serializers.py:590` | 8 casos del toggle, assertando sobre total y balance, **nunca sobre `paid`** | ✅ **hecho** (2026-09-29) — **verificado** (nota de verificación debajo de la tabla) |
| 4 | **7.1b** — prorrateo por días en las dos direcciones | `domain.py:178-234` | quitar el día 20 → `11/30`; dar el día 20 → `19/30` | ✅ **hecho** (2026-09-29) — **verificado** (nota de verificación debajo de la tabla) |
| 5 | **7.1c** — restaurar precio de PT al quitar el pase | `domain.py:240-263` | los ítems de actividad/outing/PT se restauran prorrateados en **un solo loop** con `_item_contract_price` | ✅ **hecho** (2026-09-29) — **verificado** (nota de verificación debajo de la tabla) |
| 6 | **7.1d** — `_neutralize` + su gemela de restauración | `domain.py:388-481` | los 3 tipos de paquete, ida y vuelta | ✅ **hecho** (2026-09-29) — **verificado** (nota de verificación debajo de la tabla) |
| 7 | **7.3a** — migración del snapshot de descuento | `subscriptions/0022` | snapshot escrito en `open_subscription` | ✅ **hecho** (2026-09-29) — **verificado** (nota de verificación debajo de la tabla) |
| 8 | **7.3b** — migración del crédito | `payments/0013` | `concept="credit"` + `applied_to` | ✅ **hecho** (2026-09-29) — **verificado** (nota de verificación debajo de la tabla) |
| 9 | **7.3c** — crear, consumir y exponer el crédito | `services.py:298-323`, `create_next_subscription` | invariante: se crea **y se consume solo** en la renovación, **por los dos caminos** (caída del total y pago mayor al total) | ✅ **hecho** (2026-09-29) — **verificado** (nota de verificación debajo de la tabla) |
| 10 | **7.4** — arreglos de texto a este documento | `PLAN-dinero.md` | — | ✅ **hecho** |

**Nota de verificación de las filas 3-9** (las que decían "sin verificar" hasta el 2026-10-02).
La verificación existe, pero no como una corrida única: quedó registrada en los mensajes de los
commits que harpata. `a000871` (*el prefetch no puede ocultar relaciones filtradas*) reporta
`manage.py test subscriptions members` → **66 tests**, y dice que los 2 `ERROR` de
`CourtesyPassToggleOrderTests` se van y que los 6 rojos que quedaban eran **tests mal seteados**
—no bugs de código— y que los 4 preexistentes de `members` seguían igual. `9a051c8` (*acreditar
sólo el crecimiento del sobrepago*) reporta `manage.py test subscriptions` → **53 tests, 52
pasan**, y el único rojo restante era `test_legacy_period_without_snapshot_keeps_live_discount`,
que leía un `Discount` cacheado de antes de desactivarlo. `ab56e53` corrigió ese test y movió el
gate a Postgres real. Los 6 rojos "mal seteados" de `a000871` son exactamente los que cerraban
`9a051c8` y `ab56e53`.

Lo que **no** hay es una corrida posterior a `15bce65` (los tests de la matriz del toggle): el
gate quedó pendiente. Tampoco la hay desde los 8 tests que CI no corre — ver sección 5.

### Verificación que quedó abierta desde las Fases 0-6

| # | Qué | Gate | Estado |
|---|---|---|---|
| 11 | **Corrida real del `TaskRun` en producción** | `last_status = "ok"` y `last_duration_seconds < 15`, más confirmar con el usuario que el 502 de las 6h desapareció | ⬜ **abierto desde el 2026-09-28**. Requiere un request real que dispare el middleware. El SQL está en la sección 5, punto 4 |

### Decisiones de negocio (no son código)

| # | Qué | Quién decide | Estado |
|---|---|---|---|
| 12 | **Los 45 socios de `Gym Demo` congelados** desde junio por H1 | Negocio. Se reactivan con `recover_member`, **nunca** con el auto-renovador | ⬜ sin decidir |
| 13 | **Deuda de los 38 bloqueados** (3.659.100) | Negocio. Decisión 2 de la sección 2: no se cobran | ⬜ sin decidir |
| 14 | **Backfill de `discount_percent_snapshot`** para las suscripciones ya abiertas | Sólo hace falta con socios reales. Hoy `Sinkro` está en 0, así que es inocuo | ⬜ condicionado |
| 15 | **Ítems históricos de Diego Salvado** (socio 827, julio y agosto, 25.000) | Fuera de alcance por decisión explícita: sólo se reportan, no se tocan | ✅ decidido |

### Bloqueado por información externa

| # | Qué | Falta | Estado |
|---|---|---|---|
| 16 | **Los 8 números `#32, #30, #35, #18, #40, #38, #33, #37`** | No existen en el código (0 resultados). El audit sólo implementa `#1, #2, #4, #5, #6, #19, #48`. Hace falta el listado original para saber a qué se refieren | ⬜ **unknowable**. Sección 6 |

### Fase 8 — mapeada, sin fecha

Los 9 bugs MEDIO y BAJO (P8-P16) están documentados uno por uno en la tabla al final de la
sección 3, con ubicación y severidad. **Ninguno entra en la Fase 7.** Cuando se retome:

1. **8.0** — métricas propias primero, igual que la 7.0, con el mismo esquema de
   `confirmados`/`armados` (sección 1.9).
2. P9, P10 y P11 son **feature work de running, no de dinero**: no-asistencia y recuperación
   para salidas, el guard `other_active` que PT tiene y outings/actividades no, y el consumo
   de sesión de outing en el panel de staff. Merecen su propio plan, no una cola más.
3. P13, P14 y P15 son de bajo riesgo y se pueden agrupar en una sola fase de higiene.
4. **P16 (agregado el 2026-09-30) es de dinero y va antes que los de higiene**: es el único de
   esta lista que **deja de cobrar** plata, y encima está en la línea que la Fase 2 escribió, así
   que se lee como correcto. Necesita un test propio que arme crédito abierto + total que sube, y
   el arnés de la 8.0. Detalle en "P16 en detalle", sección 3.
5. El fix de performance del dashboard (sección 3-bis) **también bajó el costo de P16 sin
   arreglarlo**: el helper nuevo `consumed_credit_by_subscription` tiene el `applied_to` correcto,
   así que cuando se arregle P16 ya hay un único lugar donde cambiarlo.

---

## 1. Contexto verificado

### 1.1 Entornos

| Entorno | Host Neon | Estado |
|---|---|---|
| Staging | `green-sea-aqmezbmg-pooler.c-8.us-east-1.aws.neon.tech` | rama `development` |
| Producción | `round-sunset-aq8oo16v-pooler.c-8.us-east-1.aws.neon.tech` | rama `main` |

Son **ramas independientes de Neon**, no un clon. Ambas se llenaron corriendo el mismo
seeder (`manage.py seed_demo_data --gym <slug>`, con fechas relativas a `--reference-date`,
default *hoy* — ver `backend/seed/base.py:31` y `backend/gyms/management/commands/seed_demo_data.py:26`).

Pruebas de que no es clon:
- 22 de 23 gyms tienen la **misma fecha de creación** en ambas bases (se crearon el mismo día).
- `Sinkro` tiene fecha **distinta**: staging 2026-09-04, producción 2026-09-18.
- `Sinkro2` existe sólo en producción.

**Conexión**: pooler Neon en **transaction mode** — `config/settings.py:303` literalmente
dice *"Neon PgBouncer pooler (transaction mode)"* con `conn_max_age=0`. PgBouncer devuelve la
conexión del servidor al pool al terminar cada transacción del cliente. **Consecuencia**: un
advisory lock **de sesión** vive en la conexión del servidor, puede quedar tomado y ser
reasignado a otro cliente, y el `finally` no lo libera si el proceso muere. Cualquier lock
tiene que ser por `UPDATE`/claim sobre `TaskRun`, nunca por advisory lock de sesión.

`development` no tiene acceso directo; se usa el pooler desde la máquina local.

**Credenciales**: la URL de producción está en `backend/.env.audit-prod` (ignorado por
`.gitignore`, regla `.env.*`). No imprimir ese archivo, no commitearlo, no copiar su valor a
ningún lado.

```bash
# staging (usa backend/.env)
cd backend && .venv/bin/python manage.py audit_money_bugs

# producción
cd backend
set -a; . ./.env.audit-prod; set +a
export DATABASE_URL="$DATABASE_URL_PROD"
export ENVIRONMENT=production
.venv/bin/python manage.py audit_money_bugs
unset DATABASE_URL DATABASE_URL_PROD
```

El valor debe ir entre comillas simples: contiene `&`.

> **`ENVIRONMENT` hay que setearlo también contra producción** (2026-09-29). El guard de
> `config/settings.py` era *ciego al host*: dispara el aviso "STAGING CHECK" con sólo mirar
> `ENVIRONMENT == "staging"` y que la base se llame `neondb`, que es el nombre en **las dos**
> ramas. Corriendo el audit de producción sin `ENVIRONMENT=production` salía un aviso que decía
> que estás contra la base de staging cuando estás contra la de producción — y viceversa. La
> única línea que decía la verdad era el `DB host` que imprime el propio comando.

**Corregido** (2026-10-01). El check ahora compara el **endpoint**, que en Neon es único por
branch, en vez del nombre de la base. `config/neon.py:neon_endpoint_role` hace el matching contra
`NEON_ENDPOINT_STAGING` / `NEON_ENDPOINT_PRODUCTION` (defaults: `green-sea-aqmezbmg` y
`round-sunset-aq8oo16v`), y tanto el aviso de arranque como `manage.py check_environment`
distinguen los tres casos que antes no distinguían:

| Config | Resultado |
|---|---|
| staging → `green-sea` | consistente |
| staging → `round-sunset` | **MIX DE BASE** (antes: un aviso genérico) |
| producción → `green-sea` | **MIX DE BASE** (antes: "parece consistente") |
| host no reconocido | "no pude validar", explícito |

Verificado contra el `DATABASE_URL` real de staging: `Consistente: ENVIRONMENT=staging y el host
es la branch de staging`. **Staging y producción no comparten base.** Antes de este commit el
`check_environment` salía con "Config de entorno/db parece consistente" incluso con staging
apuntando a producción, que es justo el error que dice detectar.

### 1.2 Resultados de la auditoría de la Fase 0 (0 escrituras, ambos ambientes)

| Métrica | Staging | Producción |
|---|---|---|
| Socios activos | 147 | 148 |
| Candidatos vencidos con `auto_renew` | 371 | 371 |
| #2 PT activo sin ítem de PT | 0 | 0 |
| #4/#6 socios atrapados (sin suscripción + deuda) | 81 | 79 |
| #5 PlanChangeRequest approved con `effective_date` vencida | 0 | 0 |
| #19 candidatos en gym con `active=False` | 94 | 94 |
| #48 socios `is_comp` con total > 0 | 0 | 0 |
| Queries / escrituras detectadas | 1.346 / **0** | 1.332 / **0** |

La auditoría es estrictamente de lectura: corre dentro de `transaction.atomic()` con
`transaction.set_rollback(True)` y `force_debug_cursor`. `Ctrl+C` es seguro.

**Limitación**: el audit cuenta `filter(end_date__lt=today, auto_renew=True)` y nada más.
**No modela los guards reales** (plan base, `member.active`, pago al vencimiento), así que
sus conclusiones ("44 pérdidas", "39 renovaciones") son proyecciones de datos crudos, no el
comportamiento del código. La verificación autoritativa es el arnés de la Fase 1.

### 1.3 Realidad de los datos

3 gyms activos:

| id | Nombre | Creado | Socios | Activos | Suscripciones |
|---|---|---|---|---|---|
| 9 | Gym Dev | 2026-06-23 | 62 | 56 | 213 |
| 10 | Gym Demo | 2026-06-23 | 50 | 45 | 95 |
| 49 | **Sinkro** | 2026-09-18 | **0** | 0 | 0 |

Los otros 21 gyms están desactivados y son de prueba (`Test`, `V`, `V2`, `prueba`,
`Debug Gym`, `Sinkro Prueba`, `Pepito`, etc.).

**El negocio real (`Sinkro`) está vacío.** Todo el radio de impacto hoy es data de pruebas,
la ventana más barata posible para corregir. `#56` (los 502 cada 6h) es un riesgo real incluso
con cero socios y golpea justo cuando `Sinkro` entre en producción (ver 1.6).

No borrar ni tocar los 21 gyms de prueba: no es necesario para este plan.

### 1.4 Los hallazgos centrales de la revisión

Todos medidos contra staging el 2026-09-28, con el código real y no con el audit:

**H1 — El bug de dinero: `_find_already_renewed_members` devuelve `member_id`, no períodos.**

`backend/subscriptions/services.py:1038-1060`. El overlap ya está bien implementado
(líneas 1055-1057: `start_date__lte=target_end AND end_date__gte=target_start`), pero el
resultado se colapsa a un **set de `member_id`**. Si un candidato del socio está cubierto, se
saltean **todos** los candidatos de ese socio (`services.py:1267`).

Probado sobre `Gym Demo` (socio 725, `paid=True` en ambas):

```
sub 1295 [2026-05-01..2026-05-31] paid=True -> target junio  SALTADO  (legítimo: existe la sub de junio)
sub 1294 [2026-06-01..2026-06-30] paid=True -> target julio  SALTADO  (BUG: no hay sucesora de julio)
Gym Demo: 85 candidatos -> 45 member_ids -> 85 saltados -> 0 renovados
```

**45 socios pagados de `Gym Demo` están congelados desde junio.** La nueva suscripciones
nunca se crean y cada corrida reporta `renewed: 0, skipped_already: 237`: "éxito" mientras no
hace nada. El socio 801 (Gym Dev) no está congelado porque tiene una sola suscripción vencida
sin sucesora; por eso el bug era casi invisible.

**H2 — `auto_renew` nunca se limpia.**

`create_next_subscription` (`services.py:875`) hereda el flag al hijo (`auto_renew=expired_sub.auto_renew`)
y **nunca lo baja en el padre**. De los 371 candidatos crudos, **235 (63%) son suscripciones
ya renovadas** que vuelven al pool para siempre. Es lo que hace que la corrida crezca mes a
mes y que el `skipped_already: 237` se mantenga estable aunque nadie renueve.

**H3 — El tiempo se consume en el collector.**

`TaskRun` de staging: **91,7 s contra `--timeout=120`**, con `renewed: 0`. Causa:
`_collect_renewal_candidates` (1.235 queries, 5,2 por candidato, 189 s medidos a 151 ms/query
de latencia contra el pooler). Las otras dos tareas suman 2,3 s (plan changes 0,31 s / 1 query;
no-show 1,99 s / 13 queries). Sin el fix, la corrida cruza los 120 s, gunicorn mata el worker,
Postgres revierte las escrituras incluido el `last_run` y el siguiente request reintenta:
ciclo.

**H4 — Los 502 "cada 6h" no son un OOM.**

`middleware.py:31` dispara la tarea **en el hilo del request, después de `get_response` pero
antes de que el framework envíe la respuesta**. Con 91,7 s de corrida, el POST espera los
91,7 s y el proxy responde 502 antes que gunicorn (120 s). No es el OOM del worker separado
(ese worker ya no existe). Con la Fase 2 la corrida pasa a segundos y el síntoma desaparece.

#### Funnel medido (371 crudos, código real)

> **Números corregidos 2026-09-28.** Esta tabla y la de "renovaciones esperadas" más abajo
> tenían los conteos de un borrador que mezclaba el corte de la métrica #19 con el orden de
> guards. El orden real (Fase 2) pone el **guard de mes cerrado antes que el de gym inactivo**,
> y por eso los inactivos son 7 y no 51. La referencia autoritativa es la sección 5.

| Etapa | n |
|---|---|
| con sucesora que cubre el target (se limpian) | 235 |
| sin sucesora (a evaluar) | 136 |
| → target en un mes ya cerrado (`skipped_stale_backlog`, se limpian) | 90 |
| → target en el mes en curso | 46 |
| → de esas 46: gym inactivo (`skipped_inactive_gym`) | 7 |
| → socio inactivo (`skipped_inactive_member`) | 0 |
| → bloqueadas por impago al vencimiento (`skipped_blocked`) | 38 |
| → **candidatos que pasan todos los guards** | **1** |

El único candidato es el **socio 801 de `Gym Dev`**, target septiembre, 220.000 pagados: la
única renovación esperada. Los otros 45 de `Gym Demo` caen en el corte de mes cerrado (90),
que es donde H1 los dejaba congelados.

Deuda de los bloqueados: 3.659.100 medidos sobre el corte previo a la Fase 2 (43 candidatos,
38 en gyms activos y 5 en inactivos), **0 con pagos posteriores al vencimiento**. Bajo el
orden de guards vigente el corte es 38. Es la política de `access_block_day`, no un bug.

Los socios 812, 785, 793 y 829 (Gym Dev) tienen septiembre cubierto **sólo por overlap a
mitad de mes** (sucesora que empieza el 3, 17, 18 y 17): si el keying de skip pasa a ser por
fecha exacta, se les crearía una segunda suscripción de septiembre. Por eso el skip sigue
siendo por overlap.

#### Números de renovaciones esperadas (post fases)

| Etapa | n |
|---|---|
| candidatos crudos | 371 |
| `covered` + `auto_renew=False` | 235 |
| `skipped_stale_backlog` + `auto_renew=False` | 90 |
| `skipped_inactive_gym` (no se limpia) | 7 |
| `skipped_inactive_member` | 0 |
| `skipped_blocked` (no se limpia) | 38 |
| **candidatos evaluados** | **1** |
| **`renewed`** | **1** (socio 801, Gym Dev, 220.000 pagados) |
| `skipped_already` (post-Fase 6) | 193 |

**Invariante: los contadores suman 371**: `235 + 90 + 7 + 0 + 38 + 1 = 371`. Si no, el fix
está mal. (`skipped_already` va aparte: es un desglose del loop, no una etapa del funnel, y por
eso no participa en la suma. Venía de 237 antes de las Fases 3-6.)

El pool queda estable en ~46 filas (7 gyms inactivos + 38 deudores + la rotación mensual) en
vez de crecer 40-50 por mes. Las 7 de gyms inactivos y las 38 de deudores **no** se limpian a
propósito: si el gym se reactiva o el deudor paga, la corrida los renueva.

### 1.5 Hallazgo colateral de #48

El único socio `is_comp` de producción (Diego Salvado, id 827, gym 9) tiene las suscripciones
de julio (`id=1475`) y agosto (`id=1557`) con un ítem `plan` **activo de 25.000** y `paid=True`.
La de septiembre (`id=30628`) está limpia, con ítems a 0,00.

El audit da #48 = 0 porque sólo mira el mes actual. La protección actual es de **lectura**:
`subscription_remaining_balance` (`services.py:296-303`) fuerza `remaining = 0` para socios
`is_comp`. Eso protege las pantallas de deuda, pero `calculate_subscription_total` sigue
devolviendo 25.000. **No tocar esos ítems sin autorización aparte**; sólo reportarlos.

### 1.6 Ya implementado — NO rehacer

- `Procfile`: un solo proceso web, `gunicorn --workers=1 --timeout=120 --max-requests=1000 --max-requests-jitter=50`.
  El worker separado (que era lo que sufría el OOM cada 6h) ya no existe.
- `backend/config/api/middleware.py`: `ScheduledTaskTriggerMiddleware`, disparo perezoso.
  **Decisión: se queda como está**; con la Fase 2 la corrida baja a segundos y el 502
  desaparece. No se mueve a un cron externo ni a un thread en esta iteración.
- `services.py:1337` `maybe_run_scheduled_tasks`: camino barato sin lock.
- `services.py:1081` `_apply_all_due_plan_changes`: **cierra #5**. Los plan changes vencidos se
  aplican para todos los socios, no sólo los candidatos de renovación.
- `services.py:1159` `apply_plan_change`: idempotente y atómico.
- `models.py:58-63`: `unique_subscription_member_period` + `CheckConstraint` `end_date >= start_date`.
- `models.py:158-163`: un `PlanChangeRequest` pending por socio.
- Los 15 commits de seguridad (`98e72e2`, `4b6503e`, `d4ede6d`, `6e16b4a`, `90871d6`, etc.).

### 1.7 Alcance de este plan — RESUELTO en las Fases 0-6

> Esta sección decía antes "Pendiente — el alcance real de este plan" con los 6 puntos abiertos.
> Los 6 están cerrados. Se conserva el listado como índice de qué hizo cada fase.

1. `_find_already_renewed_members` (hoy `_find_covered_periods`): devolvía `member_id` en vez
   de períodos → **H1**, 45 socios congelados. Más el OR de 371 clauses (742 parámetros).
   **→ Fase 3.**
2. `create_next_subscription`: no limpiaba `auto_renew` del padre → **H2**, 235 filas fantasma
   que crecían mes a mes. **→ Fase 2** (pasada 0).
3. `_collect_renewal_candidates`: N+1 y latencia → **H3**, el timeout de 120s.
   **→ Fase 2** (precomputación de ids de plan base, `remaining`, `is_first` e ítems).
4. `run_scheduled_tasks`: un único `transaction.atomic()` con lock *transaction-scoped*. Un
   timeout de 120s revertía todas las renovaciones. **→ Fase 4**: claim atómico por `UPDATE`
   sobre `TaskRun` y `atomic()` por socio.
5. `management/commands/auto_renew_subscriptions.py:15` llamaba `auto_renew_subscriptions()`
   directo y salteaba el lock. **→ Fase 4**: pasa por `run_scheduled_tasks(force=True)`.
6. #2 y #48: sólo había guard de lectura. **→ Fase 5** (guard de escritura).

**Lo que este plan NO cubrió, y es donde nació la Fase 7:** el pase de cortesía se declara
cerrado en la Fase 5, pero su verificación fue `audit_money_bugs` (#2 = 0, #48 = 0), y ese
audit sólo mira el mes en curso. La Fase 7 encuentra cuatro bugs de escritura **en el mismo
flujo** que la Fase 5 afirmó cerrado. Ver `Fase 7.1`.

El análisis completo de **por qué** esos tres criterios no podían ver los bugs —con el código
citado, las trazas paso a paso y las tres reglas que se extraen— está en la **sección 1.9**.

**La "Fase 3 vieja" de este documento (lock de sesión y keying por fecha exacta) queda
descartada**: el keying del código ya es por overlap (H1 es sólo el tipo de retorno), y el
lock de sesión es incompatible con PgBouncer transaction mode (ver 1.1).

### 1.8 Infraestructura de tests

- `backend/core/testing.py`: `BaseAPITest` con `create_gym`, `create_member`, `create_plan`,
  `open_month_subscription`, `settle_subscription` y `last_month_period`.
- `backend/subscriptions/tests.py`: 7 tests existentes a preservar — 4 en
  `ScheduledTaskRunnerTests` (incluido `test_lock_beats_concurrent_workers`) y 3 en
  `ScheduledTasksEndpointTests`.

**Ojo con el test de lock**: `services.py:1330` hace que los paths no-Postgres de
`_acquire_task_lock`/`_release_task_lock` sean no-op (`return True`), así que en SQLite
`test_lock_beats_concurrent_workers` pasa sin lock; y aun en Postgres llama dos veces
**secuencialmente** y sólo asserta `last_status == "ok"`. No verifica concurrencia. Con el
claim atómico de la Fase 4, el `update()` funciona en SQLite y el test se puede escribir de
verdad.

```bash
cd backend && .venv/bin/python manage.py test subscriptions
```

---

### 1.9 Por qué la verificación de la Fase 5 no podía ver lo que dejó

La Fase 5 construyó bien sus dos guards. El problema fue **cómo verificó que estaban bien**,
y de ahí salieron los 4 bugs de dinero de la Fase 7. Esta sección existe para que la Fase 8 no
repita el mismo patrón.

El criterio de aceptación de la Fase 5 fue:

```
audit_money_bugs:  #2 = 0  (147 socios activos revisados)
                   #48 = 0  (deuda fantasma en la suscripción vigente)
```

más el punto 3: *"el grep de `is_comp` no dejó ninguna vía suelta"*.

Los tres criterios fallaron por razones distintas. Ninguna es culpa de quien los escribió: son
todas **fallos de método**, y por eso son corregibles.

#### Razón 1 — el contador #48 es unidireccional

`backend/subscriptions/management/commands/audit_money_bugs.py:172`:

```python
if member.is_comp and calculate_subscription_total(subscription) > 0:
    comp_with_total.append(member.id)
```

Pregunta *"¿a un cortesía le están cobrando?"*. **Nunca pregunta** *"¿a un socio que paga le
están cobrando de menos?"*.

| Dirección del error | ¿Lo ve el contador? |
|---|---|
| Dar el pase y que quede con precio de pago | ✅ Sí — cortesía con total > 0 |
| **Quitar el pase y que quede en $0** | ❌ **No puede verlo** — ya no es cortesía, la línea ni se ejecuta |

El bug que de verdad cuesta plata al gym —el subcobro— está **fuera de la métrica por
construcción**. No es que no se activara: es que es matemáticamente invisible para ese
contador.

> **Regla permanente**: `audit_money_bugs` con `#48 = 0` **no** prueba que el toggle del pase
> de cortesía sea correcto. No usarlo como criterio de aceptación de nada que toque
> `mutate_membership`. Para eso existen los tests de la Fase 7.1.

#### Razón 2 — sólo mira el mes en curso

`audit_money_bugs.py:159`:

```python
subscription = SubscriptionDomain.get_current_subscription(member)
if subscription is None:
    ... chequear "atrapado" ...
    continue
```

Sólo la suscripción que cubre hoy. El propio plan ya lo reconoce en la sección 1.5: *"El
audit da #48 = 0 porque sólo mira el mes actual"* — y los 25.000 de Diego Salvado en julio y
agosto son **exactamente la misma clase de bug que nunca se corrigió**. La Fase 5 se verificó
con una métrica que no podía ver su propio hallazgo histórico.

#### Razón 3 — un `0` es un dato, no una prueba de código

En staging no había ningún socio cortesía en la situación rota, y ningún servicio de PT
configurado a la vez como mensual y por sesiones. Por eso los contadores dieron 0. Eso es un
**dato válido y bien medido**. Lo que no se puede concluir es *"el código está bien"*: son dos
afirmaciones distintas y sólo la primera se midió.

El propio plan lo dice y no lo reconoce: la Fase 5 anota *"Preventivo puro: hoy 0"* — o sea,
el código se construyó para un caso que todavía no había pasado. Fue una decisión buena.
El error fue usar ese `0` como cierre.

> **Regla permanente**: un `0` de un contador prueba que **los datos están limpios**, no que el
> **código sea correcto**. Para probar código hay que un test que ejercite el camino roto, o un
> contador que también reporte cuántos casos están *armados*.

#### Razón 4 — un grep no ve el orden

*"El grep de `is_comp` no dejó ninguna vía suelta"*. Un grep responde **¿aparece la palabra
acá?**. No responde **¿está en el orden correcto?**.

El bug es este, en `members/serializers.py:566-591`:

```
línea 576   ¿cambió el pase?              → sí
línea 579   llamo a mutate_membership     → ACÁ se calculan los precios
      ↓
      14 líneas de distancia
      ↓
línea 590   recién ahora guardo is_comp = True
```

Las dos menciones de `is_comp` están presentes. El grep queda satisfecho. El bug vive **en las
14 líneas del medio**, que es justo lo que un grep no lee.

Y el caso de P6 es el otro extremo: ahí `is_comp` **sí** está en el código, dentro de la rama
`if comp:`. El grep pasa. Pero el archivo tiene un **conjunto asimétrico de loops** (tres
restauran, falta el cuarto) y un grep no cuenta loops.

> **Regla permanente**: para un guard de escritura, `grep` sirve para encontrar *dónde se
> toca* el flag. Para probar que el guard está *completo*, hay que enumerar a mano todos los
> caminos que escriben y revisar cada uno.

#### La lección, en una línea

**Medir datos no es medir código.** Y cuando el radio de impacto es cero por falta de socios
reales, todo `0` es ambiguo: no sabemos si el bug no existe o si nunca se ejercitó. De ahí la
exigencia de la Fase 7.0 de reportar también los casos *armados*.

---

## 2. Decisiones cerradas

Confirmadas por el usuario (2026-09-28):

1. **Períodos perdidos: NO se rellenan.** Si el target es un mes ya cerrado y no hay
   sucesora, no se crea nada, se baja `auto_renew = False` y se cuenta en
   `skipped_stale_backlog`. No se fabrica historial ni suscripciones impagas retroativas
   (eso recrea el bug #6).
2. **Los bloqueados por impago NO se renuevan.** El guard de `access_block_day` se mantiene.
   Sus suscripciones **no** se limpian: si pagan, la corrida siguiente los renueva.
3. **El trigger sigue siendo el middleware inline.** Con la Fase 2 la corrida pasa a segundos
   y el 502 desaparece. No se agrega cron externo ni thread en esta iteración.

Implícitas del plan:

- **#19**: un gym desactivado **NO** renueva a sus socios. Se saltean y se cuentan
  (`skipped_inactive_gym`). **No** se baja `auto_renew`: si el gym se reactiva, vuelven.
- **#1**: el skip es **por período con overlap**, no por `member_id` ni por fecha exacta. El
  overlap ya lo hace el código; lo que cambia es el tipo de retorno y la query.
- **#2 y #48**: guard de escritura (el dato sucio no entra) **más** el guard de lectura
  existente como red. Sin cambios a datos históricos.
- **Lock**: claim atómico por `UPDATE` sobre `TaskRun` con `last_status="running"`, no
  advisory lock de sesión.
- **`atomic()` gigante**: se saca; `create_next_subscription` ya es atómico por socio. Un
  timeout pierde una renovación en vez de 371.
- **Auditoría**: no se vuelve a derivar; se le agrega una nota que dice que no modela los
  guards y que apunta al arnés de la Fase 1.
- **Alcance**: las 6 fases, en orden. **Commit**: uno por fase.

---

## 3. Fases

### Fase 0 — Corregir la métrica del audit — ✅ CERRADA (`bf6b28a`)

**No rehacer.** Commit `bf6b28a` en `development`, docs en `0d76102`.

Resultado medido (staging y producción dan lo mismo en estos conteos):

| Métrica | Valor |
|---|---|
| candidatos vencidos | 371 |
| **hoy** se renuevan | 13 |
| **hoy** salteados por tener el socio ya renovado | 123 |
| **post #1** saltados OK (sucesora en su propio período) | 235 |
| **post #1** sin sucesora | 136 |
| → target en el mes en curso | 46 |
| → target en meses ya cerrados (rezago inerte) | 90 |
| #19 candidatos totales en gym inactivo | 94 |
| #19 sin sucesora en gym inactivo | 51 |
| #48 deuda fantasma vigente | 0 |
| #48 ítems pagados en periodos cerrados | 2 (socio 827) |
| Queries / escrituras | 1.347 / **0** |

**Nota post-revisión (2026-09-28)**: los dos conteos de la columna "hoy"/"post" se verificaron
contra el código real. El "hoy se renuevan 13" del audit corresponde a la proyección cruda; la
medición real dio `TaskRun.last_result = {"renewed": 0, "skipped_already": 237}`. La causa es
H1: los 13 que parecían renovar en realidad caen en el set de `member_id` (ver 1.4).

---

### Fase 1 — Arnés de verificación `audit_renewal_dryrun` — ✅ HECHO (`d14dfc9`)

**Archivo nuevo**: `backend/subscriptions/management/commands/audit_renewal_dryrun.py`

Hoy no hay forma de verificar nada: el audit existente nunca llama a `auto_renew_subscriptions`,
así que sus números no cambian con el fix y el criterio "pasa" siempre. Y H1 es invisible salvo
contando renovaciones por socio, que el `TaskRun` no hace.

El comando replica el patrón de `audit_money_bugs.py:256-266`: `force_debug_cursor`,
`connection.queries_log.clear()`, `transaction.atomic()` + `transaction.set_rollback(True)`,
y verifica que no haya escrituras. Dentro llama a `auto_renew_subscriptions()` — **no** a
`run_scheduled_tasks`, para no tocar el lock ni el `TaskRun` — e imprime:

- los contadores que devuelve,
- `len(connection.queries)` y duración,
- el desglose por guard,
- los `member_id` que se van a renovar, para cruzarlos contra suscripciones existentes,
- las escrituras detectadas (debe ser 0).

Es seguro por la misma razón que el audit: `create_next_subscription` abre savepoints dentro
de la transacción externa y el rollback final descarta todo, incluidas las escrituras de
`_apply_all_due_plan_changes`.

**Criterio de aceptación** (primer uso = línea base "antes"):
- `renewed: 0`, `skipped_already: 237`, `failed: 0` — idéntico a `TaskRun.last_result`.
- `Escrituras detectadas: 0`. Reporta ~1.235 queries y ~90-190 s.
- **Los 40 de `Gym Demo` pagados no aparecen en ninguna lista de renovación.** Si el arnés no
  los expone, el arnés está mal.

**Commit**: `chore(audit): arnés read-only para verificar el código real de renovación`

---

### Fase 2 — Performance: limpiar `auto_renew`, eliminación del N+1, orden de guards — ✅ HECHO (`51022c1`)

**Archivos**: `subscriptions/services.py` (`_collect_renewal_candidates:990`),
`plans/services.py` (nuevo `base_plan_ids_for_gyms`)

Hoy el loop hace, por cada uno de los 371 candidatos, 1 query de `get_base_plan_for_gym` +
~2,3 de `get_subscription_payment_status`.

1. **Pasada 0 — cobertura y limpieza.** Antes de cualquier guard, una query de rango acotada
   sobre las ventanas de los candidatos. Para cada candidato cuya ventana esté cubierta por
   una sucesora: `covered += 1` y `auto_renew = False` en un `UPDATE` bulk. Esto colapsa
   371 → 136 y es la causa del crecimiento mes a mes (H2). La limpieza es
   **incondicional**: no importa el estado del socio ni del gym. El contador `covered` es
   nuevo: `skipped_already` (del loop) no se toca aquí, lo cambia la Fase 3.
2. **Pasada 1 — guards, del más barato al más caro**, sobre lo que queda:

   ```python
   target_start = get_first_day_of_next_month(sub.end_date)
   if target_start < month_start:            # aritmética pura
       counters["skipped_stale_backlog"] += 1; stale.append(sub); continue
   if not sub.gym.active:                    # select_related
       counters["skipped_inactive_gym"] += 1; continue
   if base_plan_ids.get(sub.gym_id) == sub.plan_id and not sub.gym.allow_activity_without_membership \
           and not sub.member.is_comp:
       counters["skipped_base_plan"] += 1; continue
   if not sub.member.active:                 # select_related
       counters["skipped_inactive_member"] += 1; continue
   if get_subscription_payment_status(sub, at_date=sub.end_date,
                                      remaining=prepaid[sub.pk],
                                      is_first=prepaid_first.get(sub.member_id)) == "blocked":
       counters["skipped_blocked"] += 1; continue   # NO se limpia: puede recuperar si paga
   ```

   `stale` se agrega al `UPDATE` bulk de `auto_renew = False` junto con las de la pasada 0.
   **Importante**: el guard de mes cerrado va **después** de la cobertura (pasada 0) —
   primero se decide si ya fue renovada, y sólo si no lo fue se decide si es rezago inerte.
   Y va **antes** del check de pago, que es lo caro.
3. **Precomputar lo caro una sola vez, sobre la lista ya acotada**:
   - ids de plan base: 1 query
     `MembershipPlan.objects.filter(gym_id__in=..., is_base=True).values_list("gym_id", flat=True)`
     (reemplaza 371 queries).
   - `remaining` por suscripción: 1
     `Payment.objects.filter(subscription_id__in=...).values("subscription_id").annotate(Sum("amount"))`.
     `get_subscription_payment_status` ya acepta `remaining` (`services.py:726`).
   - `is_first`: 1 `Min("created_at")` agrupado por `member_id` (también ya aceptado).
   - `items`: `prefetch_related("items")` en el queryset de candidatos, porque
     `calculate_subscription_total` (`services.py:184`) hace `subscription.items.all()`.
     **Es un N+1 real, no un "a verificar".**
4. `_collect_renewal_candidates` devuelve `(candidates, counters)`; `auto_renew_subscriptions`
   agrega los contadores nuevos al dict de `TaskRun.last_result` **sin tocar** `renewed` /
   `skipped_already` / `failed`.

**Criterio de aceptación** (staging, vía el arnés de la Fase 1; verificado 2026-09-28):
- Queries **≤ 40** (de 1.235): medido **12**. Duración **< 10 s** (de 90-190 s): medido **2.2 s**.
- `renewed: 0`, `skipped_already: 237`, `failed: 0` — sin cambio (el arnés da **SÍ** contra
  `TaskRun.last_result`). El `UPDATE` bulk aplica `auto_renew = False` sobre los 136
  (235 covered + 90 stale); el arnés reporta esa única escritura, rolada.
- Contadores nuevos (suman 371): `covered 235`, `stale 90`, `gym 7`, `member 0`,
  `blocked 38`, `candidatos 1`. (Los números del borrador — `stale 40 / gym 51 / member 1 /
  blocked 43` — mezclaban cortes de la métrica #19 con el orden de guards de esta fase; el
  arnés es la referencia correcta y coincide con el funnel original: 90 en mes cerrado y
  46 en el mes en curso: 7 gym + 38 blocked + 1 candidato.)
- El conjunto de candidatos es **idéntico** (mismos pks) antes y después: cambiar el orden de
  guards cambia los contadores, pero no la lista final (el único candidato sigue siendo el
  sub 1509 / member 801).

**Riesgo**: el `UPDATE` bulk es la primera escritura real del proceso. Por eso la Fase 1 va
antes y verifica 0 escrituras.

**Commit**: `perf(subscriptions): limpiar auto_renew al renovar y eliminar el N+1 de candidatos`

---

### Fase 3 — #1: skip por período, no por socio — ✅ HECHO (2026-09-28)

**Archivo**: `subscriptions/services.py` (`_find_already_renewed_members:1038` →
`_find_covered_periods`; loop en `auto_renew_subscriptions:1266`)

La Fase 2 ya usa la estructura de la pasada 0; acá se completa para que cada candidato se
juzgue sobre **su propia ventana**.

1. Reemplazar el OR de 371 clauses por una query de rango delimitada por el rango global de
   los candidatos:

   ```python
   Subscription.objects.filter(
       member_id__in=member_ids,
       start_date__lte=max_target_end,
       end_date__gte=min_target_start,
   ).values_list("member_id", "start_date", "end_date")
   ```

   De 742 parámetros a ~16. El overlap se evalúa en Python por candidato
   (`any(s <= target_end and e >= target_start ...)`) y devuelve
   `dict[member_id] -> [(start, end)]`, **no** un set de tuplas.
2. En el loop, el skip es `if ventanaCubierta(expired_sub.member_id, target_start, target_end)`.
   Ése es el cambio de una línea que destraba a los 45 socios de `Gym Demo` (H1).
3. **Guard de duplicados en la misma corrida**: set de `(member_id, target_start)` atendidos,
   sembrado con los ya cubiertos y con los creados en la corrida. Hoy hay 0 casos, pero
   `unique_subscription_member_period` (`models.py:58-62`) es real y dos suscripciones del
   mismo socio que vencen el mismo mes colisionarían.
4. Preservar `_apply_due_plan_changes(member_id)` en la rama de skip (`services.py:1269`):
   es la red de #5 por socio.
5. Docstring del audit (línea 58): aclarar que **no** modela los guards y que la verificación
   es el arnés de la Fase 1.

**Criterio de aceptación** (staging, vía el arnés de la Fase 1; verificado 2026-09-28):
- `renewed: 1` y el único `member_id` es **801**. Los contadores suman 371.
- Contadores con el orden de guards de la Fase 2 (el arnés como referencia):
  `covered 235`, `stale 90`, `gym 7`, `member 0`, `blocked 38`, `candidatos 1`,
  `skipped_already 236` (237 del baseline − la renovación de 801).
- `auto_renew = False` en las 325 de la limpieza (235 covered + 90 stale).
  **No se crea ninguna suscripción retroativa de julio para `Gym Demo`:**
  las filas de la limpieza se saltean en el loop y el único `INSERT` es el
  septiembre de 801 (sub 1509).
- Los socios **812, 785, 793 y 829 no reciben un segundo septiembre** (son los 4 cubiertos
  sólo por overlap a mitad de mes). Si aparece alguno en la lista de renovados, el keying
  volvió a ser por fecha exacta.
- Cero `IntegrityError` (`failed: 0`). El arnés reporta 3 escrituras dentro del rollback
  (1 UPDATE de limpieza + el INSERT de 801 y su ítem), nada persistido; queries reales 24,
  duración 3.7 s.
- Con el bug anterior el arnés daba `renewed: 0`. Tras el fix da `renewed: 1`; la
  comparación contra `TaskRun.last_result` (0/237/0) da **NO** porque el código real cambió
  por diseño — el valor almacenado pasará a 1/236/0 en la próxima corrida real.

**Follow-up fuera del plan**: los 45 socios de `Gym Demo` quedan sin suscripción al aplicar
esta fase. Reactivarlos es decisión de negocio, con `recover_member`, no con el auto-
renovador.

**Commit**: `fix(subscriptions): saltar por período en vez de por socio (#1)`

---

### Fase 4 — Runner: claim atómico y fin del `atomic()` gigante — ✅ HECHO (2026-09-28)

**Archivos**: `subscriptions/services.py:1314-1423` → `run_scheduled_tasks`,
`subscriptions/management/commands/auto_renew_subscriptions.py:15`,
`activities/no_show_service.py:234`

**El riesgo (vs. la Fase 3 vieja)**: el plan anterior proponía `pg_try_advisory_xact_lock` →
`pg_try_advisory_lock` (nivel sesión). Eso es **incompatible con PgBouncer transaction mode**
(ver 1.1): el lock vive en la conexión del servidor, el pooler se lo puede reasignar a otro
cliente, y muerto el proceso no se libera. **Descartado.**

1. **Reemplazar el advisory lock por un claim atómico** (pooler-safe y testeable en SQLite):

   ```python
   claimed = TaskRun.objects.filter(
       name=TASK_NAME, last_run__lt=now - timedelta(seconds=interval)
   ).update(last_run=now, last_status="running")
   if not claimed:
       return {"ran": False, "reason": "not_due"}
   ```

   Un compare-and-swap en una sentencia: sin lock, sin transacción abierta, sin modo de pooler
   especial. Se elimina `_acquire_task_lock`; no se agrega `_release_task_lock`.
2. **Trade-off explícito del claim al inicio**: hoy `last_run` se actualiza al final para
   retry inmediato si la corrida muere. Con el claim al inicio, una corrida muerta no se
   reintenta hasta que venza el intervalo (6h). Se acepta: después de la Fase 2 la corrida
   dura segundos, y 6h de retraso es irrelevante para una renovación mensual. A cambio, una
   corrida muerta queda visible como `last_status == "running"`, que hoy no existe. **Sin
   columna nueva, sin migración.**
3. **Sacar el `atomic()` externo** de `run_scheduled_tasks`. `create_next_subscription`
   (`services.py:867`) ya es atómico por socio, así que un timeout pierde una renovación en
   vez de 371. El `TaskRun` pasa a autocommitar.
4. **`deduct_missed_sessions`**: también estaba dentro del `atomic()` y no es atómico por
   unidad — `deduct_missed_activity_enrollments` escribe `no_show_scan_until` por enrollment
   (`no_show_service.py:188`). Es idempotente (retoma desde `no_show_scan_until`), así que el
   daño es bajo. Propuesta: envolver cada gym en su propio `atomic()`. En staging hay 1
   enrollment y 0 PT: no es urgente.
5. **Cerrar el agujero de concurrencia**: `management/commands/auto_renew_subscriptions.py:15`
   llama `auto_renew_subscriptions()` directo, salteando lock, `TaskRun` y `not_due`. Pasa por
   `run_scheduled_tasks(force=True)`.
6. **Tests: el lock actual no está testeado** (ver 1.8). Con el claim atómico, `update()`
   funciona en SQLite: dos threads, el segundo tiene que recibir `{"ran": False, "reason": "not_due"}`.
   Más un test de que el `TaskRun` se actualiza aunque `auto_renew_subscriptions` levante excepción.

**Criterio de aceptación** (verificado 2026-09-28 en staging, todo en rollback):
- Arnés: los números de la Fase 3 sin cambios — `renewed 1` (801), `skipped_already 236`,
  `failed 0`, contadores 235/90/7/0/38/1 (Σ371), ~24 queries, 3 escrituras rolleadas.
- Claim CAS: sobre una fila vencida afecta **1** fila; un segundo worker concurrente afecta
  **0** y recibe `not_due`; `last_status` queda en `"running"` durante la corrida y en `"ok"`
  al terminar. Con `force=True` corre igual y vuelve a `"ok"` (renewed 1 en el rollback).
- `manage.py auto_renew_subscriptions` ya no llama directo a `auto_renew_subscriptions()`:
  pasa por `run_scheduled_tasks(force=True)`.
- Sin `advisory lock` (se eliminaron `SCHEDULED_TASKS_LOCK_KEY` y `_acquire_task_lock`) y sin
  el `transaction.atomic()` externo: el `TaskRun` autocommitea y cada renovación es atómica
  por socio en `create_next_subscription`.
- `deduct_missed_sessions` envuelve cada gym en su propio `atomic()`.

**Commit**: `fix(subscriptions): claim atómico en vez de lock de sesión, y atómico por socio`

---

### Fase 5 — Guards de escritura #2 y #48 — ✅ HECHO (2026-09-28)

**Archivos**: `subscriptions/services.py` y `subscriptions/domain.py`.

Sin cambios a datos existentes. Sólo reglas de escritura. Los guards de lectura se conservan
(`subscription_remaining_balance` en `services.py:300-303` sigue como red para lo ya existente).

1. **#2** — el ítem de PT se garantiza al abrir o reactivar. `ensure_pt_items_for_active_assignments`
   (services.py) crea el ítem `personal_training` de cada asignación activa que no lo tenga en
   la suscripción, y se llama desde `SubscriptionDomain.open_subscription` (domain.py), el único
   punto canónico por el que pasan `create_next_subscription`, `recover_member`,
   `apply_plan_change`, `mutate_membership` y el alta por staff. Preventivo puro: hoy 0.
2. **#48** — los ítems de un socio `is_comp` se escriben en 0. Helper `_item_price(subscription,
   monthly_price)` aplicado en `ensure_subscription_item` (ítem del plan) y en las tres copias
   `_copy_activity_items`, `_copy_personal_training_items`, `_copy_outing_items`. Las copias
   además pasan a ser idempotentes (no duplican un ítem activo ya presente en la suscripción
   destino), algo necesario porque el guard de #2 corre en `open_subscription` antes de que las
   copias vuelvan a crear los ítems de PT en la renovación.
3. El resto de las vías de escritura ya eran comp-aware por precio al alta: actividades y outings
   (`enrollment_service.py`), `assign_member` y `_ensure_pt_item` (`assignment_service.py`), y
   `mutate_membership` al marcar `is_comp`. El grep de `is_comp` no dejó ninguna vía suelta.

**Criterio de aceptación** (verificado 2026-09-28 en staging, en rollback):
- `py_compile` de `services.py` y `domain.py` OK.
- `audit_money_bugs`: **#2 = 0** (147 socios activos revisados) y **#48 = 0** (deuda fantasma en
  la suscripción vigente). Los 2 ítems históricos pagados de Diego Salvado (socio 827,
  julio y agosto) siguen reportándose **sin tocar**: `Escrituras detectadas: 0`.
- Arnés (`audit_renewal_dryrun`): números de la Fase 4 sin cambios — `renewed 1` (801),
  `skipped_already 236`, `failed 0`, contadores 235/90/7/0/38/1 (Σ371). La renovación de 801
  pasa por las copias idempotentes sin cambios de precio.

> #### ⚠️ El criterio de esta fase era insuficiente (anotado 2026-09-28)
>
> El código de esta fase está bien. **El criterio con el que se cerró, no.** Los tres
> puntos de verificación fallaron por método, no por ejecución:
>
> - `#48 = 0` **no prueba** que `mutate_membership` sea correcto: el contador es
>   unidireccional (`audit_money_bugs.py:172`) y no puede ver el subcobro. **No reutilizar
>   este criterio** para nada que toque el toggle del pase.
> - `#2 = 0` y `#48 = 0` medieron **datos**, no **código**: no había socios en la situación
>   rota, así que el `0` sólo dice que el caso no se había dado. La propia fase lo anota
>   como *"preventivo puro: hoy 0"*.
> - *"el grep de `is_comp` no dejó ninguna vía suelta"* (punto 3): un grep encuentra **dónde
>   se toca** el flag, no **si el orden es el correcto** ni **si el conjunto de loops está
>   completo**. Los bugs P2 (orden) y P6 (falta un cuarto loop de restauración) están los
>   dos bajo esa frase.
>
> El análisis completo, con las trazas, está en la **sección 1.9**. De ahí sale el requisito
> de la Fase 7.0 de reportar casos *armados* además de casos *confirmados*.

**Commit**: `fix(subscriptions): guards de escritura para PT e is_comp (#2/#48)`

---

### Fase 6 — Tests focalizados — ✅ HECHO (2026-09-28)

**Archivo nuevo**: `backend/subscriptions/test_money_bugs.py`, sobre `BaseAPITest` de
`backend/core/testing.py`.

1. **#1, el caso 725 (H1)** — socio con dos suscripciones vencidas pagadas, la más antigua con
   sucesora y la del período actual sin ella: renueva **sólo** la nueva. Es el test que
   destraba los 45 congelados.
2. **#1 borde, overlap** — sucesora que empieza a mitad de mes (ej. 17) y cubre el target
   (1→30): no crea nada. Evita la regresión de las 4 suscripciones superpuestas
   (socios 812/785/793/829).
3. **#1 borde, duplicado** — dos candidatas del mismo socio con el mismo `target_start` y sin
   sucesora: crea una sola, sin `IntegrityError`.
4. **Período perdido** — candidato con `target_start` en un mes cerrado y sin sucesora: no
   crea nada, `skipped_stale_backlog = 1`, y `auto_renew` queda en `False`.
5. **#19** — gym con `active=False` y candidato vivo: no crea nada, `skipped_inactive_gym = 1`,
   y `auto_renew` **no** se toca.
6. **Deudor** — candidato `blocked` que paga después: en la corrida siguiente se renueva (la
   cadena de pagos tardíos sigue viva).
7. **#5** — `PlanChangeRequest` approved con `effective_date` vencida en un socio que **no** es
   candidato de renovación. Debe aplicarse igual.
8. **#2** — socio con PT activo y suscripción vigente sin ítem de PT. La recuperación debe
   crear el ítem.
9. **#48** — socio `is_comp` con ítems pagados. El total debe dar 0.
10. **claim** — dos llamadas concurrentes: la segunda no entra.

**Criterio de aceptación** (verificado 2026-09-28, SQLite local):
- `manage.py test subscriptions`: **19/19 OK** (`Ran 19 tests ... OK`) — 12 del archivo nuevo
  + los 7 de `tests.py`. Los 7 existentes no se tocaron.
- El test #19 destapó un **gap de consistencia**: el segundo loop de candidatos
  (`_collect_renewal_candidates`) no chequeaba `gym.active` — la pasada 1 sí lo cuenta como
  `skipped_inactive_gym` pero la lista de creación pudo incluir filas de gyms inactivos. Se
  agregó el guard (misma línea del orden de la Fase 2) para que la lista de creación coincida
  con el set contado.
- Impacto en staging (arnés read-only, en rollback; verificado 2026-09-28): `renewed 1`,
  `covered 235 / stale 90 / gym 7 / member 0 / blocked 38 / candidates 1` — sin cambios;
  `skipped_already` pasa de **236 → 193**. Los 43 de diferencia son filas de la limpieza
  (covered/stale) en gyms inactivos que el loop ya no procesa; **no se pierde ninguna
  renovación** (renovadas sigue en 1, member 801). Es la corrección que el funnel ya medía:
  la lista de creación deja de reflejar filas que la métrica cuenta como excluidas.
- Los fixtures con filas superpuestas (caso duplicado) se crean directo con
  `Subscription.objects.create` porque `open_subscription` (domain) ya rechaza el
  solapamiento — son la forma en que viven históricamente en staging.
- El claim test usa `TransactionTestCase` + dos `Thread` con `Barrier`; SQLite exige un
  `timeout` de busy generoso en las opciones de conexión para que el `UPDATE` condicional se
  serialice en vez de lanzar "database is locked".

**Commit**: `test(subscriptions): tests focalizados de bugs de dinero`

Más los 7 tests existentes de `backend/subscriptions/tests.py`.

```bash
cd backend && .venv/bin/python manage.py test subscriptions
```

---

### Fase 7 — Bugs ALTO de precio, pase de cortesía y PT por paquete — ✅ CERRADA (7.0-7.4)

**Estado al 2026-10-02**: los 9 bugs (P1-P7, P17, P18) tienen fix commiteado. Falta **sólo** el
checklist de cierre del punto 6 de la sección 5, que pide correr el arnés y los contadores otra
vez —no se corrió en esta sesión. La Fase 7 se puede dar por cerrada en código sin que eso la
bloquee, pero el checklist sigue abierto y no debe contarse como verde.

**Origen**: revisión de código del 2026-09-28, no de métricas. Ningún contador del
`audit_money_bugs` los detecta (ese comando sólo implementa #1, #2, #4, #5, #6, #19 y #48).

**Por qué Fase 7 y no más fases del plan original**: la Fase 5 declaró cerrado el pase de
cortesía con el criterio "`audit_money_bugs`: #2 = 0, #48 = 0". Ese criterio es válido pero
**insuficiente**: el audit sólo mira el mes en curso y sólo mira datos, no el orden de las
escrituras. Leyendo el flujo de escritura aparecen cuatro bugs de dinero en el mismo camino.

**Impacto hoy: $0.** El único gym real (`Sinkro`) tiene 0 socios. Se corrigen antes de que
entre el primer socio real, no porque hayan costado plata.

#### Los 9 bugs

P1-P7 nacieron de la revisión de código del 2026-09-28. **P17 y P18 nacieron de los tests**, al
escribir la matriz del toggle: son bugs que la revisión no miró porque no se ven leyendo el flujo
de escritura, se ven midiendo el resultado. Por eso no tienen contador en la 7.0.

| | Bug | Ubicación | Sev | Conf. / armados (prod) |
|---|---|---|---|---|
| P1 | PT en modalidad **paquete** genera además la cuota mensual, cada renovación | `subscriptions/services.py:197-199` | ALTO | 0 / 0 — latente puro |
| P2 | `is_comp` se persiste **después** de calcular los precios | `members/serializers.py:590` | ALTO | 0 / 0 — latente puro |
| P3 | Quitar/dar el pase reprecia el período en curso **sin prorrateo** | `subscriptions/domain.py:178-187, 200, 210, 225, 234` | ALTO | 0 / 0 — latente puro |
| P4 | El **sobrepago se borra en silencio** | `subscriptions/services.py:298-323, 357-361, 363-372, 378` | ALTO | **8 / 206 — costando plata ahora** |
| P5 | El **descuento se lee en vivo**, no está en el snapshot | `subscriptions/services.py:261, 264-274` | ALTO | 4 / 1 — 100 % sobrepago |
| P6 | Al quitar el pase **no se restaura** el precio de PT | `subscriptions/domain.py:216-235` | MEDIO | sin contador (cubierto por P2/P3) |
| P7 | `_neutralize_comp_package_balances` **sólo cubre actividades** | `subscriptions/domain.py:268-290` | MEDIO | sin contador (cubierto por P2/P3) |
| P17 | El **prefetch** del viewset oculta las relaciones filtradas: `personal_training_assignments` y `activity_enrollments` venían con `active=True, modality="package"`, así que el `.filter()` de los consumidores arrancaba de la queryset prefetcheada y veía sólo paquetes → la **cuota mensual de PT desaparece** del período al togglear el pase | `members/views.py:59-66` (los dos `Prefetch`) + `subscriptions/services.py:88`, `:215` | ALTO | sin contador (nació de los tests) |
| P18 | `ensure_overpayment_credit` acuña el **sobrepago entero** cuando crece: el guard `if already >= overpayment` frena el re-acuña si no se mueve, pero si el total baja y el sobrepago sube con él, la fila nueva **acredita dos veces la parte ya acreditada** | `subscriptions/services.py:457` (`ensure_overpayment_credit`, la función de P4) | ALTO | sin contador (nació de los tests) |

Las dos últimas columnas son la línea base de la Fase 7.0, medida el 2026-09-29 contra
producción; el detalle por ambiente y las consecuencias están en "Fase 7.0 — línea base medida".
P2 y P3 comparten contador porque el ítem es la misma evidencia.

P6 y P7 son MEDIO pero entran acá porque son inseparables de P2/P3: están en el mismo flujo y
arreglarlos por partes deja el toggle a medias.

P17 y P18 son ALTO y también entran acá aunque la 7.0 no los midiera, porque los dos bugs vivían en
el mismo camino que P1-P7: el toggle de cortesía. P17 es la vuelta de P1 (la 7.2 cerró que un PT
por paquete no genere cuota mensual; P17 cerró que un PT **mensual** tampoco se creara) y P18 es
una segunda vuelta de P4 (la 7.3 creó el crédito; P18 cerró que se acuña dos veces cuando el
sobrepago crece). Ni P17 ni P18 cambian un número de producción: `Sinkro` tiene 0 socios, así que
su línea base es 0 por definición y no hacía falta un contador para decidir corregirlos.

**La ubicación de P4 quedó vieja** (`services.py:298-323` y compañía): después de la 7.3, del
`credit_realized` y del bulk de `consumed_credit_by_subscription`, esa función está en
`services.py:457`. La fila de P18 trae la posición vigente.

#### P1 en detalle

`services.py:197-199` crea un ítem de PT por cada asignación `active=True`, sin mirar la
modalidad. `assignment_service.py:68-72` permite `modality="package"` cuando
`service.billing_mode == "sessions"`, pero **no exige `monthly_price == 0`**. Un servicio
puede tener las dos cosas: cuota mensual *y* venta por paquetes. Como `ensure_pt_items_for_
active_assignments` corre desde `open_subscription` (`domain.py:121`), el ítem de cuota se
crea en **cada** alta, renovación, recuperación y cambio de plan.

Socio con paquete de 10 sesiones × $8.000 (ya pagado $80.000) sobre un servicio de $22.000:
$22.000 de más **cada mes**, indefinidos.

> **Corrección 2026-09-29 — P1 tiene DOS vías de escritura, no una.** El plan decía que la 7.2
> era "una línea" (`services.py:197`). Es falso: `_copy_personal_training_items`
> (`services.py:88-126`) copia el ítem de PT del período anterior **sin mirar tampoco la
> modalidad**, y se llama desde **cuatro** sitios:
>
> | # | Llamador | Cuándo |
> |---|---|---|
> | 1 | `services.py:182` (`ensure_subscription_items`) | `create_next_subscription` |
> | 2 | `services.py:943` (`create_next_subscription`) | renovación automática |
> | 3 | `services.py:1042` (`recover_member`) | recuperación |
> | 4 | `services.py:1405` | `apply_plan_change` |
>
> Consecuencia: corregir sólo la línea 197 arregla el alta y deja el bug **en cada
> renovación** del socio con paquete, que es donde más plata se pierde. La 7.2 mete el filtro
> de modalidad en las dos funciones, con un helper compartido de "PT facturable como cuota".
> El contador P1 de la 7.0 mide las dos vías, no sólo la primera.

> **Resuelto en la 7.2 (2026-09-29)**. La regla que quedó es más simple que la que se describe
> arriba: una oferta se factura como cuota si el socio tiene **alguna** asignación activa
> `monthly` de esa oferta, y en ningún otro caso. Cubre el paquete (que ya se cobra por sesión) y
> también el ítem huérfano de una asignación dada de baja.


#### P2 en detalle

`members/serializers.py:576-591` llama `mutate_membership` y **recién en la línea 590**
persiste `is_comp`. `_item_price` (`services.py:43`) lee `subscription.member.is_comp`, así
que calcula con el valor **anterior**:

- **Dar el pase**, sin suscripción vigente → ítems al precio completo. La deuda se fuerza a 0,
  pero la app y el panel muestran "debe $52.000". Es el fantasma de #48, otra vez.
- **Quitar el pase**, sin suscripción vigente → ítems en **$0** y `paid=False`. El socio no
  paga nada ese mes; la factura aparece recién en la renovación siguiente.

Si **hay** suscripción vigente el camino ya reescribe bien los precios, que es lo que oculta
el bug.

**Traza del sentido "dar el pase"** (el que el contador #48 sí habría visto):

```
20/09, Ana NO tiene suscripción de septiembre. El staff tilda "pase de cortesía".
  serializers.py:576   ¿cambió el flag?          → sí
  serializers.py:579   mutate_membership(comp=True)
  domain.py:253        no hay vigente → abre suscripción de septiembre
  domain.py:117        ensure_subscription_item → _item_price → member.is_comp
                       → todavía False → escribe $30.000
  domain.py:121        ensure_pt_items_for_...   → _item_price → todavía False → $22.000
  domain.py:258        paid = True
  serializers.py:590   AHORA sí: is_comp = True
```

Resultado: la suscripción dice "pagada" pero sus ítems dicen $52.000. La deuda se fuerza a 0
(`services.py:363-372`), así que nadie debe nada, pero la app y el panel muestran **"debe
$52.000"**. Es el fantasma de #48 otra vez.

**Traza del sentido "quitar el pase"** (el que el contador #48 **no puede** ver):

```
20/09, Ana ES cortesía. El staff destilda la casilla.
  serializers.py:583   _resolve_plan_for_comp_off → PlanA
  serializers.py:585   mutate_membership(comp=False, plan=PlanA)
  domain.py:246        no hay vigente → open_subscription(paid=False, plan=PlanA)
  domain.py:117        ensure_subscription_item → _item_price → member.is_comp
                       → todavía True → escribe $0
  domain.py:121        ensure_pt_items_for_...   → todavía True → $0
  serializers.py:590   AHORA sí: is_comp = False
```

Resultado: Ana tiene una suscripción del plan **de pago**, con `paid=False` y total **$0**. No
paga nada en septiembre; en octubre la renovación copia el precio real y aparece la factura de
$52.000. Y el contador, al leer `member.is_comp == False`, ni ejecuta la línea.

#### P3 y la decisión de prorrateo

`domain.py:210, 225, 234` escriben `plan.price` / `activity.monthly_price` /
`outing.monthly_price` — precio **vigente**, mes entero, sin prorrateo — y `domain.py:200`
pone `paid = False` a mano sin pasar por `sync_subscription_paid`.

**Decisión del 2026-09-28: prorratear por días, en las dos direcciones.**

> El período en curso se factura sólo por los días que el socio estuvo en el estado de pago que
> queda vigente **después** de la transición. El día de la transición cuenta a favor del estado
> nuevo.

Ejemplo (plan $30.000 + PT $22.000 = $52.000, septiembre de 30 días):

| Transición | Días facturados | Total del mes | Efecto |
|---|---|---|---|
| **Quitan** el pase el 20 (venía gratis desde el 1) | 20→30 = **11** | **$19.067** | debe $19.067 |
| **Dan** el pase el 20 (venía pagando desde el 1) | 1→19 = **19** | **$32.933** | pagó $52.000 → **crédito de $19.067** |

Las dos direcciones son el mismo mecanismo: en la segunda, bajar el total de $52.000 a
$32.933 deja un excedente de $19.067, que es exactamente un sobrepago y lo absorbe P4. Por eso
el prorrateo y el crédito van en la misma fase.

Se descartó la alternativa de prorratear sólo en una dirección por asimetría, y la de "el mes
de la transición no se cobra" porque deja al socio sin suscripción (y por lo tanto sin
renovación: el guard `services.py:1068-1078` saltea a todo el que esté en plan base salvo los
cortesía) y porque no definía el caso inverso.

#### P4 en detalle

`subscription_remaining_balance` calcula `overpayment` (`services.py:357-361`) y lo devuelve en
el dict (`:378`), pero **nadie lo lee**: aparece en 3 líneas del código y en un test. Peor, la
rama `is_comp` (`:363-372`) fuerza `paid_amount = total`, así que la API **responde "pagó $0"**
sobre una suscripción con un `Payment` de $52.000 adjunto.

El sobrepago sólo puede nacer hacia atrás, porque `payments/serializers.py:129` y `:156`
rechazan pagar más que el saldo pendiente. Se dispara cuando el total **baja** después del
cobro: el toggle de cortesía, activar un descuento, o desactivar una actividad/PT/salida ya
pagada. Y como el sistema de pagos capa el saldo pendiente, **no hay forma de mover ese
crédito al mes siguiente**: no es que esté mal mostrado, es que el camino no existe.

La asimetría es el bug de fondo: el clamp protege al socio de una deuda negativa (bien hecho)
pero borra en silencio lo que el gym tiene por cobrar. **Una defensa sin su contrapartida.**

#### P5 en detalle

`services.py:261` llama a `member_discount_percent` (`:264-274`) en **cada cálculo**, que lee
`member.discount` vivo. Si el descuento se desactiva después del cobro, el total de un período
ya facturado baja solo: el socio vuelve a deber, la suscripción pasa a `overdue` → `blocked` →
**le cortan el acceso por un mes que ya pagó**. Invertir el caso también cuesta plata (el
excedente se pierde por P4).

**Decisión del 2026-09-28: congelar sólo lo retroactivo.** El `help_text` de
`Discount.active` (`gyms/models.py:238`) ya dice que inactivar hace que el socio pase a pagar
el precio completo, así que congelar de más contradiría documentación existente. Lo que se
congela es el snapshot: cada período guarda el % con el que se emitió, así que un período
abierto el 30/09 conserva su % aunque el descuento se desactive el 01/10 — y el período
siguiente abre con el valor vigente. Eso es exactamente lo que dice el `help_text`, sin el
re-cobro sorpresa. Se actualiza el `help_text` para dejarlo explícito.

#### P6 en detalle

`domain.py:216-235` restaura los precios de los ítems al quitar el pase. Tiene **tres** loops:

| Ítem | ¿Restaura? | Ubicación |
|---|---|---|
| Plan | ✅ | `domain.py:203-212` |
| Actividades | ✅ | `domain.py:217-224` |
| Salidas | ✅ | `domain.py:226-233` |
| **PT** | ❌ **no hay loop** | — |

`item_type="personal_training"` no aparece en ninguno de los tres, y el comentario de la línea
214 dice literalmente *"Restore monthly billing for active activities and outings"* — el autor
original enumeró dos, el código tiene tres, y PT no está ni en el comentario ni en la lista. Y
este es el caso donde el grep **sí** vio `is_comp` (está en la rama `if comp:`) — el grep pasó
igual, porque lo que falta no es una mención sino el cuarto loop de un conjunto de tres.

```
15/09, Ana ES cortesía y TIENE suscripción de septiembre (total $0). El staff destilda.
  domain.py:210   ítem de plan      → $30.000  ✅
  domain.py:219   ítems de actividad → $2.000  ✅
  domain.py:228   ítems de salida    → $3.000  ✅
  domain.py:???   ítems de PT        → $0      ❌
  ──────────────────────────────────────────────────
  total: $35.000 en vez de $57.000   → subcobro de $22.000/mes
```

Y como el ciclo de cortesía se repite, la pérdida se repite cada mes mientras el socio vuelva a
pedir el pase.

#### P7 en detalle

`_neutralize_comp_package_balances` (`domain.py:268-290`) pone en $0 los paquetes comprados por
adelantado cuando alguien pasa a cortesía — correcto, porque un cortesía no se factura. Pero
recorre **sólo** `Enrollment`, que es el modelo de actividades:

| Paquete | Modelo | ¿Lo cubre? |
|---|---|---|
| Actividades | `activities.Enrollment` | ✅ |
| PT | `personal_training.PersonalTrainingAssignment` | ❌ |
| Salidas | `outings.OutingEnrollment` | ❌ |

```
15/09, Ana tiene un paquete de PT de 10 sesiones × $6.000, pagó $80.000, usó 3. Pasa a cortesía.
  actividades → session_price = 0, amount_paid = 0   ✅
  PT          → session_price = $6.000, pagado $80.000 ❌
  salidas     → session_price = $10.000              ❌
```

El bug tiene **dos puntas**, y las dos hay que tapar:

1. **Entra mal**: los paquetes de PT y salidas no se neutralizan.
2. **No sale nunca**: la función escribe `session_price = 0` y `amount_paid = 0` sin ninguna
   ruta de restauración. Cuando a Ana le quitan el pase, las 7 sesiones restantes de su paquete
   quedan a $0 **para siempre**, aunque el precio original siga en `service.monthly_price`. Los
   únicos sitios que repponen `session_price` son
   `activities/session_service.py:124-129` y `outings/session_service.py:122-127`, y lo hacen
   **al crear** el paquete, no al desneutralizarlo.

Por eso la Fase 7.1 no sólo extiende `_neutralize_comp_package_balances`: también escribe su
gemela de restauración.

#### P17 en detalle

El bug no está en el toggle: está en **cómo el queryset llega al viewset**. `MemberViewSet`
(`members/views.py:51-81`) prefetchea `personal_training_assignments` y `activity_enrollments`
con `queryset=...filter(active=True, modality="package")`. El detalle que lo vuelve un bug y no
una decisión: **cualquier `.filter()` posterior sobre esa relación no vuelve a la base, arranca
de la queryset prefetcheada.** Django no distingue "acabo de pedir esto" de "esto es todo lo que
hay". Así que `services.py` veía únicamente paquetes:

- `_monthly_pt_service_ids` (`services.py:88`) se apoyaba en
  `member.personal_training_assignments.filter(active=True)` para sacarle los IDs de los PT
  mensuales. Con la caché del viewset, esa lista —no la base— era sólo la de los paquetes.
- `ensure_pt_items_for_active_assignments` (`services.py:215`) por lo tanto no creaba el ítem de
  cuota mensual, y el período se abría sin él.

El camino afectado es el toggle de cortesía (`members/serializers.py` → `mutate_membership` →
`open_subscription`), el único que pasa un socio del viewset a la apertura: el período se reescribe
sin el ítem de PT y la cuota mensual desaparece del total. **Un socio que ya pagaba su cuota
mensual de PT deja de pagarla al tocarle el pase.** Ese es el daño.

El fix (`a000871`) saca los filtros de los dos `Prefetch` y los pasa a los consumidores:
`pending_sellados` exige `modality="package"`, los loops de deuda de `is_recoverable` exigen
`active`, y `get_outing_enrollments` exige `active`. `outing_enrollments` **no** se desfiltra,
porque no tenía guard propio y desfiltro mostraría salidas canceladas: el guard va en el
consumidor. El payload queda idéntico: con la instancia del viewset los filtros dan el mismo
resultado que antes, y sin instancia ahora también dan el correcto.

La lección, que es más gruesa que el bug: **un `Prefetch` con queryset filtrada es un `cache()` con
alcance de ORM**. Es una afirmación sobre la base que todos los consumidores tienen que repetir, y
el que la incumplía no estaba cerca del prefetch.

#### P18 en detalle

`ensure_overpayment_credit` (`services.py:457`) convierte el sobrepago en saldo a favor. El bug
no es que acuñe de más, es **cuándo**: el guard era

```python
if already >= overpayment:
    return
```

que es cierto y no es suficiente. Frena el re-acuña cuando el saldo no se mueve, pero no cuando
**crece**. La secuencia que lo dispara es la del toggle:

1. El socio paga el mes: $50.000 sobre un total de $50.000 → sobrepago $0.
2. Se le da el pase. El total baja a $0.
3. El sobrepago pasa de $0 a $50.000.
4. `ensure_overpayment_credit` ve `already = 0`, `overpayment = 50000`, no cumple el guard y
   **acuña $50.000 enteros**. Si el socio ya traía $2.000 de saldo a favor de antes, la parte ya
   acreditada aparece dos veces.

El fix (`9a051c8`) acuña el **delta**, `overpayment - already`. El delta conserva la idempotencia
sin depender del guard: un segundo sync con el mismo saldo deja `pending` en 0, que es el mismo
no-op que ya daba el guard. La forma buena no es "agregar una condición más", es cambiar la
unidad de la operación de "el saldo es X" a "el saldo pasó de A a B".

**Cómo se encontró**: no leyendo `ensure_overpayment_credit`, sino reescribiendo
`test_courtesy_member_overpayment_becomes_credit`. El test viejo seteaba al socio como cortesía
*antes* de abrir el período, así que el período nacía ya sin ítem de plan a 0 y el pago de $50.000
se leía entero como sobrepago. Fijaba un estado imposible —un cortesía no genera un mes de deuda
que después se descuente— y con ese estado el bug quedaba tapado. Recién con la secuencia real
(el socio abre y paga como normal, después se le da el pase) el test murió por una razón real.

Este es el patrón que compartieron P17 y P18: los dos estaban en código que la Fase 7 ya había
tocado y que ningún test alcanzaba, y los dos aparecieron al **escribir el caso que faltaba**, no
al revisar la función.

---

#### Fase 7.0 — Métricas read-only de los 7 bugs

**Archivo**: `backend/subscriptions/management/commands/audit_money_bugs.py`

Cuatro contadores nuevos, todos de sólo lectura, siguiendo el patrón de la Fase 0
(`force_debug_cursor` + `atomic()` + `set_rollback(True)` + conteo de escrituras).

**Cada contador reporta DOS números, no uno.** Es el requisito que sale de la sección 1.9: con
un solo número, `0` no distingue entre *"el bug no se disparó"* y *"nunca se probó"*. El
segundo número —los **casos armados**— dice cuántos están a un paso de costar plata.

| Contador | `casos_confirmados` (el bug ocurrió) | `casos_armados` (a un paso de ocurrir) |
|---|---|---|
| **P1** | ítem `personal_training` activo en una suscripción cuya asignación es `modality="package"` | servicios con `billing_mode="sessions"` y `monthly_price > 0` — cada uno es un $22.000/mes esperando una asignación de paquete |
| **P2/P3** | ítems con `price_snapshot > 0` en una suscripción de un socio **ya** `is_comp`, **en dos líneas: período vigente / períodos cerrados** | socios `is_comp` **sin** suscripción que cubra hoy — a un toggle de asignarles o quitarles el pase |
| **P4** | `paid_amount > total` sin un `Payment` de `concept="credit"` que lo cubra | suscripciones pagadas con `total > 0` — cualquiera de ellas puede ver caer su total y abrir un sobrepago |
| **P5** | suscripción pagada cuyo total con descuento vivo difiere del total con el descuento congelado, **desglosado por dirección** | socios con `discount` activo **y** una suscripción abierta: el día que el gym desactive el descuento, todas se re-cobran |

**Tres precisiones sobre los contadores** (2026-09-29, antes de implementarlos):

1. **P1 tiene que cubrir las dos vías de escritura.** El ítem de PT llega por
   `ensure_pt_items_for_active_assignments` (`services.py:197`) y por
   `_copy_personal_training_items` (`services.py:88`), que se llama desde 4 sitios. Un
   contador que sólo mire el primero da 0 con el bug vivo en cada renovación. Se cuenta el
   ítem, que es la evidencia común de las dos.
2. **P2/P3 se parte en vigente / cerrados** porque la decisión #15 (no tocar los ítems
   históricos del socio 827) vuelve inalcanzable un `= 0` global: con la línea base de hoy,
   los 2 ítems de julio y agosto están ahí y **no se van a ir**. El gate de la 7.1 es
   `vigente = 0` **y** `cerrados` igual a la línea base (que no crezca).
3. **P4 excluye `is_comp` explícitamente** y **P5 se desglosa por dirección.** Sin la
   exclusión, P4 da un `0` falso: la rama `is_comp` de `subscription_remaining_balance`
   (`services.py:363-372`) fuerza `paid_amount = total`, así que un cortesía con un pago real
   nunca aparece como sobrepago. Y `total_vivo != total_congelado` ocurre en dos sentidos con
   costos opuestos —deuda resucitada (socio bloqueado un mes ya pagado) y sobrepago—, que
   además tienen arreglos distintos.


**Cómo se lee la salida:**

| Lectura | Significado | Qué hacer |
|---|---|---|
| `confirmados 0 / armados 0` | El camino no es alcanzable con los datos actuales. El bug es **latente puro**. | Corregir igual (es barato) y anotarlo como no ejercitado |
| `confirmados 0 / armados > 0` | El bug no se disparó pero hay N distancias de fuego. **Es el caso de hoy.** | Corregir con prioridad: el primer toggle lo activa |
| `confirmados > 0` | El bug **está** costando plata ahora | Es una emergencia: primero cuantificar el monto, después corregir |

El caso de hoy es la segunda fila para los cuatro contadores, y esa es exactamente la lectura
que el `0` de la Fase 5 no daba.

> **CORREGIDO por la medición — la segunda fila era la predicción, no el dato.** Abajo está la
> línea base real. P4 salió en la **tercera** fila: `confirmados > 0`. Es el único contador que
> no dio la lectura prevista.

**Criterio de aceptación** (antes de implementar cualquier fase posterior):
- `Escrituras detectadas: 0`.
- Corrido contra **staging** y **producción**, read-only, con los 8 números (4 pares)
  documentados como línea base. Los 4 pares van en la tabla de los 7 bugs: si un `armados` da
  alto, la severidad sube aunque el `confirmados` dé 0.
- La corrida **no** llama a `auto_renew_subscriptions`: sólo lee. El arnés de la Fase 1 sigue
  siendo el que verifica el código real de renovación.

**Commit**: `chore(audit): métricas read-only de los bugs de la Fase 7`

#### Fase 7.0 — línea base medida (2026-09-29) — ✅ HECHO

Corrido contra los dos ambientes, `Escrituras detectadas: 0` en ambos, rollback explícito.
Verificado por `DB host`: staging `green-sea` / producción `round-sunset`.

| Contador | Staging | Producción | Lectura |
|---|---|---|---|
| **P1** conf / armados | **0 / 0** | **0 / 0** | fila 1 — inalcanzable con los datos actuales, latente puro |
| **P2-P3** vigente / cerrados | **0 / 2** | **0 / 2** | vigente en el goal; cerrados = histórico congelado (socio 827) |
| **P2-P3** armados | **0** | **0** | ningún cortesía sin suscripción que cubra hoy |
| **P4** conf / armados | **13 / 198** | **8 / 206** | **fila 3 — el bug está costando plata ahora** |
| **P4** monto que se pierde | **663.002** | **509.002** | sobrepago sin destino, 5-6 socios |
| **P5** conf / armados | **9 / 2** | **4 / 1** | 100 % dirección B |
| **P5** A) queda debiendo | **0** | **0** | el bloqueo de un mes ya pagado nunca ocurrió |
| **P5** B) queda sobrepagado | **9 (506.000)** | **4 (352.000)** | subconjunto de P4 |
| **Escrituras** | **0** | **0** | — |

`member_ids`: P4 staging `2, 8, 785, 820, 821, 825` / producción `2, 8, 820, 821, 825` · P5 armado
staging `785, 820` / producción `820` · P2-P3 cerrados `827` en ambos.

**Los cuatro hallazgos de esta línea base:**

1. **P4 no es latente: es el único contador en la tercera fila.** Hay 8 suscripciones en
   producción y 13 en staging con `paid > total` y sin nada que cubra la diferencia. El monto
   es **dinero semilla** de los gyms de demo, así que no es una pérdida contable real — lo
   importante es que **el camino está ejercitado**: cada pago de más que se haga desde hoy se
   pierde igual. Es la lectura que un `0` nunca hubiera dado, y es la tercera fila de la tabla
   de arriba, que dice "primero cuantificar, después corregir". Ya se cuantificó.
2. **P5 es 100 % sobrepago, 0 % deuda resucitada.** La dirección cara (socio bloqueado un mes
   que ya pagó) no ocurrió nunca; todo el daño medido de P5 es el de P4. La 7.3 tiene que
   arreglar las dos igual, pero la prioridad la pone el sobrepago.
3. **Un cuarto de P4 no viene del descuento, y la 7.3 no lo cubre.** En los dos ambientes la
   resta da exactamente lo mismo: staging `13 − 9 = 4` y `663.002 − 506.000 = 157.002`;
   producción `8 − 4 = 4` y `509.002 − 352.000 = 157.002`. Son 4 suscripciones —socios `2` y
   `8`, ambas en junio— y en **las cuatro `total_vivo == contrato`**: el total nunca cambió
   después del cobro, así que congelar el descuento no las toca. El sobrepago nació **al
   ingresar el pago** (`paid=3000` contra `total=1000`, `paid=50000` contra `total=25000`,
   `paid=350000` contra `total=220000`, `paid=3000` contra `total=2998`): un pago de un mes
   contra un período prorrateado, o más de un mes contra un mes. El diseño de la 7.3 crea el
   crédito en `sync_subscription_paid`, que es "el total bajó" — y acá el total no bajó nunca.
   **La 7.3 necesita un segundo punto de creación, en el asiento del pago**; si no, estos
   157.002 se siguen perdiendo igual que hoy.
4. **P1 y P2-P3 son inalcanzables hoy, no sólo silenciosos.** `armados = 0` en los dos: no hay
   ningún servicio PT `sessions` con `monthly_price > 0` ni ningún cortesía sin suscripción que
   cubra hoy. Se corrigen igual (son baratos) pero **no se van a poder ejercitar contra datos
   reales**: su verificación va a tener que ser por test, no por medición.

> **El pool de #1 se movió solo: 371 → 46 (staging) / 43 (producción).** No lo cambió este
> audit — es read-only. Lo que pasó es que la tarea programada del middleware ya corrió la Fase 2
> contra los dos ambientes: los `auto_renew=False` quedaron limpios. 46 y 43 son el tamaño
> estable que predice la sección 1.4 (7 de gym inactivo + los deudores + la rotación mensual).
> Los demás contadores no se movieron: `#2 = 0`, `#5 = 0`, `#19 = 7`, `#48 vigente = 0`,
> `#48 cerrados = 2` (los mismos ítems de julio y agosto del socio 827).

---

#### Fase 7.1 — Pase de cortesía: cerrar la vía que la Fase 5 declaró cerrada

**Archivos**: `members/serializers.py:566-591`, `subscriptions/domain.py:168-290`

1. **P2** — `members/serializers.py:590`: persistir `instance.is_comp` **antes** de llamar
   `mutate_membership`, para que `_item_price` lea el valor correcto.
2. **P3** — en `domain.py`, los precios del período en curso pasan a ser
   `precio_contrato × días_facturables / días_del_período`, cuantizado a 2 decimales con
   `ROUND_HALF_UP`. El denominador es **la duración real del período**
   (`end_date - start_date + 1`), que en un mes calendario común coincide con los días del mes.
   El numerador sale del estado al que se entra y **el día de la transición cuenta a favor del
   estado nuevo**: `comp=True` factura `(today - start_date).days` (lo ya servido), `comp=False`
   factura `(end_date - today) + 1` (lo que falta). La base es siempre el **precio de contrato**
   del ítem (`plan.price` / `activity.monthly_price` / `outing.monthly_price` /
   `personal_training.monthly_price`), nunca el `price_snapshot` ya prorrateado: si no, dos
   toggles en el mismo período componen el factor. Lo que se factura de más al dar el pase se
   convierte en crédito vía P4. Sacar el `paid` a mano de las dos ramas (`domain.py:184` y
   `:210`) y delegar en `sync_subscription_paid`, **después** de reescribir los ítems.
3. **P6** — `domain.py:226-233`: sumar el cuarto loop de restauración,
   `item_type="personal_training"`, junto a los de actividades y salidas, con el mismo factor de
   prorrateo.
4. **P7** — `domain.py:268-290`: extender `_neutralize_comp_package_balances` a
   `PersonalTrainingAssignment` y `OutingEnrollment`, no sólo a `Enrollment`. Escribir su
   gemela de restauración: hoy el `session_price = 0` no tiene vuelta atrás, así que el bug
   tiene dos puntas. **Decisión del usuario (2026-09-29) — sin migración**: los tres tipos
   comparten el mismo par de campos, así que la neutralización y su gemela usan un queryset e
   iteración comunes. Restaurar `amount_paid` es **recalcularlo** desde los `Payment` de sesión
   (`sync_enrollment_paid` / `sync_assignment_paid` / `sync_outing_paid`, `payments/services.py:
   59-88` — su fuente canónica, mejor que un snapshot porque respeta pagos hechos bajo comp), y
   `session_price` se **refresca desde `member.insurance.session_price`**, igual que
   `renew_package`; sin obra social queda `0` ("sin cargo", convención del backfill). La
   restauración corre en las dos ramas `comp=False` (con y sin suscripción vigente). Edge
   documentado: un coseguro escrito a mano distinto de la obra social (o socio sin obra social)
   se restaura al de la obra social, no al original; impacto real $0 hoy.

**Criterio de aceptación**:
- Toggle × 2 sentidos × {con suscripción vigente / sin ella} × {con PT / sin PT} = 8 casos,
  **todos assertando sobre `calculate_subscription_total` y `subscription_remaining_balance`,
  nunca sobre el flag `paid`** (el flag es derivado y es justamente lo que hoy queda viejo).
- Prorrateo: quitar el pase el día 20 de un mes de 30 → total del período = `11/30` de la
  suma base. Darlo el día 20 → total = `19/30`.
- `sync_subscription_paid` llamado en ambas ramas; ningún `paid` escrito a mano.
- `_neutralize` cubre los tres tipos de paquete y su restauración devuelve los precios.
- **Contadores de la 7.0 — criterio reescrito el 2026-09-29 (decisión del usuario)**: el
  `P2/P3 vigente = 0` que estaba acá **es inalcanzable por diseño** después de la 7.1b, y por la
  misma razón que el `= 0` global lo era: la 7.1b hace que dar el pase a mitad de mes deje ítems
  **positivos** a propósito (los días ya servidos se facturan), y eso es exactamente lo que el
  contador cuenta (`_comp_items_by_scope`, `price_snapshot__gt=0` sobre socios `is_comp`).
  El gate que corresponde al estado final es:
  - `cerrados` **sin crecer** sobre la línea base de la 7.0 (2, socio 827), y
  - todo ítem **positivo** de un cortesía en período **vigente** tiene **crédito que lo cubra** —
    estado final que sólo entrega la 7.3. Hasta entonces el excedente existe y no se ve: la rama
    `is_comp` de `subscription_remaining_balance` fuerza `overpayment = 0`.

  **Consecuencia aceptada**: entre la 7.1b y la 7.3, `audit_money_bugs.py:182` (contador **#48**,
  `member.is_comp and calculate_subscription_total(subscription) > 0`) va a contar de a un
  cortesía al que se le da el pase a mitad de mes, y el panel le va a mostrar un total mayor a 0 a
  un socio cortesía. No es una regresión de #48: es el prorrateo de días ya servidos, y se
  resuelve cuando el crédito exista y la UI distinga crédito de deuda. **El contador no se toca**
  (es read-only y su línea base es la de la 7.0); lo que se corrige es este criterio.

**Commit**: `fix(subscriptions): orden de escritura y prorrateo del pase de cortesía (#2/#48)`

---

#### Fase 7.2 — PT por paquete: dejar de cobrar la cuota dos veces

**Archivos**: `subscriptions/services.py:197` **y `subscriptions/services.py:88`**
(las dos vías de escritura, ver la corrección de P1 más arriba),
`personal_training/assignment_service.py:68`

1. **Vía 1 — alta.** `services.py:197` → `.filter(active=True, modality="monthly")`.
2. **Vía 2 — copia entre períodos.** `services.py:88-126` (`_copy_personal_training_items`)
   tiene que saltar el ítem cuando la asignación del socio para ese servicio **no** es
   `modality="monthly"`. Sin esto, el ítem vuelve por la copia en cada renovación aunque la
   vía 1 esté arreglada, y el test de la vía 1 pasa mientras el bug sigue cobrando. Un helper
   compartido (`_is_monthly_pt_billable(member, service)`) para que las dos vías no puedan
   divergir.
3. En el alta de un servicio con `billing_mode="sessions"`, forzar `monthly_price = 0`, para
   que cuota y paquete no puedan coexistir. Decisión de implementación: si el serializer
   permite hoy crear un servicio `sessions` con precio, la opción correcta es **forzar el
   precio a 0 en el alta del servicio**, no rechazar en la asignación — el rechazo deja el
   socio con una asignación que no se puede crear y ningún mensaje útil.
4. Los datos existentes se limpian con la métrica de la 7.0, **no** con un `UPDATE` masivo.

**Criterio de aceptación**:
- Socio con PT `billing_mode="sessions"` en `modality="package"`: la suscripción renewed **no**
  tiene ítem de PT, y su total es sólo el del plan. El mismo test corre por las **dos** vías:
  (a) alta sin suscripción previa, (b) renovación desde un período que **ya tenía** el ítem de
  PT. (b) es el que falla si sólo se arregla `services.py:197`.
- Socio con PT `modality="monthly"`: sigue teniendo su ítem, al precio completo, en las dos
  vías.
- Contador P1 de la 7.0: `confirmados = 0` (los históricos no se tocan, así que el histórico
  no se exige en 0: se exige que no **crezca**).
- El arnés de la Fase 1 no cambia: `renewed 1`, contadores Σ371. Esta fase no toca el
  renovador.

**Commit**: `fix(subscriptions): los PT por paquete no generan cuota mensual (#2)`

##### Cómo quedó implementada (2026-09-29) — ✅ hecha

Tres desvíos del diseño de arriba, todos menores y a favor:

1. **El helper es `_monthly_pt_service_ids(member)` y devuelve un `set` de ids**, no el
   booleano `_is_monthly_pt_billable(member, service)` que decía el plan. Misma regla, misma
   fuente única, pero un set: la vía de copia itera sobre ítems y con un booleano por servicio
   haría una query por ítem. Un lookup por renovación, 1 query.
2. **Sin asignación activa no hay cuota.** El plan sólo hablaba del caso "paquete". La regla
   que quedó es más simple y cubre los dos casos: un servicio se factura como cuota si el socio
   tiene **alguna** asignación activa `monthly` de esa oferta. La única forma de tener un ítem de
   PT sin asignación activa son datos inconsistentes, y dejar de facturar ahí es lo prudente.
3. **El precio en 0 se fuerza también al editar, no sólo al crear.** El plan decía "en el alta".
   Un `PATCH` que pasa la oferta de `monthly` a `sessions`, o que manda un `monthly_price` a una
   oferta que ya era `sessions`, reintroducía exactamente la condición que genera el bug. Va en
   `validate()`, que corre en create y en update (con el `billing_mode` del `instance` como
   fallback para los `PATCH` parciales).

**Tests** (13 nuevos, todos verdes, y **verificados en rojo sin el fix**):

| Test | Qué fija |
|---|---|
| `test_package_assignment_adds_no_monthly_fee_on_open` | vía 1 (alta): sin ítem, total = plan |
| `test_package_fee_not_copied_into_next_period` | vía 2 (copia), con el ítem previo escrito a mano |
| `test_package_fee_dropped_on_autorenewal` | la renovación automática, el camino que más plata perdía |
| `test_monthly_assignment_still_billed_on_open` | control positivo del alta |
| `test_monthly_assignment_still_copied_into_next_period` | control positivo de la copia |
| `test_two_services_one_package_one_monthly` | la regla es por oferta: conviven sin mezclarse |
| `test_inactive_assignment_does_not_resurrect_fee` | el caso "sin asignación activa" del desvío 2 |
| `PTServicePriceInvariantTests` (6) | el precio en 0 se fuerza en create, en el cambio de modalidad y en el `PATCH` del precio; y el `PATCH` de una oferta mensual sigue funcionando |

Sin el fix en `services.py` caen 4 de los 7 (los 4 de paquete) y los 3 controles positivos siguen
verdes: los tests fijan el bug, no la ausencia de tests. Sin el fix del serializer caen 3 de 6.

**Costo en queries** (medido con `CaptureQueriesContext` sobre `create_next_subscription`, no
estimado):

| Socio | Antes | Después |
|---|---|---|
| con PT mensual (el ítem se renueva) | 11 | **12** |
| con PT por paquete (el ítem no se renueva) | 11 | **9** |

O sea **+1 query por renovación** que tiene PT mensual, y −2 para la que tiene paquete. El
presupuesto de la Fase 1 es 40 y la última medición daba 24 con una renovación: queda en 25.

**Lo que la medición de la 7.0 no anticipó**: el arnés de la Fase 1 **ya no sirve para
comparar contra la tabla de la sección 5 tal como está escrita**. La tarea programada corrió hoy
15:22 en staging y renovó al socio 801, así que la corrida actual da `renewed 0` / `candidates 0`
en vez de `renewed 1` / Σ371. Ese `0` es el fix de la Fase 2 funcionando, no una regresión. La
comparación válida es **A/B sobre el mismo estado**: con el fix y sin él, las dos salidas del
`audit_renewal_dryrun` son idénticas byte a byte salvo el timestamp.


---

#### Fase 7.3 — Saldo a favor y descuento congelado (requiere migración)

**Migraciones**:
- `subscriptions/0022_subscription_discount_snapshot.py` —
  `discount_percent_snapshot = PositiveSmallIntegerField(null=True, blank=True)`
- `payments/0013_payment_credit.py` — `Payment.CONCEPT_CHOICES += ("credit", "Saldo a favor")`
  y `Payment.applied_to = FK(Subscription, null=True, blank=True, SET_NULL, related_name="+")`

**P5** — `calculate_subscription_total` usa el snapshot si no es `None`; si es `None` (filas
legacy) cae al valor vivo. El snapshot se escribe en `open_subscription` (`domain.py:117`, el
mismo punto donde la Fase 5 puso sus guards), una vez por período. Actualizar el `help_text` de
`Discount.active` para decir que no altera períodos ya facturados.

*Limitación honesta*: las suscripciones **ya abiertas** no tienen snapshot y quedan con el
comportamiento viejo hasta que renuevan. Con `Sinkro` en 0 socios es inocuo; con data real
habría que backfillear antes de la Fase 7.3.

**P4** — cuatro puntos de toque:
1. **Crear el crédito** cuando el total baja. El punto natural es `sync_subscription_paid`
   (`services.py:298-323`), que ya centraliza "el total cambió": si `paid_amount > total`,
   crear `Payment(concept="credit", amount=-(paid_amount - total), subscription=<sub>,
   member=<member>, notes="Sobrepago por baja de total")`.
2. **Crear el crédito también al ingresar un pago mayor al total** (agregado el 2026-09-29 tras
   la línea base de la 7.0). El punto 1 sólo cubre el sobrepago que nace de un *reprecio*; la
   medición encontró 4 suscripciones —157.002, socios `2` y `8`— donde el sobrepago nace en el
   asiento del pago y `total_vivo == contrato`, así que el punto 1 no las ve nunca. Es además
   el caso más común en la vida real: cobrar dos meses contra un mes, o un mes contra un
   período prorrateado. Si la 7.3 sólo implementa el punto 1, el bug queda vivo para el caso
   más común.
3. **Consumirlo** en `create_next_subscription`, topeado por el total de la suscripción nueva.
4. **Exponerlo** con `member_credit_balance(member)` en las vistas de deuda y el portal del socio.

**El crédito se adjunta a la suscripción que lo consume** (para que el saldo baje solo, que es
lo pedido) y el origen queda en `applied_to` + `notes`. La suscripción de origen conserva
`paid_amount > total`, que no es deuda: es el asiento histórico.

**Contabilidad elegida al implementar (decisión del usuario, 2026-09-29).** El crédito **no**
cuenta como cobrado: `paid_amount` excluye `concept="credit"` en los 7 agregados que lo
calculaban, y `remaining` descuenta aparte lo consumido en ese período (`credit_realized_for`).
Es lo único que hace cumplir el invariante sin doble conteo:

| | `total` | `paid` (caja) | crédito | `remaining` |
|---|---|---|---|---|
| mes de origen, tras la baja | 0 | 52.000 | −52.000 (abierto) | 0 |
| período nuevo, tras consumir | 52.000 | 0 | −52.000 (en esa suscripción) | 0 |

Dos consecuencias aceptadas a conciencia:

1. **La rama `is_comp` de `subscription_remaining_balance` ya no fuerza `paid_amount = total`.**
   Devuelve el pago real y el `overpayment` real, con `remaining` en 0. Antes respondía
   "pagó $0" sobre una suscripción con $52.000 cobrados; ése era el punto de P4 (la pérdida se
   hacía invisible justo en el socio que la suffered). Un cortesía con un pago real puede ahora
   tener saldo a favor, que es exactamente el dinero que se quedó con el pase.
2. **Un crédito consumido por completo se mueve entero** (cambia de `subscription` y se le pone
   `applied_to=<origen>`) en vez de dejar una copia. Con copia, un crédito de $30.000 cubierto
   en dos partes se contaría dos veces. En el uso parcial se parte la fila: el resto
   queda abierto en el origen y la porción aplicada viaja en una fila nueva.

`member_credit_balance` suma sólo los créditos **abiertos** (`applied_to IS NULL`), o sea lo que
el gym le debe todavía. Un corteśía nunca consume: no paga, no hay crédito que aplicarle.
`recover_member` tampoco consume (no es una renovación); con `Sinkro` en 0 socios es inocuo.

**Criterio de aceptación**:
- Invariante de crédito: pago de $52.000 → pase de cortesía → `remaining == 0` **y** existe
  `Payment(concept="credit", amount=-52000)` **y** la renovación de octubre lo consume y queda
  en 0. Si el crédito no se consume solo en octubre, el diseño del punto 3 está mal.
- Invariante del punto 2: un pago de $35.000 contra un total de $22.000 deja
  `Payment(concept="credit", amount=-13000)`. Sin este caso, el crédito del punto 1 no lo
  cubre nunca porque el total no se movió.
- `calculate_subscription_total` con descuento desactivado a mitad de un período **pagado**
  devuelve el total original, no el nuevo.
- Un período abierto **después** de desactivar el descuento ya se emite sin descuento.
- Un período legacy (`discount_percent_snapshot IS NULL`) sigue con el descuento vivo: es la
  limitación honesta de la 7.3 y por eso importa que `Sinkro` esté en 0 socios.
- `SubscriptionItem` no se toca: el descuento vive en la suscripción, no en los ítems.
- Un crédito de $80.000 contra un período de $50.000 deja $30.000 abiertos para el período
  siguiente: el tope es el total del período, no el saldo.
- `sync_subscription_paid` repetido sobre el mismo sobrepago no duplica el crédito.
- Los 19 tests existentes siguen verdes.
- Nuevos: `CourtesyCreditFrozenDiscountTests` (5) y `MemberCreditBalanceTests` (10).

**Commit**: `feat(subscriptions): saldo a favor y descuento congelado por período`

---

#### Fase 7.4 — Arreglar este documento (sólo texto)

Siete puntos donde el plan se contradecía a sí mismo, ya corregidos al cierre de la Fase 7:
los headers de las Fases 1 y 2 que decían PENDIENTE con sus criterios ya verificados, la
sección 1.7 que listaba como pendiente lo que estaba hecho, el funnel de 1.4 con los conteos
del borrador, el "`main` no se toca" que ya era falso, la verificación global #4 nunca cerrada,
y los 8 números de bug sin fuente. Se hacen **dentro** de la Fase 7 porque el archivo ya se está
tocando. No requiere código ni tests.

---

#### Lo que queda para la Fase 8 (MEDIO y BAJO, no de la Fase 7)

| | Bug | Ubicación | Sev |
|---|---|---|---|
| P8 | Una **recuperación de sesión perdona dos faltas**: al otorgan borra el no_show ya descontado, y el cron siguiente `_pending_recovery_credits` suprime la falta más reciente otra vez. El filtro es por `(member, activity)`, no por enrollment → con 2 inscripciones a la misma actividad perdona N | `attendance/recovery_service.py:475-479` + `activities/no_show_service.py:88-92` | MEDIO |
| P9 | **Running no tiene descuento por no-asistencia ni recuperación.** `no_show_service.py:235-256` recorre actividades y PT; `recovery_service.py:188-190` rechaza todo `kind` fuera de `("training","activity")` | `activities/no_show_service.py:235-256` | MEDIO |
| P10 | Darse de baja de **un horario cancela el ítem compartido de otro**: el ítem es por outing/actividad, no por horario. PT tiene el guard `other_active` (`personal_training/assignment_service.py:345-352`); outings y actividades no | `outings/enrollment_service.py:283-300`, `activities/enrollment_service.py:299-317` | MEDIO |
| P11 | La **asistencia de staff no consume la sesión** del paquete de salida: sólo lo hace el check-in por QR | `attendance/serializers.py:307-322` | MEDIO |
| P12 | Borrar una suscripción en el admin deja sus `Payment` con `subscription=NULL` (`SET_NULL`): no computan en ningún saldo pero siguen en la caja; si el período se reabre, doble cobro | `payments/models.py:31-38`, `subscriptions/admin.py:5-25` | MEDIO |
| P13 | El fallback `total += subscription.plan.price` reintroduce el **precio vigente** —que el propio docstring prohíbe— cuando falta el ítem de plan | `subscriptions/services.py:255-256` | BAJO |
| P14 | `subscription.paid` queda desincronizado cuando el total cambia por ítems: nadie llama `sync_subscription_paid` desde `apply_plan_change` ni desde `mutate_membership` | `subscriptions/services.py:298-323` | BAJO |
| P15 | El watermark `no_show_scan_until` avanza aunque el cap trunque las faltas: si el socio amplía el paquete, esas faltas nunca se descuentan | `activities/no_show_service.py:83-95, 189-190` | BAJO |
| P16 | El bulk de créditos de la renovación **no filtra `applied_to__isnull=False`**, al revés de `credit_realized_for`: cuenta como ya pagado en el período los créditos **abiertos** que ese mismo período generó. `payment_blocked` ve `remaining = 0` donde debería ver `> 0`, y la renovación no cobra un saldo real | `subscriptions/services.py:1440-1447` (contra `credit_realized_for`, `:355-379`) | MEDIO |

**Regla de la Fase 8**: 8.0 de métricas propias primero, igual que la 7.0. Los MEDIO son
feature work (P9, P10 y P11 son de running, no de dinero) y probablemente merecen su propio
plan.

#### P16 en detalle — el bulk que no replica el filtro de `credit_realized_for`

**Registrado el 2026-09-30. No corregido. Es el bug más difícil de ver de todos los del plan,
porque la línea que lo causa es la que la Fase 2 escribió bien.**

La Fase 2 eliminó un N+1 en `_collect_renewal_candidates` y, de paso, escribió el patrón que hoy
se usa en todas partes: precalcular los pagos en bulk y pasar el saldo ya hecho con
`_precomputed_remaining` (`services.py:1352`). Ese patrón quedó **sin el filtro de
`applied_to`**, y `credit_realized_for` sí lo tiene:

```python
# credit_realized_for (services.py:371-378) — el original
Payment.objects.filter(
    subscription=subscription,
    concept="credit",
    applied_to__isnull=False,     # <-- sólo créditos CONSUMIDOS
)

# bulk de _collect_renewal_candidates (services.py:1440-1447) — el que falta
Payment.objects.filter(
    subscription_id__in=sub_ids,
    concept="credit",             # <-- sin el applied_to
)
```

**Por qué el filtro importa, con el caso concreto.** El ciclo de vida de una fila de crédito
(services.py:491-550): nace en el período que la generó con `subscription=origen` y
`applied_to=None`; al consumirla en una renovación, la fila **se mueve** y queda
`subscription=nuevo, applied_to=origen`. El `applied_to` no nulo significa "esta plata ya se gastó
en este período". El docstring de `credit_realized_for` (`:363-366`) lo dice sin rodeos: un crédito
abierto *"is parked on the period that generated it and is not money spent on that period yet:
counting it twice would inflate that period's overpayment"*.

**El daño es sub-cobro, y necesita dos pasos para dispararse** (por eso es MEDIO y no ALTO):

1. El total del período **baja** después del cobro → se crea el crédito abierto. Esto ya lo
   describen P4 y P5, y es el comportamiento correcto.
2. El total del período **vuelve a subir**: se reactiva el descuento, se saca el pase de cortesía,
   se reactiva una actividad/PT. Es el caso que P5 ya dice que existe, con el snapshot congelado.

En el paso 2 el período vuelve a deber, y el cálculo correcto es `remaining = total - paid > 0`.
Con el bulk sin filtro da `remaining = total - paid - crédito_abierto`, que da ≤ 0. O sea: **el
gym no cobra una deuda que sí existe**, y el socio pasa de `overdue` a `paid` sin haber pagado.
`payment_blocked` (`services.py:1456`) es el que decide si eso bloquea el acceso o deja renovar.

**Por qué no lo arreglo junto con el N+1 que sí arreglé.** Corregirlo cambia el resultado de
`payment_blocked`, o sea la decisión de **renovar o bloquear el acceso**. Eso es lógica de dinero
que la sección 5 exige verificar con arnés propio, y no corresponde colarlo en un commit de
performance. Además el caso del paso 2 necesita un test que arme el estado exacto — crédito
abierto + total que sube — y ese test **no existe**.

Alcance real: $0 hasta ahora (misma respuesta que la Fase 7 — el único gym con socios reales tiene
histórico thin). Se corrige antes de que entre el primer socio, no porque haya costado plata.

> **Corolario del mismo bug, ya resuelto (2026-09-30).** Al arreglar el N+1 de
> `gym_outstanding_subscriptions` había dos caminos para calcular el crédito: usar
> `_precomputed_remaining` (el de la renovación, que hereda el bug) o pasar el crédito a
> `subscription_remaining_balance` (el que sí replica el filtro). **Se eligió el segundo
> precisamente para no propagar P16.** El helper nuevo `consumed_credit_by_subscription`
> (`services.py:382`) deja el `applied_to__isnull=False` en un solo lugar, escrito junto a
> `credit_realized_for`, así que las dos implementaciones no pueden volver a divergir en silencio.

---

## 3-bis. Fix de performance del dashboard (2026-09-30) — HECHO (`ab56e53`)

Distinto de las fases: no es un bug de dinero, es **el mismo N+1 de la Fase 2 en la función
hermana**, y sólo se veía porque el desarrollo local apunta a una base remota.

`gym_outstanding_subscriptions` (`services.py:1064`) recorre **todo el historial de suscripciones
del gym** (sin filtro de fechas) y por cada una pedía su crédito con
`credit_realized_for`: 1 query por suscripción. Con `backend/.env` apuntando a Neon en
`us-east-1` (~160 ms por query, medido), el panel del profesor se caía:

```
/api/dashboard/  ->  35.86 s  /  230 queries  (211 = una por suscripción)
timeout del frontend (api.js:3) = 30 s  ->  "La petición tardó demasiado"
```

En Render no se veía: el servidor está en la misma región que la base. El bug era real en los dos,
lo que hacía que los otros endpoints de pago fueran igual de caros sin que nadie lo midiera.

**Lo que se cambió** (`subscriptions/services.py`, 68 líneas):

- `subscription_remaining_balance` acepta `credit_realized=None` precomputado, con el mismo
  patrón que ya tenía `paid_amount`. Default `None` y no `Decimal("0")` a propósito: tiene que
  distinguir "no vine" de "vine y es cero".
- Helper nuevo `consumed_credit_by_subscription` (`:382`): un query, con el `applied_to` correcto.
- `gym_outstanding_subscriptions` y `member_total_outstanding_debt` lo usan. Los dos bucles
  materializan la lista y filtran por `subscription_id__in=[...]` en vez del subquery.

**Medición (misma DB, antes y después con `CaptureQueriesContext`)**:

| Endpoint | Antes | Después | Payload |
|---|---|---|---|
| `/api/dashboard/` (Gym Dev, 211 subs) | 35.86 s / 230 q | **3.67 s / 20 q** | idéntico |
| `/api/dashboard/` (Gym Demo, 95 subs) | 17.47 s / 113 q | **2.96 s / 19 q** | idéntico |
| `/api/subscriptions/outstanding/` (Gym Dev) | 221 q | **11 q** | idéntico |
| `member_total_outstanding_debt` × 40 socios | — | — | idéntico |

El gate de este fix es el que corresponde: **el JSON de la respuesta tiene que ser idéntico
byte a byte**. Se comparó la respuesta completa de los dos endpoints antes y después: idéntica.
Un refactor de performance que cambia un número no es un refactor de performance.

Al momento de escribir este fix, `manage.py test subscriptions` corría con 53 tests y **8 fallos
preexistentes, ninguno nuevo** (verificado contra el árbol limpio con `git stash`: la lista de
fallos era la misma función por función). Eran los que las filas 7.1a-7.1d y 7.3a-7.3c marcaban
"sin verificar" — es decir, tests escritos sin ejecutar. **Los 8 están resueltos hoy**: `a000871`
reporta que se van 2 `ERROR` y que 6 quedaban por tests mal seteados, `9a051c8` deja 52/53 y
`ab56e53` cierra el que faltaba. El conteo vigente y si hay una corrida nueva está en el punto 1
de la sección 5.

**Lo que quedó sin hacer, a propósito** (no es la causa del problema y amerita fase propia):

| | Qué | Dónde | Por qué no ahora |
|---|---|---|---|
| 1 | Se arman dicts con `photo.url` de Cloudinary para **todas** las filas de debt y después se corta a 10 | `config/api/dashboard.py:200-260` | Reordenar es cambiar el orden de un slice; sin test del orden es un cambio de comportamiento disfrazado de perf |
| 2 | `gym_activity/personal_training/outing_package_debt` corren aunque el gym no tenga la feature habilitada | `dashboard.py:201, 220, 239` | Requiere leer `activities_enabled` / `personal_training_enabled` / `outings_enabled` y es semántica de features, no perf |
| 3 | `paid_at__date__gte` envuelve la columna y anula el índice; `Payment` no tiene `(gym, paid_at)` y `Member`/`RoutineAssignment` no tienen índice para su `order_by` | `dashboard.py:59-67`, `payments/models.py`, `members/models.py`, `routines/models.py` | Necesita migración. Con el N+1 arreglado el endpoint ya está en 3.67 s: el índice es la Fase 8, no el fix de hoy |

---

## 4. Commits

Fases 0-6 (ya commiteadas):

```
chore(audit): arnés read-only para verificar el código real de renovación
perf(subscriptions): limpiar auto_renew al renovar y eliminar el N+1 de candidatos
fix(subscriptions): saltar por período en vez de por socio (#1)
fix(subscriptions): claim atómico en vez de lock de sesión, y atómico por socio
fix(subscriptions): guards de escritura para PT e is_comp (#2/#48)
test(subscriptions): tests focalizados de bugs de dinero
```

Fase 7 (un commit por sub-fase; todas hechas, con los hashes reales):

```
6bd6a91 chore(audit): métricas read-only de los bugs de la Fase 7            ← 7.0
22107ff fix(subscriptions): los PT por paquete no generan cuota mensual (#2)  ← 7.2
9185300 fix(members): persistir is_comp antes de recalcular la suscripción (#48)      ← 7.1a
baa7fb8 fix(subscriptions): prorratear por días el pase de cortesía (#2/#48)         ← 7.1b
2eba60b fix(subscriptions): restaurar PT mensual al prorratear al quitar el pase      ← 7.1c
35c3577 fix(subscriptions): neutralizar y restaurar paquetes en el toggle del pase     ← 7.1d
a06f6f2 feat(subscriptions): saldo a favor y descuento congelado por período     ← 7.3
a000871 fix(members): el prefetch no puede ocultar relaciones filtradas (#2/#48)      ← P17
9a051c8 fix(subscriptions): acreditar sólo el crecimiento del sobrepago                 ← P18
ab56e53 test(subscriptions): bulk credit lookup y claim concurrente con timeouts
15bce65 test(subscriptions): cerrar la matriz del toggle de cortesía
```

Los cuatro commits de la 7.1 no son uno: el orden importa porque cada uno reorganiza el flujo del
mismo archivo. `a000871` (P17) parece de la 7.2 y no lo es — es la vuelta de P1, y por eso está
del lado de los tests y no del lado de la 7.2.

**Orden de ejecución de la Fase 7**: 7.0 → **7.2 (hecha)** → 7.1 → 7.3 → 7.4. La 7.2 va antes que
la 7.1 a propósito: es el fix más chico de la fase y el bug más caro, así que sirve para calibrar
cuánto tarda un fix con su test antes de meter las dos migraciones de la 7.3. Salió bien: 13
tests, 2 desvíos menores del diseño y una regla más simple de la que estaba escrita.

> Corrección 2026-09-29: la 7.2 **no** es "una línea". P1 tiene dos vías de escritura
> (`ensure_pt_items_for_active_assignments` y `_copy_personal_training_items`, esta última
> llamada desde 4 sitios). Ver el detalle en "P1 en detalle".

---

## 5. Verificación global (al final)

> **La suite completa del backend tiene 7 rojos preexistentes (2026-09-29)**, verificados
> idénticos con y sin los cambios de la Fase 7 (`git stash` + rerun): 4 `FAIL` + 3 `ERROR` en
> `accounts.tests.LoginTests`, `attendance.tests.PublicCheckinAccessTests`,
> `members.tests.PublicRegisterSecurityTests`, `members.tests.MemberCreateTests` y
> `gyms.tests.GymClosedDateHolidaysTests`. **No son de esta fase y no se tocan acá**; el comando
> para verlos es `.venv/bin/python manage.py test` (107 tests), mientras que el gate de esta fase
> es `manage.py test subscriptions`. Si se arreglan, es trabajo aparte.
>
> **⬜ Los dos números de arriba (7 rojos y 107 tests) están sin re-medir desde el 2026-09-29.**
> Quedan así a propósito: son la última medición real y no hay forma de actualizarlos sin correr la
> suite completa, que es lo que falta. Dos razones por las que conviene dejarlos así:
>
> - **CI no corre la suite completa.** `.github/workflows/backend-tests.yml:60` corre sólo
>   `python manage.py test subscriptions`. Nadie va a detectar que uno de los 7 rojos se arregló o
>   se rompió: no está en ningún pipeline.
> - La corrida tiene que ser contra **Postgres**, no SQLite, desde `ab56e53`. Un número medido en
>   SQLite no es comparable con uno medido en Postgres, así que cambiar de base a mitad de camino
>   rompe la serie histórica en vez de extenderla.
>
> La última palabra sobre el gate de la fase está en el punto 1 de abajo.

1. **⬜ `manage.py test subscriptions` — sin corrida posterior a `15bce65`.** El gate de la Fase 7
   es este, y lo que se sabe del estado de la suite es lo que está escrito en los mensajes de
   commit, no una corrida propia:

   | Corrida | Resultado | Registrado en |
   |---|---|---|
   | `a000871` | `subscriptions members` → 66 tests; se van 2 `ERROR`, quedan 6 rojos "tests mal seteados" + 4 preexistentes de `members` | mensaje del commit |
   | `9a051c8` | `subscriptions` → 53 tests, **52 pasan**; el 1 restante era `test_legacy_period_without_snapshot_keeps_live_discount` leyendo un `Discount` cacheado | mensaje del commit |
   | `ab56e53` | corrige ese test y mueve el gate a Postgres; **no reporta un conteo final** | mensaje del commit |
   | `15bce65` | suma 8 tests de la matriz del toggle; **no ejecutados** | este documento |

   El paquete tiene hoy **62 métodos `test_`** (55 en `test_money_bugs.py`, 7 en `tests.py`),
   contando estáticamente y sin ejecutar: ese es el número que debería dar la corrida, no 53. Si
   no coincide, la diferencia es un test saltado o una clase que no se descubre: investigar antes
   de escribir el número acá.
2. `audit_renewal_dryrun` contra **staging** (post-Fase 3, verificado 2026-09-28):

   | Concepto | Valor |
   |---|---|
   | candidatos crudos | 371 |
   | `covered` + `auto_renew=False` | 235 |
   | `skipped_stale_backlog` + `auto_renew=False` | 90 |
   | `skipped_inactive_gym` | 7 |
   | `skipped_inactive_member` | 0 |
   | `skipped_blocked` | 38 |
   | `renewed` | **1** (socio 801) |
   | `skipped_already` | 193 (post-Fase 6; 236 antes del guard de `gym.active`) |
   | suma de contadores del desglose | **371** |
   | queries de la llamada real | 24 (≤ 40) |
   | escrituras del arnés | 3 detectadas (1 UPDATE + 2 INSERT), **0 persistidas** |
   | suscripciones retroativas creadas para `Gym Demo` | 0 |
   | socios 812 / 785 / 793 / 829 con doble septiembre | 0 |
   | claim CAS (fila vencida / segundo worker) | 1 / 0 → `not_due` |
   | `last_status` durante la corrida / al final | `running` / `ok` |
   | `deduct_missed_sessions` | `atomic()` por gym |
   | `manage.py auto_renew_subscriptions` | pasa por `run_scheduled_tasks(force=True)` |
   | audit #2 PT sin ítem / #48 is_comp con total>0 (Fase 5) | 0 / 0 (verificado 2026-09-28) |

   Los números del borrador (`stale 40 / gym 51 / member 1 / blocked 43`) mezclaban cortes
   de la métrica #19 con el orden de guards; el arnés es la referencia (ver Fase 2 y Fase 3).

3. Repetir el arnés contra **producción**, sólo lectura, antes de aplicar (verificado 2026-09-28):
   funnel 371 → `covered 235 / stale 90 / gym 7 / member 0 / blocked 36 / candidates **3**`;
   `renewed **3**` (socios 801, 793, 803 — Gym Dev, targets septiembre, sucesores agotados),
   `skipped_already 195`, **escrituras 7 (1 UPDATE + 3×(sub+ítem)) todas roladas / 0 persistidas**,
   queries de la llamada real 51 (el delta vs staging son los 2 renovados extra; no hay huecos
   retroactivos ni dobles meses — `812/785/829` quedan cubiertos, `socio 827` intacto). El
   `renewed==1` de staging era staging; en producción el valor correcto es 3.
4. **⬜ PENDIENTE — la única verificación de las Fases 0-6 que nunca se cerró.** Esperar una
   corrida real del `TaskRun` en producción y confirmar `last_duration_seconds` < 15 s, y
   confirmar con el usuario que el 502 de las 6h desapareció.

   No se puede cerrar desde el código: depende de un request real que dispare el middleware.
   Con `Sinkro` en 0 socios y todo el radio de impacto en data de prueba, esta corrida va a
   salir con `renewed: 0` o con renovaciones de socios de `Gym Demo`/`Gym Dev`. Lo que
   **sí** se puede verificar sin ella, y conviene hacerlo antes de dar por buena la Fase 2:

   ```sql
   -- en producción, sólo lectura
   SELECT name, last_run, last_status, last_duration_seconds, last_result
     FROM subscriptions_taskrun ORDER BY name;
   ```

   Si `last_status` es `"ok"` y `last_duration_seconds` < 15, la Fase 2 funcionó. Si sigue
   pidiendo > 120 s, el 502 sigue vivo y esto vuelve a ser urgencia.

5. Conteo de queries antes/después documentado en el mensaje del commit de la Fase 2.

6. **Fase 7** — **⬜ checklist abierto.** Es lo único que le falta a la fase, que en código está
   cerrada desde el 2026-10-02. Ninguna de estas filas se midió en esa sesión:

   | Concepto | Valor |
   |---|---|
   | `manage.py test subscriptions` | **⬜ sin corrida desde `15bce65`** — ver el punto 1 de esta sección |
   | arnés `audit_renewal_dryrun` | **sin cambios**: `renewed 1`, contadores 235/90/7/0/38/1, Σ371 |
   | contador P1 (PT paquete con ítem de cuota) | `confirmados` **no crece** sobre la línea base de la 7.0 |
   | contador P2/P3 (ítems > 0 en socio `is_comp`) | `cerrados` **no crece** sobre la línea base (los del socio 827 no se tocan); todo ítem **positivo** de un cortesía en período **vigente** tiene **crédito que lo cubra** (estado final que sólo entrega la 7.3 — criterio reescrito en 7.1, ver Fase 7.1) |
   | contador P4 (`paid_amount > total` sin crédito) | `confirmados = 0` (con `is_comp` excluido explícitamente) |
   | contador P5 (período pagado con descuento vivo distinto) | `confirmados = 0`, y en ambas direcciones por separado |
   | escrituras de los 4 contadores | **0** |
   | invariante del crédito | saldo a favor se crea **y se consume en la renovación** |
   | arnés antes/después de la 7.2 | idéntico — la 7.2 no toca el renovador |

   Los tres contadores que piden "no crece" en vez de `= 0` están así a propósito: los ítems
   históricos de `is_comp` están **fuera de alcance por decisión explícita** (sección 1.5), así
   que exigirles 0 haría el gate inalcanzable y sólo tentaría a tocar lo que no se toca. El
   `= 0` va donde sí es exigible: los bugs que nacen de código y no de datos viejos.

**Si `renewed` no da 1, o si los contadores no suman 371, o si algún socio con septiembre
abierto aparece en la lista de renovados, el fix está mal y hay que volver a la Fase 3.**

**Si algún contador de la Fase 7 **crece** sobre su línea base, o si el crédito no se consume
solo en la renovación siguiente, la 7.3 está mal y hay que volver a la 7.0 antes de seguir.**

---

## 6. Fuera de alcance

No se toca:

- Ni la contraseña de la base, ni la configuración de Render.
  ~~`main`~~ — **ya se tocó**: `main` y `development` comparten árbol. Ver la nota de arriba.
- Mover el trigger a un cron externo o a un thread (decisión 3 de la sección 2).
- Los ítems históricos de los socios `is_comp` (sólo se reportan).
- Los 21 gyms de prueba de producción.
- No se agrega `charge_token_error` ni `hire_date` al modelo: son ondas posteriores y
  requieren migración.
- No se resuelve la deuda de los bloqueados (38 bajo el orden de guards vigente): es decisión
  de negocio (decisión 2 de la sección 2).
- Los bugs MEDIO y BAJO P8-P15: van a la **Fase 8**, ver la tabla al final de la sección 3.

### Los números `#32, #30, #35, #18, #40, #38, #33, #37` — sin fuente

Este documento los mencionaba en "fuera de alcance" sin describirlos nunca. Al auditarlos el
2026-09-28 se comprobó que **no existen en ninguna parte del código**:

```bash
rg '#(32|30|35|18|40|38|33|37)\b' backend/ --glob '!**/.venv/**'   # -> 0 resultados
```

El `audit_money_bugs` implementa exactamente siete secciones: **#1, #2, #4, #5, #6, #19 y
#48**. Ninguna más. Esos ocho números vienen de un listado externo (issue tracker o una versión
anterior de este documento) que no está en el repo, así que **no hay forma de saber a qué se
refieren**.

Mientras no aparezca la fuente, quedan afuera por unknowable, no por decisión. Si el negocio
tiene el listado original, agregarlo acá y priorizarlo es un paso de la Fase 8.

---

## 7. Notas de seguridad

- `backend/.env.audit-prod` contiene la URL de producción con credenciales. Está ignorado por
  `.gitignore` (`.env.*`). **No imprimir, no commitear, no copiar su valor.**
- Antes de cada commit: `git status` y revisar que el archivo no aparece.
- Nunca imprimir passwords, tokens ni la URL completa en output, logs o mensajes.