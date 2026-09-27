# Plan — Bugs de dinero en suscripciones

Rama de trabajo: `development`. `main` no se toca.
Test runner: Django (`manage.py test`). No hay pytest.

## CÓMO RETOMAR ESTE TRABAJO

Estado: **plan escrito, ejecución sin empezar.** La Fase 0 es el próximo paso.

1. Leé las secciones 1 y 2 (contexto y decisiones). Son el porqué.
2. Ejecutá las fases de la sección 3 en orden, una por vez.
3. Después de cada fase, corré su criterio de verificación. Si no coincide, **frená** y reportá en vez de seguir.
4. Un commit por fase, con los mensajes de la sección 4.
5. Al final, la verificación global de la sección 5.

Contexto ya verificado que **no hace falta volver a medir**: la auditoría contra staging y
producción está hecha, con 0 escrituras. Los números de referencia están en la sección 1.2.
No repitas esa auditoría como primer paso; corregí la métrica primero (Fase 0) y usala
como línea base.

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

`development` **no** escribe en la base real. Confirmado en el panel de Render.

**Credenciales**: la URL de producción está en `backend/.env.audit-prod` (ignorado por
`.gitignore`, regla `.env.*`). No imprimir ese archivo, no commitearlo, no copiar su valor a
ningún lado. La contraseña ya fue rotada y nunca está en el chat.

Conexión: pooler Neon con `sslmode=require`, `connect_timeout`. Se accede desde la máquina
local, no hay SSH ni Render Shell.

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

### 1.2 Resultados de la auditoría (0 escrituras, ambos ambientes)

| Métrica | Staging | Producción |
|---|---|---|
| Socios activos | 147 | 148 |
| Candidatos vencidos con `auto_renew` | 371 | 371 |
| #1 saltados mal (métrica vieja, incorrecta) | 123 | 123 |
| #2 PT activo sin ítem de PT | 0 | 0 |
| #4/#6 socios atrapados (sin suscripción + deuda) | 81 | 79 |
| #5 PlanChangeRequest approved con `effective_date` vencida | 0 | 0 |
| #19 candidatos en gym con `active=False` | 94 | 94 |
| #48 socios `is_comp` con total > 0 | 0 | 0 |
| Queries / escrituras detectadas | 1.346 / **0** | 1.332 / **0** |

La auditoría es estrictamente de lectura: corre dentro de `transaction.atomic()` con
`transaction.set_rollback(True)` y `force_debug_cursor`. `Ctrl+C` es seguro.

### 1.3 Realidad de los datos de producción

3 gyms activos:

| id | Nombre | Creado | Socios | Activos | Suscripciones |
|---|---|---|---|---|---|
| 9 | Gym Dev | 2026-06-23 | 62 | 56 | 213 |
| 10 | Gym Demo | 2026-06-23 | 50 | 45 | 95 |
| 49 | **Sinkro** | 2026-09-18 | **0** | 0 | 0 |

Los otros 21 gyms están desactivados y son de prueba (`Test`, `V`, `V2`, `prueba`,
`Debug Gym`, `Sinkro Prueba`, `Pepito`, etc.).

**Todos los socios afectados por estos bugs son datos de QA. El negocio real (`Sinkro`)
está vacío.** Consecuencia: hoy el radio de impacto de cualquier fix es sólo data de
pruebas, que es la ventana más barata posible para corregirlos. En cambio, `#56` (los 502
cada 6h) es un riesgo real incluso con cero socios, y golpea justo cuando `Sinkro` entre
en producción.

No borrar ni tocar los 21 gyms de prueba: no es necesario para este plan.

### 1.4 Descomposición de #1 (el hallazgo central)

De los 123 "saltados mal" que reporta el audit actual:

- **44 pierden la renovación de septiembre 2026** (el período actual) → bug real.
- **79 apuntan a meses ya pasados**: 26 de hace 1 mes, 51 de hace 2 meses, 2 de hace 6 meses.
  Son rezago histórico inofensivo, no pérdida.

