# Plan — Bugs de dinero en suscripciones

Rama de trabajo: `development`. `main` no se toca.
Test runner: Django (`manage.py test`). No hay pytest.

## CÓMO RETOMAR ESTE TRABAJO

Estado: **Fases 0-6 commiteadas en `development` (2026-09-28).**
Los tests focalizados corren contra SQLite con:

```
DATABASE_URL=sqlite:////tmp/f6_test.sqlite3 SECRET_KEY=... .venv/bin/python manage.py test subscriptions
```

| Fase | Qué | Estado | Commit |
|---|---|---|---|
| 0 | Métricas del audit por período | **CERRADA** | `bf6b28a` (+ docs `0d76102`) |
| 1 | Arnés read-only `audit_renewal_dryrun` | **CERRADA** | `d14dfc9` |
| 2 | Limpiar `auto_renew` + eliminar N+1 + orden de guards | **CERRADA** | `51022c1` |
| 3 | #1: skip por período, no por socio | **CERRADA** | `7401f0a` |
| 4 | Claim atómico + atómico por socio | **CERRADA** | `4b8022a` |
| 5 | Guards de escritura #2 y #48 | **CERRADA** | `a5271ed` |
| 6 | Tests focalizados | **CERRADA** | `23438bf` |

Reglas para retomar:

1. Leé las secciones 1 y 2 (contexto y decisiones). Son el porqué.
2. **No rehagas la Fase 0.** Ya está commiteada. Sus números verificados están en la
   sección 3, Fase 0. La nueva verificación es el arnés de la Fase 1, no el audit.
3. Ejecutá las fases de la sección 3 **en orden**, una por vez. No arranques la Fase N+1
   sin cerrar la N.
4. Después de cada fase, corré su criterio de verificación. Si no coincide, **frená** y
   reportá en vez de seguir.
5. Un commit por fase, con los mensajes de la sección 4.
6. Al final, la verificación global de la sección 5.

Pendientes sueltos que **no** son parte de ninguna fase, para que no se pierdan:

- Los números de esta versión del plan se midieron contra **staging** el 2026-09-28. Antes
  de implementar, correr el arnés de la Fase 1 contra **producción** (read-only) para
  confirmar que el diagnóstico no se movió.
- Los 45 socios de `Gym Demo` congelados quedan sin suscripción al aplicar la Fase 3. Si el
  negocio quiere reactivarlos, se usa `recover_member` (`services.py:888`), **no** el
  auto-renovador. Es decisión de negocio, fuera del plan.