Distribución de socios afectados: 83 con 2 candidatas, 4 con 3, 36 con 4 (promedio 2,62).
Los duplicados **no** se solapan entre sí (1 de 123).

Ejemplo real (socio con 4 suscripciones, todas `origin=onboarding`, gym 9):

```
id=1385   2026-05-01 -> 2026-05-31  auto=True paid=True
id=1384   2026-06-24 -> 2026-06-30  auto=True paid=True
id=30491  2026-07-01 -> 2026-07-31  auto=True paid=False   (su período SÍ tiene sucesora)
id=1477   2026-08-01 -> 2026-08-31  auto=True paid=False   <-- SIN sucesora, target = septiembre
```

La de agosto pierde septiembre, y se saltea porque la de julio tiene sucesora.

**Causa raíz**: `_find_already_renewed_members` (`services.py:1038-1060`) devuelve un set de
`member_id`, y `auto_renew_subscriptions` (`services.py:1267`) saltea el socio **entero** si
está en ese set. El skip debería ser por **período**.

#### Descomposición medida de los 136 candidatos sin sucesora

Medido con el audit corregido (Fase 0), 2026-09-26. Staging y producción dan los mismos
números para estos conteos.

| | gym activo | gym inactivo | total |
|---|---|---|---|
| target en el mes en curso | 39 | 7 | **46** |
| target en meses ya cerrados | 46 | 44 | **90** |
| | 85 | 51 | 136 |

Reconciliación de los 13 que hoy sí se renuevan: **2** apuntan al mes en curso y **11** a
meses ya cerrados. Por eso el total con target vivo es 46 (2 + 44) y no 57 (13 + 44).

**Consecuencia de diseño, acordada con el usuario**: los 90 de meses ya cerrados **no se
back-fillean**. Se saltean como rezago inerte. Sin este guard, el fix de #1 crearía
suscripciones con fecha en meses cerrados, casi siempre impagadas, que es exactamente el
patrón de "atrapado" de #6 — el fix introduciría un bug nuevo.

**Número de renovaciones esperado: 39** (46 con target vivo, de los cuales 7 caen en gym
inactivo y los salta #19).

### 1.5 Hallazgo colateral de #48

El único socio `is_comp` de producción (Diego Salvado, id 827, gym 9) tiene las suscripciones
de julio (`id=1475`) y agosto (`id=1557`) con un ítem `plan` **activo de 25.000** y `paid=True`.
La de septiembre (`id=30628`) está limpia, con ítems a 0,00.

El audit da #48 = 0 porque sólo mira el mes actual.

La protección actual es de **lectura**: `subscription_remaining_balance` (`services.py:296-303`)
fuerza `remaining = 0` para socios `is_comp` sin importar qué haya en la base. Eso protege las
pantallas de deuda, pero `calculate_subscription_total` sigue devolviendo 25.000, así que
cualquier informe o export que use el total crudo muestra la cifra equivocada, y los datos
sucios se acumulan mes a mes.

Son 25.000 de un socio de cortesía en un gym de prueba: no es plata real. **No tocar esos
ítems históricos sin autorización aparte**; sólo reportarlos.

### 1.6 Ya implementado — NO rehacer

- `Procfile`: un solo proceso web, `gunicorn --workers=1 --timeout=120 --max-requests=1000 --max-requests-jitter=50`.
  El worker separado (que era lo que sufría el OOM cada 6h) ya no existe.
- `backend/config/api/middleware.py`: `ScheduledTaskTriggerMiddleware`, disparo perezoso.
- `services.py:1337` `maybe_run_scheduled_tasks`: camino barato sin lock.
- `services.py:1081` `_apply_all_due_plan_changes`: **cierra #5**. Los plan changes vencidos se
  aplican para todos los socios, no sólo los candidatos de renovación.
- `services.py:1159` `apply_plan_change`: idempotente y atómico.
- `models.py:58-63`: `unique_subscription_member_period` + `CheckConstraint` `end_date >= start_date`.
- `models.py:158-163`: un `PlanChangeRequest` pending por socio.
- Los 15 commits de seguridad (`98e72e2`, `4b6503e`, `d4ede6d`, `6e16b4a`, `90871d6`, etc.).

### 1.7 Pendiente — el alcance real de este plan

1. `_find_already_renewed_members` (`services.py:1038`): clave por `member_id` + OR de 371
   clauses (742 parámetros).
2. `_collect_renewal_candidates` (`services.py:1014-1035`): N+1, y sin guard de `gym.active`.
3. `run_scheduled_tasks` (`services.py:1373`): un único `transaction.atomic()` con lock
   *transaction-scoped* → un timeout de 120s revierte las 371 renovaciones.
4. `management/commands/auto_renew_subscriptions.py:15` llama `auto_renew_subscriptions()`
   directo y **saltea el lock**.
5. #2 y #48: sólo hay guard de lectura, falta el de escritura.

### 1.8 Infraestructura de tests

- `backend/core/testing.py`: `BaseAPITest` con `create_gym`, `create_user`, `create_plan`,
  `open_subscription` y helpers de liquidación.
- `backend/subscriptions/tests.py`: 7 tests existentes a preservar — 4 en
  `ScheduledTaskRunnerTests` (incluido `test_lock_beats_concurrent_workers`) y 3 en
  `ScheduledTasksEndpointTests`.

```bash
cd backend && .venv/bin/python manage.py test subscriptions
```

---

## 2. Decisiones cerradas

- **#19**: un gym desactivado **NO** renueva a sus socios. Se saltean y se cuentan.
  **No** se baja `auto_renew` a `False` (sería una mutación de datos; hoy no es necesario).
- **#2 y #48**: guard de escritura (el dato sucio no entra) **más** el guard de lectura
  existente como red de seguridad. Sin cambios a datos históricos.
- **Auditoría**: se corrige y se commitea, sólo en `development`.
- **Alcance**: las 7 fases completas, en orden.
- **Commit**: uno por fase, estilo convencional como el resto del repo.

---

## 3. Fases

### Fase 0 — Corregir la métrica del audit — **HECHA**

**Archivo**: `backend/subscriptions/management/commands/audit_money_bugs.py`

Hoy la sección #1 agrupaba por `member_id`. Ahora calcula el daño **dos veces** en la misma
corrida: con la semántica member-level actual (la que genera el bug) y con la period-level
que implementa la Fase 1, para que una sola corrida muestre el antes y el después.

Se agregó además el escaneo de **ítems pagados en periodos cerrados de socios `is_comp`**
(`_comp_closed_period_items`), que antes no se miraba. Sólo informa.

Resultado medido (staging y producción dan lo mismo en estos conteos):

| Métrica | Valor |
|---|---|
| candidatos vencidos | 371 |
| **hoy** se renuevan | 13 |
| **hoy** salteados por tener el socio ya renovado | 123 |
| → de los cuales, pérdida del período actual | 44 |
| → de los cuales, rezago histórico inerte | 79 |
| **post #1** saltados OK (sucesora en su propio período) | 235 |
| **post #1** sin sucesora | 136 |
| → target en el mes en curso (se renuevan) | 46 |
| → target en meses ya cerrados (rezago inerte, no back-fillear) | 90 |
| #19 candidatos totales en gym inactivo | 94 |
| #19 sin sucesora en gym inactivo | 51 |
| #48 deuda fantasma vigente | 0 |
| #48 ítems pagados en periodos cerrados | 2 (socio 827) |
| Queries / escrituras | 1.347 / **0** |

**Desvío encontrado respecto de la estimación original**: el plan daba 57 renovaciones
esperadas (`13 + 44`). El valor correcto es **39**. Ver la sección 1.4.

**Verificación**: hecha. Todos los valores de referencia del plan coinciden; los de
"después del fix" se recalcularon con el dato real.

---

### Fase 1 — #1: skip por período

**Archivos**: `backend/subscriptions/services.py` líneas 1038-1060 y 1260-1270

`_find_already_renewed_members` pasa a `_find_covered_periods`.

Se reemplaza el OR de 371 clauses por **una** query con rango, y el solapamiento se evalúa en
Python:

```python
Subscription.objects.filter(
    member_id__in=member_ids,
    start_date__lte=max_target_end,
    end_date__gte=min_target_start,
).values_list("member_id", "start_date", "end_date")
```

Devuelve el set de `(member_id, target_start)` cubiertos. En el loop de
`auto_renew_subscriptions`, el skip compara esa tupla en vez del `member_id` pelado.

**Guard obligatorio 1 — duplicados en la misma corrida**: si dos candidatas del mismo socio
comparten `target_start` y no hay sucesora, la primera crea el período y la segunda choca
contra `unique_subscription_member_period`. Llevar un set de períodos atendidos en la corrida
y saltar las siguientes.

**Guard obligatorio 2 — no back-fillear meses cerrados** (decisión de la sección 1.4): un
candidato cuyo `target_start` ya pasó respecto del mes en curso se saltea como rezago inerte.
Sin este guard el fix crea suscripciones en meses ya cerrados, que es el bug #6. En producción
son 90 candidatos; el más viejo es de mayo.

Los dos guards se colocan en `_collect_renewal_candidates`, que ya es el lugar donde viven los
demás filtros (`member.active`, pago, plan base). Así los tres filters —inactivo, mes cerrado y
los guards previos— quedan juntos y contados en un solo lugar.

**Verificación**: `saltados_ok` 235 sin cambio, `sin sucesora` 136, `se renuevan` 46, cero
`IntegrityError`, y el `rezago inerte` queda en 90 sin crear nada.

---

### Fase 2 — #19: no renovar socios de gym inactivo

**Archivo**: `backend/subscriptions/services.py:1014`, dentro de `_collect_renewal_candidates`,
después del guard de `member.active`:

```python
if not sub.gym.active:
    inactive_count += 1
    continue
```

Orden importante: el guard de gym inactivo va **antes** del de mes cerrado, para que un
candidato de gym inactivo con target viejo se cuente una sola vez y no se doble registre.

`_collect_renewal_candidates` devuelve `(candidates, counters)`. Se agregan
`skipped_inactive_gym` y `skipped_stale_backlog` al dict de resultado de
`auto_renew_subscriptions`, para que queden en `TaskRun.last_result` y sean observables. No
muta datos.

No romper los contadores que ya devuelve `auto_renew_subscriptions` (`renewed`,
`skipped_already`, `failed`); sólo se agregan los nuevos.

**Verificación**: `se renuevan` 46 → **39**, `skipped_inactive_gym` = 7,
`skipped_stale_backlog` = 90, ambos visibles en `TaskRun.last_result`.

---

### Fase 3 — Lock de sesión y fin del `atomic()` gigante

**Archivo**: `backend/subscriptions/services.py` (1314-1423) y
`backend/subscriptions/management/commands/auto_renew_subscriptions.py:15`

**El riesgo**: `run_scheduled_tasks` mete las 371 renovaciones en un único
`transaction.atomic()`, y el lock es *transaction-scoped*. Si la corrida pasa los 120s de
`--timeout=120`, gunicorn mata el worker y se revierte **todo**: cero renovaciones
persistidas. El trigger perezoso lo empeoró, porque ahora corre dentro de un request web.

Cambios:

- `_acquire_task_lock`: `pg_try_advisory_xact_lock` → `pg_try_advisory_lock` (nivel sesión).
- Nuevo `_release_task_lock` con `pg_advisory_unlock`, invocado en un `finally`.
- Sacar el `atomic()` externo. `create_next_subscription` (`services.py:866`) **ya** es
  atómico por socio, así que un timeout pierde **una** renovación en vez de 371.
- Si el proceso muere, la conexión se cierra y el lock se libera solo.
- Path no-Postgres: ambos no-op, para no romper `test_lock_beats_concurrent_workers`.
- `last_run` se sigue actualizando **al final**, así que una corrida muerta a medias reintenta
  en la próxima request. No adelantar el update.
- **Agujero de concurrencia a cerrar**: `management/commands/auto_renew_subscriptions.py:15`
  llama `auto_renew_subscriptions()` directo y saltea el lock. Debe pasar por
  `run_scheduled_tasks(force=True)`.

**Riesgo asumido**: un proceso trabado sin cerrar la conexión mantiene el lock y frena las
corridas siguientes. Mitigación: `finally` siempre, y los 7 tests del runner verifican que
"no corre dos veces" se mantiene.

**Alternativa documentada, no elegida**: `select_for_update` sobre `TaskRun` con timestamp de
vencimiento. Evita el lock de sesión pero es más frágil ante caídas de conexión. Si el test
de concurrencia falla, se reevalúa esta alternativa.

**Verificación**: los 7 tests existentes pasan; una corrida abortada a mitad deja las
renovaciones ya confirmadas en la base.

---

### Fase 4 — #57: eliminar el N+1

**Archivos**: `backend/subscriptions/services.py:1014-1035` y
`backend/plans/services.py:64-68`

Hoy hay ~4 queries por candidato. Fuentes confirmadas:

1. `get_base_plan_for_gym` (`plans/services.py:67`) sin memoizar: 371 queries donde alcanzan
   **3**, uno por gym. → dict local cacheado por gym dentro de la corrida.
2. `subscription_remaining_balance` (`services.py:262`): un aggregate de `Payment` por
   suscripción. → un
   `Payment.objects.filter(subscription_id__in=...).values('subscription_id').annotate(Sum('amount'))`
   y pasarle `paid_amount` (la función ya lo acepta).
3. El `.exists()` de `is_first` por socio, dentro de `get_subscription_payment_status`. → un
   `Min('created_at')` agrupado por `member_id`.
4. **A verificar antes de prometer número**: `calculate_subscription_total` puede consultar
   ítems por su cuenta. Si es así, prefetchea en la misma query.

`get_subscription_payment_status` ya acepta `remaining` e `is_first` precomputados, así que no
cambia su firma. Calcular sólo para las candidatas que superan los guards anteriores, para no
gastar queries en las que se van a saltear.

**Verificación**: contar `len(connection.queries)` con `force_debug_cursor`, de ~1500 a menos
de 50, **sin** cambio en los conteos de suscripciones ni de ítems de PT.

---

### Fase 5 — Guards de escritura #2 y #48

**Archivos**: los puntos de escritura de suscripciones —
`backend/subscriptions/services.py` (`create_next_subscription`, `recover_member`,
`open_subscription` en `domain.py`) y el alta de ítems.

Sin cambios a datos existentes. Sólo reglas de escritura. Los guards de lectura se conservan.

- **#2**: al abrir o reactivar una suscripción, si el socio tiene una asignación de PT activa,
  se crea el ítem de PT correspondiente. Hoy 0 afectados → preventivo puro.
- **#48**: al marcar `is_comp` o al agregar un ítem a un socio `is_comp`, el total queda en 0
  y no se admiten ítems pagados. El guard de lectura de `services.py:296-303` sigue como red
  para lo que ya exista en la base.

Si al implementar #48 aparece alguna vía de escritura que no pase por estos puntos (por
ejemplo el admin o un importador), preferí el guard en el modelo o en el serializer antes que
parcheos sueltos. Verificá con `grep -rn 'is_comp' backend --include='*.py' | grep -v .venv`.