- Los ítems históricos del socio 827 (Diego Salvado, julio y agosto, 25.000) **no** se tocan.
  Sólo se reportan.

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
.venv/bin/python manage.py audit_money_bugs
unset DATABASE_URL DATABASE_URL_PROD
```

El valor debe ir entre comillas simples: contiene `&`.

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

| Etapa | n |
|---|---|
| con sucesora que cubre el target (se limpian) | 235 |
| sin sucesora (a evaluar) | 136 |
| → socios en gym inactivo | 51 |
| → socios inactivos | 1 |
| → bloqueadas por impago al vencimiento | 43 |
| → candidatos que pasan todos los guards | 41 |

De los 41: **40** pertenecen a `Gym Demo` con target en un mes cerrado (pagados, congelados
por H1 desde junio) y **1** es el socio 801 de `Gym Dev` con target septiembre (ese es la
única renovación esperada).

Deuda de las 43 bloqueadas: 3.659.100, **0 con pagos posteriores al vencimiento**. 38 en
gyms activos, 5 en inactivos. Es la política de `access_block_day`, no un bug.

Los socios 812, 785, 793 y 829 (Gym Dev) tienen septiembre cubierto **sólo por overlap a
mitad de mes** (sucesora que empieza el 3, 17, 18 y 17): si el keying de skip pasa a ser por
fecha exacta, se les crearía una segunda suscripción de septiembre. Por eso el skip sigue
siendo por overlap.

#### Números de renovaciones esperadas (post fases)

| Etapa | n |
|---|---|
| candidatos crudos | 371 |
| `skipped_already` + `auto_renew=False` | 235 |
| `skipped_stale_backlog` + `auto_renew=False` | 40 |
| `skipped_inactive_gym` (no se limpia) | 51 |
| `skipped_inactive_member` | 1 |
| `skipped_blocked` (no se limpia) | 43 |
| **`renewed`** | **1** (socio 801, Gym Dev, 220.000 pagados) |

**Invariante: los contadores suman 371**: `235 + 40 + 51 + 1 + 43 + 1 = 371`. Si no, el fix
está mal.

El pool queda estable en ~96 filas (51 gyms inactivos + 1 socio inactivo + 43 deudores + la
rotación mensual) en vez de crecer 40-50 por mes. Las 51 de gyms inactivos y las 43 de deudores
**no** se limpian a propósito: si el gym se reactiva o el deudor paga, la corrida los renueva.

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

### 1.7 Pendiente — el alcance real de este plan

1. `_find_already_renewed_members` (`services.py:1038`): devuelve `member_id` en vez de
   períodos → **H1**, 45 socios congelados. Más el OR de 371 clauses (742 parámetros).
2. `create_next_subscription` (`services.py:875`): no limpia `auto_renew` del padre → **H2**,
   235 filas fantasma que crecen mes a mes.
3. `_collect_renewal_candidates` (`services.py:1014-1035`): N+1 y latencia → **H3**, el
   timeout.
4. `run_scheduled_tasks` (`services.py:1373`): un único `transaction.atomic()` con lock
   *transaction-scoped*. Un timeout de 120s revierte todas las renovaciones. El lock debería
   ser por claim atómico (H5 abajo) y el `atomic()` externo se saca.
5. `management/commands/auto_renew_subscriptions.py:15` llama `auto_renew_subscriptions()`
   directo y **saltea el lock**.
6. #2 y #48: sólo hay guard de lectura, falta el de escritura → resuelto en la Fase 5.

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

### Fase 1 — Arnés de verificación `audit_renewal_dryrun` — ⬜ PENDIENTE (siguiente)

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

### Fase 2 — Performance: limpiar `auto_renew`, eliminación del N+1, orden de guards — ⬜ PENDIENTE

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

**Commit**: `test(subscriptions): tests focalizados de bugs de dinero`

---

## 4. Commits

```
chore(audit): arnés read-only para verificar el código real de renovación
perf(subscriptions): limpiar auto_renew al renovar y eliminar el N+1 de candidatos
fix(subscriptions): saltar por período en vez de por socio (#1)
fix(subscriptions): claim atómico en vez de lock de sesión, y atómico por socio
fix(subscriptions): guards de escritura para PT e is_comp (#2/#48)
test(subscriptions): tests focalizados de bugs de dinero
```

---

## 5. Verificación global (al final)

1. `.venv/bin/python manage.py test subscriptions` — todos verdes, incluidos los 7
   preexistentes.
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
4. Esperar una corrida real del `TaskRun` y confirmar `last_duration_seconds` < 15 s; confirmar
   con el usuario que el 502 de las 6h desapareció.
5. Conteo de queries antes/después documentado en el mensaje del commit de la Fase 2.

**Si `renewed` no da 1, o si los contadores no suman 371, o si algún socio con septiembre
abierto aparece en la lista de renovados, el fix está mal y hay que volver a la Fase 3.**

---

## 6. Fuera de alcance

No se toca:

- `main`, ni la contraseña de la base, ni la configuración de Render.
- Mover el trigger a un cron externo o a un thread (decisión 3 de la sección 2).
- Los ítems históricos de los socios `is_comp` (sólo se reportan).
- Los 21 gyms de prueba de producción.
- Los bugs #32, #30, #35, #18, #40, #38, #33, #37.
- No se agrega `charge_token_error` ni `hire_date` al modelo: son ondas posteriores y
  requieren migración.
- No se resuelva la deuda de los 43 bloqueados: es decisión de negocio (decisión 2).

---

## 7. Notas de seguridad

- `backend/.env.audit-prod` contiene la URL de producción con credenciales. Está ignorado por
  `.gitignore` (`.env.*`). **No imprimir, no commitear, no copiar su valor.**
- Antes de cada commit: `git status` y revisar que el archivo no aparece.
- Nunca imprimir passwords, tokens ni la URL completa en output, logs o mensajes.