**Verificación**: los tests nuevos pasan, el audit sigue dando 0 en #2 y #48, y los datos de
Diego Salvado no cambian.

---

### Fase 6 — Tests focalizados

**Archivo nuevo**: `backend/subscriptions/test_money_bugs.py`, sobre `BaseAPITest` de
`backend/core/testing.py`.

1. **#1** — socio con dos suscripciones vencidas: una con sucesora y la del período actual sin
   ella. Debe renovar **sólo** la del mes en curso.
2. **#1 borde, duplicado** — dos candidatas del mismo socio con el mismo `target_start` y sin
   sucesora. Debe crear una sola, sin `IntegrityError`.
3. **#1 borde, mes cerrado** — candidato con `target_start` en un mes ya pasado y sin sucesora.
   No debe crear nada (guard de rezago inerte).
4. **#19** — gym con `active=False` y candidato con target vivo. No debe crear renovación, y el
   resultado debe traer `skipped_inactive_gym` = 1.
5. **#5** — `PlanChangeRequest` approved con `effective_date` vencida en un socio que **no** es
   candidato de renovación. Debe aplicarse igual.
6. **#2** — socio con PT activo y suscripción vigente sin ítem de PT. La recuperación debe
   crear el ítem.
7. **#48** — socio `is_comp` con ítems pagados. El total debe dar 0.

Más los 7 tests existentes de `backend/subscriptions/tests.py`.

```bash
cd backend && .venv/bin/python manage.py test subscriptions
```

---

## 4. Commits

```
chore(audit): métricas de #1 y #19 por período
fix(subscriptions): skip de renovación por período en vez de por socio (#1)
fix(subscriptions): no renovar socios de gym inactivo (#19)
fix(subscriptions): lock de sesión y atómico por socio, evita pérdida masiva en timeout
perf(subscriptions): eliminar N+1 en selección de candidatos (#57)
fix(subscriptions): guards de escritura para PT e is_comp (#2/#48)
test(subscriptions): tests focalizados de bugs de dinero
```

---

## 5. Verificación global (al final)

1. `.venv/bin/python manage.py test subscriptions` — todos verdes, incluidos los 7 preexistentes.
2. Audit contra **staging** con las métricas de la Fase 0. Criterio de aceptación:

   | Concepto | Valor esperado |
   |---|---|
   | candidatos vencidos | 371 |
   | saltados OK (sucesora en su período) | 235 |
   | sin sucesora | 136 |
   | → se renuevan (mes en curso, gym activo) | **39** |
   | → saltados por gym inactivo | 7 |
   | → saltados por rezago inerte | 90 |
   | saltados por tener el socio ya renovado (bug) | **0** |

   Los 44 de pérdida actual se tienen que ver-renovar o bloquearse por gym inactivo, pero
   nunca seguir perdida.
3. Repetir el audit contra **producción**, sólo lectura, para confirmar que el diagnóstico no
   se movió.
4. Conteo de queries antes/después documentado en el mensaje del commit de la Fase 4.

Si `se_renuevan` no da 39, o si queda algún candidato con el bug member-level, el fix de #1
está mal y hay que volver a la Fase 1.

---

## 6. Fuera de alcance

No se toca:

- `main`, ni la contraseña de la base, ni la configuración de Render.
- Los ítems históricos de los socios `is_comp` (sólo se reportan).
- Los 21 gyms de prueba de producción.
- Los bugs #32, #30, #35, #18, #40, #38, #33, #37.
- No se agrega `charge_token_error` ni `hire_date` al modelo: son ondas posteriores y
  requieren migración.

---

## 7. Notas de seguridad

- `backend/.env.audit-prod` contiene la URL de producción con credenciales. Está ignorado por
  `.gitignore` (`.env.*`). **No imprimir, no commitear, no copiar su valor.**
- Antes de cada commit: `git status` y revisar que el archivo no aparece.
- Nunca imprimir passwords, tokens ni la URL completa en output, logs o mensajes.
