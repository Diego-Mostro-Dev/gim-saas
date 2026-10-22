# BUGS — Registro general de bugs pre-lanzamiento

Estado: **2026-10-22** — Fases A a J hechas; **Fase K en curso (K0 a K5 hechas,
K6→K8 planificadas)**. Total: **107 hallazgos** — 5 `CRÍTICO`, 31 `ALTO`, 51 `MEDIO`, 20 `BAJO`.
De ellos **89 ya están cerrados**, **13 son decisiones de negocio** y quedan **5 abiertos**
(cada uno con la sub-fase de la K que lo cierra) y **0 a verificar**. Fichas de los abiertos con
explicación, ejemplo de impacto y criterio de aceptación.

> Documento de registro. **Fuente de verdad** de bugs/riesgos. Las `AUDITORIA-*.md` son el
> manual descriptivo ("cómo funciona hoy"); esto es "qué está mal y qué hacemos".
> El plan por fases vive en `PLAN-bugs.md`. Los bugs de dinero ya cerrados, en `BUG-Pagos.md`.

## Método

- Repro en rojo (`@unittest.expectedFailure`) → fix → se quita la marca → gate contra
  Postgres descartable → un commit por fase.
- **Triage:** cada hallazgo se re-verificó contra `development` por lectura de código (y
  runtime donde hizo falta); el veredicto está en la ficha. **El 2026-10-21 (K0) se
  re-verificó también los 11 que quedaban 🟡: ya no queda ninguno a verificar.**

### Leyenda

- **Severidad:** `CRÍTICO` (cobra de más / pierde plata / traba a un socio válido / 500 en
  dinero) · `ALTO` · `MEDIO` · `BAJO`.
- **Estado:** 🔴 abierto · 🟡 a verificar · 🟢 cerrado · ⚪ decisión de negocio.

### IDs por área

`DIN` dinero/suscripción · `CFG` configuración/catálogo · `ADD` add-ons (actividades/PT/salidas) ·
`ACC` acceso/portal/asistencia/horarios · `RUT` rutinas · `COM` comunidad ·
`REF` robustez/higiene/performance/cobertura.

---

## Resumen

| Área | Crítico | Alto | Medio | Bajo | Cerrados | Decisiones | Abiertos |
|---|---|---|---|---|---|---|---|
| Dinero/suscripción (`DIN`) | 0 | 7 | 8 | 3 | 14 | 3 | 1 |
| Configuración (`CFG`) | 1 | 2 | 4 | 5 | 10 | 2 | 0 |
| Add-ons (`ADD`) | 3 | 7 | 13 | 6 | 24 | 3 | 2 |
| Acceso/portal (`ACC`) | 1 | 12 | 11 | 0 | 22 | 1 | 1 |
| Rutinas (`RUT`) | 0 | 2 | 5 | 2 | 7 | 2 | 0 |
| Comunidad (`COM`) | 0 | 0 | 5 | 1 | 4 | 2 | 0 |
| Robustez/CI (`REF`) | 0 | 1 | 5 | 3 | 8 | 0 | 1 |
| **Total** | **5** | **31** | **51** | **20** | **89** | **13** | **5** |

> Las columnas "Cerrados" y "Decisiones" se solapan con las de severidad (una fila cerrada
> igual tiene severidad); sirven para leer el avance, no para sumar.

---

## Tabla maestra

| ID | Sev | Estado | Bug | Impacto (ejemplo) |
|---|---|---|---|---|
| DIN-01 | ALTO | 🟢 | Reprecio de un cambio de plan sin `sync_subscription_paid` (P21) | Cerrado Fase 2 (`BUG-Pagos.md`) |
| DIN-02 | MEDIO | 🟢 | `is_recoverable` no coincidía con `recover_member` (P24) | Cerrado Fase 4 |
| DIN-03 | MEDIO | 🟢 | Flag `paid` desincronizado (P22/P23) | Cerrado Fase 3 |
| DIN-07 | MEDIO | 🟢 | Borrar una suscripción dejaba pagos huérfanos (P12) | Cerrado (`PROTECT` + 409) |
| DIN-08 | MEDIO | 🟢 | Deuda de salidas invisible para el badge (P24) | Cerrado Fase 4 |
| DIN-09 | MEDIO | 🟢 | El badge ignoraba un cambio de plan aprobado (P24) | Cerrado Fase 4 |
| DIN-04 | ALTO | 🟢 | Un cambio de plan con efecto inmediato no consume el crédito del socio | Cerrado Fase F: helper `_open_period_with_credit` aplica el saldo en los 3 caminos (renovación, cambio inmediato por vista y `apply_plan_change`) |
| DIN-05 | ALTO | 🟢 | Otorgar una cortesía reenciende `auto_renew` | Cerrado Fase F: el toggle de cortesía ya no escribe `auto_renew` (con sub previa lo hereda; sin sub previa queda en False) |
| DIN-06 | ALTO | 🟢 | El socio que nunca pagó el primer mes igual se auto-renueva | Cerrado Fase F: `payment_blocked` frena también con `initial_pending` |
| DIN-10 | MEDIO | 🟢 | El badge rechaza socios de cortesía, pero `recover_member` los acepta | Cerrado Fase F: `get_is_recoverable` ya no excluye a los comp; badge y acción usan la misma regla |
| DIN-11 | ALTO | ⚪ | Recuperar a un socio no aplica su saldo a favor | Recupera con crédito disponible pero el período nace 100% impago |
| DIN-12 | BAJO | 🟢 | El endpoint de recuperar responde 201 aunque no cree nada | Cerrado Fase F: `recover_member` devuelve `(sub, created)`; el endpoint responde 200 (reactivación) o 201 (período nuevo) |
| DIN-13 | MEDIO | ⚪ | El chequeo de deuda corre antes que el de ciclo vigente | Inactivo con ciclo vigente + deuda residual no puede reactivarse |
| DIN-15 | MEDIO | 🟢 | `recover_member` no toma lock; la carrera la resuelve el constraint con 500 | Cerrado Fase F: el `IntegrityError` de `unique_subscription_member_period` se traduce a `SubscriptionConflictError` (400) |
| DIN-16 | ALTO | ⚪ | Recuperar no prorratea | Recuperar el día 25 cobra el mes completo por 5 días |
| DIN-17 | BAJO | 🟢 | `calculate_subscription_total` reintroduce el precio vigente (fallback P13) | Cerrado Fase K5: sin fallback; la migración 0024 crea los ítems con `price_snapshot = 0` (lo efectivamente cobrado) |
| DIN-18 | ALTO | 🟢 | Agregar sesiones a un paquete vuelve a dejar el sellado pendiente | Cerrado Fase D: `renew_package` ya no resetea `sellado_paid` |
| DIN-20 | BAJO | 🔴 | El seed deja 27 violaciones de dinero en el arnés | Gym Dev/Gym Demo/Sinkro Prueba tienen sobrepagos y `paid` invertidos: el arnés no puede exigir 0 · **K8** (higiene de seed) |
| CFG-01 | MEDIO | 🟢 | Unidades horas/días mezcladas entre pantallas | Cerrado Fase C: ambas UIs en horas, entero ≥ 0 (backend ya era entero) |
| CFG-02 | BAJO | ⚪ | `allow_member_schedule_changes` legacy | Campo que ya no gobierna ninguna regla |
| CFG-03 | MEDIO | ⚪ | `initial_pending` bloquea desde el día 1 | Socio nuevo sin primer pago no puede entrar aunque haya pagado el día 2 |
| CFG-04 | MEDIO | 🟢 | El staff crea cambios de horario sin cooldown ni máximo mensual | Cerrado Fase K4: el staff usa la misma regla que el socio (`attendance/utils.check_schedule_change_limits`); cooldown y máximo mensual se rechazan con 400 |
| CFG-05 | BAJO | 🟢 | Fallo de la API de feriados | Devuelve 502 con mensaje, no 500 (ya correcto) |
| CFG-09 | ALTO | 🟢 | No se valida precio > 0 en planes ni add-ons | Cerrado Fase C: `price > 0` (excepto base) y `monthly_price > 0` en modo mensual; `session_price = 0` permitido |
| CFG-10 | BAJO | 🟢 | Rango de descuento | Validado 1-100 (ya correcto) |
| CFG-11 | BAJO | 🟢 | `access_block_day > payment_due_day` | Validado en API, modelo y wizard (ya correcto) |
| CFG-12 | ALTO | 🟢 | Visitas semanales no se validan al alta ni al ejecutar un cambio de plan | Cerrado Fase C: `ScheduleDomain.enforce_weekly_visits` en alta y aprobación |
| CFG-13 | BAJO | 🟢 | PT en modo sesiones fuerza `monthly_price = 0` | Ya cubierto por validación + tests |
| CFG-14 | CRÍTICO | 🟢 | Actividades y salidas en modo sesiones **no** fuerzan `monthly_price = 0` | Cerrado Fase C: `BillingPriceMixin` fuerza `monthly_price = 0` en modo sesiones |
| CFG-15 | MEDIO | 🟢 | Cargar feriados sin `year` devuelve 400 en vez de usar el año actual | Cerrado Fase C: default = año actual (`gyms/views.py`); detectado por el gate de Fase C |
| ADD-01 | CRÍTICO | 🟢 | Desactivar una actividad no corta el cobro | Cerrado Fase D: la baja corta inscripciones y cancela los ítems del período en curso/futuros |
| ADD-09 | CRÍTICO | 🟢 | Desactivar una salida no corta el cobro | Cerrado Fase D: idem actividades (`cut_outing_billing`) |
| ADD-02 | MEDIO | 🟢 | Huérfanas: el portal muestra la actividad/horario desactivado | Cerrado Fase D: el portal filtra `schedule.active` y `activity.active` |
| ADD-10 | MEDIO | 🟢 | Huérfanas: idem salidas | Cerrado Fase D: idem actividades |
| ADD-03 | ALTO | 🔴 | Cambiar de horario puede dejar al socio sin ninguno | Si falla la reinscripción queda sin horario · **K7** (hoy inalcanzable: la Fase D vació la rama) |
| ADD-04 | MEDIO | 🟢 | "Restaurar horarios" revive todos, incluidos los desactivados a propósito | Cerrado Fase K2: sólo vuelven los horarios apagados con la oferta |
| ADD-05 | MEDIO | 🟢 | El choque con el gimnasio se calcula como "hora + 1 h" | Cerrado Fase K3: `ScheduleSlot.duration_minutes` y los 4 chequeos usan la duración real |
| ADD-06 | ALTO | 🟢 | El portal rompe al renderizar una actividad desactivada | Cerrado Fase K1: `gym` del outlet context + import de `txt` |
| ADD-07 | CRÍTICO | 🟢 | El no-show descuenta sesión en fechas sin clase | Cerrado Fase G: watermark clampeado a la creación del horario + se saltean días cerrados (el job nunca descuenta antes de que exista la clase) |
| ADD-08 | ALTO | 🟢 | Paquete sobre-cobrable fuera de `record_package_payment` | Cerrado: el serializer de pagos unificado valida el tope y resincroniza |
| ADD-11 | ALTO | ⚪ | Faltar a una salida no descuenta sesión | **Decisión de negocio (Fase G):** las salidas no tienen no-show ni recuperación; faltar no descuenta. Se documenta, no se implementa. |
| ADD-12 | MEDIO | 🟢 | El conteo de salidas depende de entrar dentro de la ventana | Cerrado por ACC-08 (Fase G): el descuento se centralizó en `attendance/checkin_discount.py` |
| ADD-13 | ALTO | 🟢 | Paquete de salida sobre-cobrable | Cerrado por el mismo serializer unificado |
| ADD-14 | MEDIO | 🟢 | Renovación de salidas bloqueada por sesiones impagas | Cerrado Fase K2: override explícito (`allow_unpaid`) |
| ADD-15 | BAJO | 🟢 | "Reactivar" revive todos los horarios (engañoso) | Cerrado Fase K2: restauración selectiva |
| ADD-16 | ALTO | 🟢 | Las salidas no validan choque con gimnasio/actividades/PT | Cerrado Fase K2: validador compartido en `core/overlap.py` |
| ADD-17 | MEDIO | ⚪ | El portal no ofrece salidas en modo sesiones | Decisión de negocio (K0): la salida en modo sesiones requiere inscripción del staff |
| ADD-18 | BAJO | 🟢 | Botón "Renovar" duplicado | Cerrado Fase K1: queda un solo botón |
| ADD-19 | BAJO | 🔴 | El PATCH directo de trainer/horario no está en la UI | Feature no alcanzable · **K7** |
| ADD-20 | MEDIO | 🟢 | `record_payment` de PT sin usar / desincroniza `amount_paid` | Cerrado: `RecoverMembers.jsx` lo usa y todo Payment resincroniza |
| ADD-21 | ALTO | 🟢 | En PT las faltas agotan el paquete sin recuperación | Cerrado Fase G: `SessionRecovery.kind="pt"` con FK a la asignación; la falta cancelada se repone (mismo invariante que actividades) |
| ADD-22 | MEDIO | 🟢 | Renovación de PT bloqueada por saldo impago | Cerrado Fase K2: override explícito (`allow_unpaid`) |
| ADD-23 | MEDIO | ⚪ | Desvincular PT no toca los períodos ya generados | Decisión de negocio (K0): inmutabilidad de los períodos ya generados |
| ADD-24 | BAJO | 🟢 | El wizard de asignación reconcilia el horario elegido | Cerrado Fase K1: `reconcileSlot` avisa cuando el horario se mueve |
| ADD-25 | BAJO | 🟢 | Estado `approved` muerto en PT | Cerrado Fase K1: estado fuera de `STATUS_CHOICES` + migración |
| ADD-26 | MEDIO | 🟢 | PT: reasignar a otro día no se detecta como doble-booking | No se reproduce (K0): la asignación de PT es recurrente semanal; sólo cambia el día de la serie |
| ADD-27 | MEDIO | 🟢 | Una recuperación de sesión perdona **dos** faltas | Cerrado Fase K3: la recuperación queda atada a la falta que perdona (viene de P8, Fase 8 de `PLAN-dinero.md`) |
| ADD-28 | MEDIO | 🟢 | Darse de baja de un horario corta el cobro de **toda** la oferta | Cerrado Fase K2: el ítem se cancela con la última baja |
| ADD-29 | BAJO | 🟢 | El watermark avanza sobre faltas que nunca se cobraron | Cerrado Fase K3: el watermark sólo avanza hasta la última falta cobrada (viene de P15) |
| ACC-01 | CRÍTICO | 🟢 | El cupo se cuenta a sí mismo: "El horario está completo" | Cerrado Fase E: el cupo excluye al propio socio (check-in y alta de staff) |
| ACC-02 | MEDIO | 🟢 | No hay ventana horaria de check-in | Cerrado Fase K4: `Gym.checkin_window_minutes` (0 = sin ventana) + los dos paths + la UI de configuración |
| ACC-03 | MEDIO | 🟢 | El staff puede marcar asistencia en un día cerrado | Cerrado Fase K4: el serializer de staff valida `GymClosedDate` (400) |
| ACC-04 | MEDIO | 🟢 | "Ya entró hoy" devuelve 200 con `success:false` | Cerrado Fase K4: el duplicado responde 409 y el front distingue el éxito real |
| ACC-05 | ALTO | 🟢 | Doble registro del staff → 500 | Cerrado Fase E: pre-check + `IntegrityError` → 400 en `AttendanceSerializer.create` |
| ACC-06 | ALTO | 🟢 | Límite de 30/h por IP en el portal | Cerrado Fase E: se quitó el throttle por IP; queda sólo el de token del portal |
| ACC-07 | MEDIO | 🟢 | Dos horarios el mismo día: entra una sola vez por QR | Cerrado Fase E: el QR registra una sola asistencia por día |
| ACC-08 | ALTO | 🟢 | La sesión del paquete no se descuenta si entra fuera de la ventana | Cerrado Fase G: descuento cuando la asistencia es inequívoca (una inscripción de paquete activa ese día); con varias, sólo las de la ventana |
| ACC-09 | MEDIO | 🟢 | Panel de horarios: label `executed` y filtro "Aprobadas" vacío | Cerrado Fase E: `executed` mapeado y "Aprobadas" matchea approved+executed |
| ACC-10 | ALTO | 🟢 | Aprobar desactiva el horario viejo de inmediato | Cerrado Fase K4 (decisión 2026-10-21): la UI deja de prometer vigencia futura y aclara que el cambio se aplica al aprobarlo |
| ACC-11 | ALTO | 🟢 | El cooldown de 7 días cuenta las rechazadas | Cerrado Fase E: el cooldown ignora las solicitudes rechazadas |
| ACC-12 | ALTO | 🟢 | Doble pedido de horario → 500 | Cerrado Fase E: `IntegrityError` del constraint → 409 (serializer y `_handle_action`) |
| ACC-13 | MEDIO | 🟢 | Staff crea cambios sin límites (ver CFG-04) | Duplicado de CFG-04: se cierra junto a él en **K4** |
| ACC-14 | MEDIO | 🟢 | Un horario puede quedar duplicado | Cerrado Fase K4: al aprobar se re-verifica que el horario viejo siga activo y se valida `weekly_visits` (400 si no) |
| ACC-16 | MEDIO | 🟢 | Aprobar un cambio de plan cancela pedidos de horario en silencio | Cerrado Fase K4: los pedidos se cancelan sólo al aprobar y con nota en español (al rechazar ya no se tocan) |
| ACC-17 | ALTO | 🟢 | El alta pública descarta el descuento y fuerza `is_comp=False` en silencio | Cerrado Fase E (decisión de negocio): el alta pública nunca honra `discount_id`/`is_comp` (son privilegios de staff) y deja warning en logs para asignarlos desde el panel |
| ACC-18 | ALTO | 🟢 | Rotación de token deja el link viejo muerto | Cerrado Fase E: todos los endpoints del portal aceptan el token de una generación anterior (gracia de 1 generación; 2+ invalidado por diseño) |
| ACC-19 | MEDIO | 🟢 | Teléfono único por gimnasio | Cerrado Fase K5: constraint parcial por gym + 400 explícito; la migración 0019 limpia los duplicados antes de crear el índice |
| ACC-20 | MEDIO | 🔴 | Borrar un socio es hard delete en cascada | Sin papelera; se pierde historial · **K6** (decisión 2026-10-21: baja lógica) |
| ACC-22 | MEDIO | ⚪ | Quitar la cortesía exige elegir un plan de pago | Decisión de negocio (K0): es correcto que quitar la cortesía obligue a elegir un plan de pago |
| ACC-23 | ALTO | 🟢 | Obra social sin match → texto libre sin precio | Cerrado Fase K5: el texto sin match queda marcado y enlazable desde el panel; el alta pública ofrece la lista de obras del gym |
| ACC-24 | ALTO | 🟢 | 500 al pedir cambio de horario de PT | Cerrado `f27bc67` (bug real no documentado en ninguna auditoría) |
| ACC-25 | ALTO | 🟢 | Login con contraseña incorrecta → 500 y Axes no registra el intento | Cerrado Fase E: `authenticate(request=...)`; responde 400 y Axes registra el `AccessAttempt` |
| ACC-26 | ALTO | 🟢 | El portal no puede dar de baja una inscripción de actividad | Cerrado Fase K1: `DELETE /api/activities/public/<token>/` (baja pública) + front |
| RUT-01 | ALTO | 🟢 | Sin control de rol en rutinas | Cerrado Fase H: `require_routine_manager` (owner/staff/professor); el trainer recibe 403 |
| RUT-02 | MEDIO | 🟢 | Asignación con hard DELETE | Cerrado Fase H: `RoutineAssignment.delete()` es soft delete (`active=False`) y el ViewSet no expone DELETE (405) |
| RUT-03 | MEDIO | 🟢 | Sin unicidad de rutina activa; bulk-assign no atómico | Cerrado Fase H: índice único parcial `(gym, member) WHERE active=True` + `bulk-assign` en `transaction.atomic()` |
| RUT-04 | BAJO | 🟢 | Un ejercicio desactivado por PATCH sigue saliendo en la rutina | Cerrado Fase H: `MemberRoutineSerializer.get_exercises` filtra `is_active=True` |
| RUT-05 | BAJO | 🟢 | `RoutineExerciseViewSet` sin `GymModelViewSet` | No se reproduce: `RoutineExercise` no tiene campo `gym` |
| RUT-06 | ALTO | ⚪ | Endpoints públicos exponen pagos, deuda y estado de acceso | Decisión de negocio (Fase H): el token del portal ES la credencial del socio y el portal necesita esos datos para operar |
| RUT-07 | MEDIO | 🟢 | La app no tiene tests | Cerrado Fase H: `routines/tests_phase_h.py` (16 tests: rol, soft delete, unicidad, atómico, ejercicio inactivo) |
| RUT-08 | MEDIO | ⚪ | El progreso se resetea por día | Decisión de negocio (Fase H): sin historial de entrenamiento; se documenta y no se implementa |
| RUT-09 | MEDIO | 🟢 | `/routines` no está en `ProfessorRoute` | Cerrado Fase H: guard `RoutineManagerRoute` (owner/staff/professor; trainer → `/trainer-agenda`) |
| COM-01 | MEDIO | ⚪ | Un socio inactivo sigue accediendo a su tarjeta pública | Decisión de negocio (Fase I): todo el portal es accesible a socios inactivos a propósito (subir comprobante para destrabar); la tarjeta no es un dato sensible |
| COM-02 | MEDIO | ⚪ | `discount` es texto libre y no participa de ningún cobro | Cerrado Fase C (validación no vacío). El descuento del local es informativo y no toca la facturación: decisión de negocio (Fase I) |
| COM-03 | MEDIO | 🟢 | Sin unicidad de `name` por gimnasio → duplicados | Cerrado Fase I: constraint parcial `uniq_community_business_name_per_gym` `(gym,name) WHERE active=True` + `IntegrityError` → 400 |
| COM-04 | MEDIO | 🟢 | `business.delete()` es hard delete | Cerrado Fase I: baja lógica (`active=False`); DELETE devuelve 204 sin borrar la fila |
| COM-05 | MEDIO | 🟢 | `community` no tiene tests | Cerrado Fase I: `community/tests.py` (15 tests: discount, soft delete, unicidad, rol, visibilidad pública). Sumada al CI en Fase J (`REF-02`) |
| COM-06 | BAJO | 🟢 | El panel de comunidad se muestra a roles que recibirán 403 | No se reproduce (Fase I): `/settings` está en `ProfessorRoute` y `Settings.jsx` redirige a no-owner a `/dashboard`; la pestaña sólo aparece con la feature activa |
| REF-01 | MEDIO | 🟢 | Apps sin tests: `profiles`, `seed`, `core` | Cerrado Fase J: primeras suites de `profiles`, `seed` y `core` (`core/tests.py`, `core/tests_admin_scoping.py`) |
| REF-02 | MEDIO | 🟢 | El CI no corre varias apps | Cerrado Fase J: el CI corre todas las apps con tests (gyms, admins, accounts, personal_training, routines, community, profiles, seed, core) |
| REF-03 | MEDIO | 🟢 | Consultas de dinero sin filtro de gym | Cerrado Fase J: `member_credit_balance`, `credit_recorded_for` y `consume_member_credit` filtran por gym; tests de aislamiento |
| REF-04 | BAJO | 🟢 | Admin `paid`/`price_snapshot` editables | Premisa falsa: ya están en `readonly_fields` |
| REF-05 | BAJO | 🔴 | El frontend no tiene tests y el lint tiene deuda | Decisión 2026-10-21: entra en la K — lint a 0 y bloqueante en el CI · **K7** |
| REF-06 | BAJO | 🟢 | `validate_discount` es código muerto | Cerrado Fase J: renombrado a `validate_discount_id`; el descuento de otro gimnasio ahora da 400 |
| REF-07 | MEDIO | 🟢 | N+1 en listados de asistencia y suscripciones | Detectado y cerrado Fase J: prefetch de suscripciones del socio, y `select_related` en recuperaciones/cambios/items; tests con `assertNumQueries` |
| REF-08 | MEDIO | 🟢 | Admin sin scope de gimnasio (fuga de datos) | Detectado y cerrado Fase J: `GymScopedAdminMixin` en todos los admins de modelos que cuelgan del gimnasio; tests en `core/tests_admin_scoping.py` |
| REF-09 | ALTO | 🟢 | Sin `FRONTEND_URL` los constructores de URLs dan 500 | Detectado por CI (Fase J): `settings.FRONTEND_URL` era `None` y `None + str` → `TypeError` en `Gym.get_onboarding_url`/`get_public_register_url`, admin y `GymSeoView`; ya no corre en el CI sólo porque faltaba la variable. Cerrado: default `""` + guardas en los call sites; tests `FrontendUrlMissingTests` |

---

## Fichas — Dinero / suscripción (`DIN`)

### DIN-04 · Un cambio de plan con efecto inmediato no consume el crédito
- **Severidad:** ALTO · **Estado:** 🟢 · **Resolución Fase F.**
- **Explicación:** el camino del día 1 (`create_next_subscription`) consumía el saldo a favor;
  el de efecto inmediato (aprobar con fecha de efecto HOY, sin ciclo vigente) no llamaba a
  `consume_member_credit`, ni en la vista ni en `apply_plan_change`.
- **Fix:** se extrae `_open_period_with_credit` (abrir período → copiar ítems → consumir
  crédito → sincronizar `paid`) y se reusa en los tres caminos: renovación, aprobación
  inmediata por vista y `apply_plan_change`. El helper deja divergir de nuevo imposible.
- **Criterio de aceptación:** el período creado por efecto inmediato descuenta el crédito
  disponible de la misma forma que la renovación. (Cubierto en `test_money_fase_f.py`.)

### DIN-05 · La cortesía reenciende `auto_renew`
- **Severidad:** ALTO · **Estado:** 🟢 · **Resolución Fase F.**
- **Explicación:** `mutate_membership(comp=True)` escribía `current.auto_renew = True`
  incondicionalmente; en el branch sin ciclo vigente se abría con `auto_renew=True` fijo.
- **Fix:** el toggle de cortesía ya no escribe `auto_renew`. Con sub vigente lo conserva tal
  cual; sin sub previa, `_inherit_auto_renew` toma el valor de la última sub del socio o
  `False` si no hay ninguna (dar un beneficio no es un contrato de renovación).
- **Criterio de aceptación:** dar/quitar cortesía no altera `auto_renew` que eligió el socio.
  (Cubierto en `test_money_fase_f.py`.)

### DIN-06 · El impago inicial no frena la renovación
- **Severidad:** ALTO · **Estado:** 🟢 · **Resolución Fase F.**
- **Explicación:** `get_subscription_payment_status` devuelve `initial_pending`, pero
  `payment_blocked()` sólo frenaba con estado `blocked`, así que el socio que nunca pagó el
  alta se auto-renovaba y apilaba deuda nueva sobre la vieja.
- **Fix:** `payment_blocked` frena cuando el status es `blocked` **o** `initial_pending`.
  `initial_pending` es la señal más fuerte de impago: el socio jamás demostró intención de
  pagar. El guard es sobre el estado actual del período, no un flag permanente.
- **Criterio de aceptación:** primer mes impago → no renueva; tras pagar, renueva.
  (Cubierto en `test_money_fase_f.py`.)

### DIN-10 · El badge rechaza comp; la acción no
- **Severidad:** MEDIO · **Estado:** 🟢 · **Resolución Fase F.**
- **Explicación:** `get_is_recoverable` devolvía `False` si `is_comp`, pero `recover_member`
  no tiene ningún gate por comp: el badge y la acción decían cosas distintas.
- **Fix:** se quita el early-return de comp en `get_is_recoverable`; ahora badge y servicio
  usan exactamente la misma regla (deuda, plan base, sub futura/vigente). Un comp recuperable
  muestra el botón y el POST funciona; uno con deuda sigue oculto por la regla de deuda.

### DIN-11 · Recuperar no aplica el saldo a favor
- **Severidad:** ALTO · **Estado:** ⚪ decisión de negocio
- **Explicación:** `recover_member` no llama a `consume_member_credit` (sólo lo hace
  `create_next_subscription`).
- **Ejemplo de impacto:** socio con crédito disponible recupera y su período nace 100% impago.

### DIN-12 · El endpoint de recuperar siempre responde 201
- **Severidad:** BAJO · **Estado:** 🟢 · **Resolución Fase F.**
- **Fix:** `recover_member` devuelve `(subscription, created)`. El endpoint responde **200**
  cuando sólo reactiva sobre un período vigente (Caso A, no crea nada) y **201** cuando abre
  un período nuevo (Caso B).

### DIN-13 · El chequeo de deuda corre antes que el de ciclo vigente
- **Severidad:** MEDIO · **Estado:** ⚪ (documentado como intencional)
- **Explicación:** `member_total_outstanding_debt > 0` se evalúa antes del Case A.
- **Dónde:** `backend/subscriptions/services.py:1423` antes de `:1428-1433`.

### DIN-15 · Recuperar sin lock
- **Severidad:** MEDIO · **Estado:** 🟢 · **Resolución Fase F.**
- **Explicación:** `open_subscription` toma `select_for_update` sobre un query de overlap,
  pero en recovery no hay filas que lockear; lo que evita el ciclo duplicado es el constraint
  `unique_subscription_member_period`, que ante doble click devolvía **500**.
- **Fix:** el `IntegrityError` del constraint se traduce a `SubscriptionConflictError` (400).
  El `except` va por fuera del `atomic()` para no dejar rota la transacción del caller.
- **Criterio de aceptación:** la carrera se resuelve con un error controlado, no con 500.
  (Cubierto en `test_money_fase_f.py`.)

### DIN-16 · Recuperar sin prorrateo
- **Severidad:** ALTO · **Estado:** ⚪ decisión de negocio
- **Ejemplo de impacto:** recuperar el día 25 cobra el mes completo por 5 días.

### DIN-17 · Fallback de precio (P13)
- **Severidad:** BAJO · **Estado:** 🟢 (Fase K5) · **Sub-fase:** K5
- **Explicación:** `if not has_plan_item ... total += subscription.plan.price` para filas legacy.
- **Dónde:** `backend/subscriptions/services.py:326-327`.
- **Dimensionado (2026-10-21, staging):** 422 suscripciones, 357 con ítem de plan activo y
  **65 sin ningún ítem de plan** (todas `origin="onboarding"`, del 2025-12-02 al 2026-07-30) →
  son las que caen en el fallback. **Causa raíz:** ventana entre la migración
  `0012_create_subscriptionitem` (2026-07-01, con backfill) y el commit `4022326` (2026-07-31)
  que añadió `ensure_subscription_item(sub)` a `open_subscription`. Hoy todas las altas pasan
  por `open_subscription` → no se generan más filas huérfanas. Las 65 están vencidas y sin
  pagos, así que el daño monetario actual es ~0, pero el fallback sigue vivo: cualquier fila sin
  ítem se factura al precio del día en vez del contratado. La invariante I1
  (`backend/core/money_invariants.py:86-93`) ya detecta estas filas.
- **Criterio de aceptación:** se quita el fallback + una migración crea los ítems faltantes con
  `price_snapshot` congelado (el precio histórico no está en la fila: hay que decidir el
  criterio — precio del plan al momento de la migración, o el importe efectivamente pagado) +
  un test que prohíba el fallback.
- **Resolución Fase K5 (decisión 2026-10-21):** `price_snapshot = 0` —lo **efectivamente
  cobrado**: las 65 filas legacy están vencidas y sin pagos, y ese ítem no se vuelve a facturar.
  `calculate_subscription_total` suma sólo los ítems y `_report_missing_plan_item` deja un ERROR
  en los logs si aparece una fila sin ítem (visibilidad en vez de precio inventado). La
  migración `0024_backfill_missing_plan_items` crea el ítem con `price_snapshot = 0` y
  `paid = True` (nada que cobrar), idempotente. Se aplicó sobre la copia local de staging: de
  **65 filas** en el fallback a **0**; el arnés de invariantes bajó de **125 a 27**
  violaciones y `audit_money_bugs` quedó idéntico. Las 27 restantes son datos de `seed/base.py`
  (nueva ficha `DIN-20`, no de código de facturación).
- **Tests:** `backend/subscriptions/tests_phase_k5.py` (11 tests: sin fallback, backfill con y
  sin pagos, idempotencia, ítem sin plan, `paid` normalizado, total sólo por ítems).

### DIN-18 · Agregar sesiones vuelve a pedir el sellado
- **Severidad:** ALTO · **Estado:** 🟢 (Fase D)
- **Explicación:** `renew_package` setea `sellado_paid = False` en actividades (documentado
  como intencional) y en PT (sin justificación).
- **Ejemplo de impacto:** se cobra el sellado de nuevo al ampliar el paquete.
- **Dónde:** `backend/activities/session_service.py`, `backend/personal_training/session_service.py`.
- **Resolución Fase D (decisión "no re-cobrar"):** `renew_package` ya **no** resetea
  `sellado_paid` (se quita de `update_fields`): el sellado se cobra una vez por inscripción.
  Aplica a actividades y PT. Cubierto por `activities/tests_deactivation.py`
  (`ActivitySelladoRenewalTests`) y `personal_training/tests_deactivation.py`
  (`PTSelladoRenewalTests`).

### DIN-20 · El seed deja violaciones de dinero en el arnés
- **Severidad:** BAJO · **Estado:** 🔴 · **Sub-fase:** K8 (higiene de seed)
- **Detectado por:** K5, al correr el arnés de invariantes sobre la copia local de staging
  después de `DIN-17`.
- **Explicación:** de las 27 violaciones que quedan en el arnés, ninguna viene de código de
  facturación: son datos de `backend/seed/base.py` en los gyms de demo. Reparto: **Gym Dev 19**
  (6 de I3 —`paid` invertido— y 13 de I4 —sobrepago sin crédito—), **Gym Demo 5** (I3) y
  **Sinkro Prueba 3** (2 I4 y 1 I5 —períodos solapados—).
- **Ejemplo de impacto:** el arnés no puede exigir 0 violaciones y una regresión real se
  esconde entre el ruido del seed; además el demo muestra socios con saldos imposibles.
- **Dónde:** `backend/seed/base.py`.
- **Criterio de aceptación:** correr `seed` sobre una base limpia deja 0 violaciones de
  `check_money_invariants` (o el seed documenta explícitamente las que necesita y el arnés las
  excluye por gym).

---

## Fichas — Configuración (`CFG`)

### CFG-01 · Unidades horas/días mezcladas
- **Severidad:** MEDIO · **Estado:** 🟢 (Fase C)
- **Explicación:** el backend guarda horas; `Settings.jsx` convierte a días, pero
  `AdminGymEdit.jsx`/`AdminGymWizard.jsx` editan el mismo campo como horas, sin validar
  fracciones.
- **Dónde:** `backend/gyms/serializers.py:52,58`, `frontend/src/pages/Settings.jsx:72,689`,
  `frontend/src/pages/admin/AdminGymEdit.jsx:271`.
- **Resolución Fase C:** las dos UIs editan y muestran **horas** (sin conversión a días),
  `step=1`/`min=0` y validación de entero ≥ 0 en `Settings.jsx`. Backend: campos
  `IntegerField(min_value=0)` con mensajes en español en `gyms/serializers.py`. Se verificó que
  DRF ya rechazaba fracciones/negativos por el `PositiveIntegerField` del modelo: el test de
  gyms es guarda, no repro.

### CFG-04 · El staff crea cambios de horario sin límites
- **Severidad:** MEDIO · **Estado:** 🟢 (Fase K4) · **Sub-fase:** K4 (≡ `ACC-13`, duplicado)
- **Explicación:** el serializer **staff** de cambio permanente no usa
  `count_schedule_changes_used_this_month` ni cooldown, a diferencia de los caminos público y
  de swap. Hoy la UI de staff sólo hace GET/approve/reject, pero el endpoint
  `POST /api/attendance/schedule-change-requests/` sigue expuesto por el `ModelViewSet` a
  cualquier usuario autenticado del gym (`DEFAULT_PERMISSION_CLASSES = IsAuthenticated`): el bug
  es reproducible por API.
- **Dónde:** `backend/attendance/serializers.py` — staff `:491-563` (sin límite) vs. público
  `:705-724` (con cooldown y límite) y swap staff `:994-1000`. Los límites existen en el modelo
  (`backend/gyms/models.py:102-103`).
- **Criterio de aceptación:** el cambio creado por staff respeta el límite mensual configurado
  (y el cooldown), igual que el del socio.
- **Resolución Fase K4:** el cooldown y el máximo mensual se calculan en un helper compartido
  (`backend/attendance/utils.check_schedule_change_limits`) que usan los tres caminos (público,
  staff y swap). El staff recibe 400 con un mensaje explícito. Tests en
  `backend/attendance/tests_phase_k4.py` (`Cfg04StaffChangeLimitsTests`).

### CFG-09 · Precio 0 permitido
- **Severidad:** ALTO · **Estado:** 🟢 (Fase C)
- **Explicación:** ni planes ni add-ons validan `price > 0`; `session_price` acepta 0.
- **Ejemplo de impacto:** un plan o actividad mal cargado a $0 factura $0 (el gimnasio no
  cobra y no se entera).
- **Dónde:** `backend/plans/serializers.py:14`, `backend/activities/serializers.py:50,227`,
  `backend/outings/serializers.py:62,273`, `backend/personal_training/serializers.py:35`.
- **Criterio de aceptación:** cargar precio 0 en un plan/add-on de pago da un 400 claro, salvo
  el plan base.
- **Resolución Fase C:** `price > 0` en planes (excepto `is_base`) y en el wizard
  (`admins/serializers.py`); `monthly_price > 0` sólo cuando `billing_mode == "monthly"`
  (`BillingPriceMixin`). `session_price = 0` se mantiene permitido (obra social / sin cargo) y
  se documenta como decisión de negocio. Sin `CheckConstraint` ni migraciones (decisión Fase C).

### CFG-12 · Visitas semanales sin validar
- **Severidad:** ALTO · **Estado:** 🟢 (Fase C)
- **Explicación:** capacidad y visitas se validan en edición de socio, check-in y cambio de
  plan, pero **no** en el alta (`members/services.py:199-207`) ni al ejecutar un cambio de plan
  aprobado (`subscriptions/views.py:420-438`).
- **Ejemplo de impacto:** un socio nuevo queda con más horarios que los de su plan.
- **Criterio de aceptación:** el alta y la ejecución del cambio respetan `weekly_visits`.
- **Resolución Fase C:** `ScheduleDomain.enforce_weekly_visits(member, target_count, limit)`
  centraliza la regla; se aplica en el alta (`members/services.py`) y en la aprobación del
  cambio de plan **antes** de tocar la base (`subscriptions/views.py`), devolviendo 400 sin
  crear suscripción ni reescribir horarios. Tests: `members/tests.py`,
  `subscriptions/test_weekly_visits.py`.

### CFG-14 · Doble cobro de add-on en modo sesiones
- **Severidad:** CRÍTICO · **Estado:** 🟢 (Fase C)
- **Explicación:** PT fuerza `monthly_price = 0` cuando `billing_mode == "sessions"`, pero
  `Activity` y `Outing` **no** lo hacen. `audit_money_bugs` ya los clasifica como "armados".
- **Ejemplo de impacto:** una actividad en modo "por sesiones" le cobra al socio la cuota
  mensual **y** el paquete de sesiones.
- **Dónde:** `backend/activities/serializers.py:36-60`, `backend/outings/serializers.py:52-70`
  (comparar con `backend/personal_training/serializers.py:76,92`).
- **Criterio de aceptación:** modo sesiones fuerza precio mensual 0 en actividades y salidas,
  con tests espejo de los de PT.
- **Resolución Fase C:** `BillingPriceMixin.apply_billing_price_rules` en `core/mixins.py`
  (usado por Activity, Outing y PT) fuerza `monthly_price = 0` en modo sesiones también al
  editar, y exige `> 0` en modo mensual. `audit_money_bugs` gana la verificación F7/P6
  (`_addon_session_offers`). Tests espejo en `activities/tests.py` y `outings/tests.py`.

### CFG-15 · Cargar feriados sin `year` devuelve 400
- **Severidad:** MEDIO · **Estado:** 🟢 (Fase C)
- **Detectado por:** gate de Fase C (test `gyms.tests.GymClosedDateHolidaysTests.test_default_year_is_current`,
  rojo en `development`).
- **Explicación:** `GymClosedDateHolidaysView.post` hacía `int(request.data.get("year"))`; sin
  `year` en el body, `int(None)` levanta `TypeError` → 400, cuando el comportamiento esperado
  (y el que testea la suite) es usar el año actual.
- **Resolución Fase C:** si `year` falta o viene vacío, se usa `timezone.localdate().year`;
  un valor no numérico sigue dando 400.
- **Dónde:** `backend/gyms/views.py:248-256`.

---

## Fichas — Add-ons (`ADD`)

### ADD-01 / ADD-09 · Desactivar una actividad/salida no corta el cobro
- **Severidad:** CRÍTICO · **Estado:** 🟢 (Fase D)
- **Explicación:** desactivar sólo apaga los horarios; las inscripciones y sus líneas de
  facturación siguen activas hasta desinscribir socio por socio.
- **Ejemplo de impacto:** el staff desactiva "Yoga" porque ya no se dicta; los 30 inscriptos
  siguen pagándola todos los meses.
- **Dónde:** `backend/activities/models.py:79-92`, `backend/activities/enrollment_service.py:251,302`;
  `backend/outings/models.py:135-150`, `backend/outings/enrollment_service.py:146,286`.
- **Criterio de aceptación:** desactivar la oferta alinea o corta la facturación de sus
  inscriptos (decisión de negocio sobre cómo: cortar o migrar a fin de mes).
- **Resolución Fase D (decisión "cortar ya"):** la transición activo→inactivo en
  `Activity.save()`/`Outing.save()` llama a `cut_activity_billing`/`cut_outing_billing`, que dan
  de baja las inscripciones activas y cancelan los `SubscriptionItem` de la oferta en las
  suscripciones **no vencidas** (período en curso y futuros ya generados), resincronizando el
  saldo (`cancel_addon_items` en `subscriptions/services.py`). Equivale a desinscribir socio por
  socio; si el período ya estaba pago queda saldo a favor. **Consecuencia documentada:** al dar
  de baja las inscripciones, el sellado/paquete pendiente de esos socios también desaparece
  (`gym_sellado_debt`/`member_activity_package_debt` filtran `active=True`); se prioriza no
  cobrar de más al socio. Cubierto por `activities/tests_deactivation.py` y
  `outings/tests_deactivation.py`.

### ADD-02 / ADD-10 · Inscripciones huérfanas en el portal
- **Severidad:** MEDIO · **Estado:** 🟢 (Fase D)
- **Explicación:** el portal listaba por `member + active` sin filtrar que el horario/actividad
  siguieran activos.
- **Dónde:** `backend/activities/public_views.py:29-33`, `backend/outings/public_views.py:35-40`.
- **Resolución Fase D:** los listados públicos agregan `schedule__active=True` y
  `schedule__activity__active=True` (actividades) / `schedule__outing__active=True` (salidas).
  Cubierto por `ActivityPortalOrphanTests` y `OutingPortalOrphanTests`.

### ADD-03 · Cambiar de horario puede dejar sin ninguno
- **Severidad:** ALTO · **Estado:** 🔴 · **Sub-fase:** K7
- **Explicación:** el cambio hace `unenroll` y luego `enroll` sin rollback.
- **Dónde:** `frontend/src/pages/MemberActivities.jsx:98-113`.
- **Nota (K0):** hoy es **inalcanzable**: la Fase D vació la rama de "huérfanos" (el portal ya
  no lista actividades/horarios desactivados), así que el flujo no llega a ejecutarse. Se
  arregla junto con `ACC-26` (el front de portal), que es la misma pantalla.

### ADD-05 · Choque asume bloques de 1 hora
- **Severidad:** MEDIO · **Estado:** 🟢 (Fase K3)
- **Explicación:** `ScheduleSlot` sólo tiene `day` + `hour` (`backend/attendance/models.py:19-43`,
  sin `duration_minutes`), así que el solape con el gimnasio asume 1 hora.
- **Dónde:** `backend/activities/overlap.py:29-30, 115-117, 143-145`;
  `backend/personal_training/overlap.py:44-45, 107`; `backend/attendance/recovery_service.py:120,137,154`;
  `backend/attendance/public_views.py:107`. El lado actividad/PT sí usa `start_time`/`end_time`
  reales.
- **Criterio de aceptación:** `ScheduleSlot` gana `duration_minutes` (con default = 60 para no
  romper las filas existentes) y los 4 call sites usan la duración real; o, si el negocio
  confirma que todos los bloques son de 1 h, se documenta la convención y se centraliza en un
  helper.
- **Resolución Fase K3:** se tomó la primera opción: `ScheduleSlot.duration_minutes` (default
  60, migración `attendance/0026`) y la aritmética de horarios queda en un solo lugar
  (`backend/core/times.py`: `add_minutes`/`slot_end`, más `ScheduleSlot.end_time`). Los cuatro
  call sites usan la duración real: inscripción en actividad (`core/overlap.py:86`), alta de socio
  con agenda (`activities/overlap.py:93`), ventana del recupero
  (`attendance/recovery_service.py:118,135` + `attendance/public_views.py:110`) y validación de
  onboarding (`activities/overlap.py:93`). La API acepta `duration_minutes` (entre 15 y 480
  minutos) en el alta simple y en la alta por lote, y `Settings.jsx` la muestra y la permite
  editar. **El lado PT ya usaba `start_time`/`end_time` reales** (`personal_training/overlap.py`),
  por eso no aparece entre los call sites corregidos.
- **Tests:** 3 en `backend/activities/tests_phase_k3.py` (choque con bloque de 90 min, no falso
  positivo con 60 min, validación de onboarding) + 5 en `backend/attendance/tests_phase_k3.py`
  (API: alta por lote con duración, default, rango inválido, serializer). 5 en rojo sin el fix.

### ADD-06 · El portal rompe con una actividad desactivada
- **Severidad:** ALTO · **Estado:** 🟢 (Fase K1) · **Detectado por:** re-verificado en K0 (la
  re-verificación de Fase E había sido incorrecta).
- **Explicación:** en `frontend/src/pages/MemberActivities.jsx:338` se llama a
  `txt(gym, "portal.suspended_activity")`, pero **`txt` no estaba importado** y **`gym` no
  estaba en scope**. Es un `ReferenceError` en render: tumba todo el portal de actividades (lo
  agarra el `ErrorBoundary` raíz), no sólo una tarjeta.
- **Por qué se creyó cerrado:** la Fase D filtró los huérfanos en el backend
  (`activities/public_views.py:30-39`), con lo que la rama quedó muerta y el bug invisible.
  El commit `5a87ad3` (Fase E) afirmó la re-verificación pero **no tocó `MemberActivities.jsx`**.
- **Resolución Fase K1:** `gym` sale del **outlet context** del portal
  (`const { token, gym, isOperativeBlocked } = useOutletContext()`), igual que
  `MemberPersonalTraining.jsx` — **no** de `useGym()`, que es el hook del gym del *staff*
  (`/api/gyms/me/`). Se importa `txt` de `../utils/labels` y se borra el import muerto de
  `unenrollMemberFromActivity` (que el lint marcaba).
- **Dónde:** `frontend/src/pages/MemberActivities.jsx:22` (destructure) y `:9` (import).
- **Criterio de aceptación:** ✅ la rama renderiza sin `ReferenceError`.

### ADD-07 · El no-show descuenta en fechas sin clase
- **Severidad:** CRÍTICO · **Estado:** 🟢
- **Explicación:** toda fecha válida sin registro se marca falta; sólo se saltean
  `GymClosedDate`, no clases canceladas ni feriados no cargados.
- **Ejemplo de impacto:** feriado que nadie cargó → el socio pierde una sesión paga sin haber
  tenido clase.
- **Dónde:** `backend/activities/no_show_service.py`.
- **Resolución Fase G:** el job arranca su barrido en `max(watermark, created_at del horario
  + 1 día)`, de modo que nunca descuenta fechas previas a que la clase existiera; los días
  cargados en `GymClosedDate` se saltean tanto en actividades como en PT. No se agregó un
  modelo nuevo de cancelación de clase (decisión de negocio): una clase cancelada se modela
  cargando el feriado/fecha cerrada.
- **Criterio de aceptación:** ✅ no se descuenta sesión en fechas sin clase dictada.
- **Tests:** `activities/tests_phase_g.py` (`test_activity_does_not_deduct_before_schedule_created`,
  `test_activity_watermark_never_deducts_before_schedule_created`,
  `test_activity_skips_closed_day`, `test_pt_does_not_deduct_before_assignment_created`).

### ADD-11 · Faltar a una salida no descuenta
- **Severidad:** ALTO · **Estado:** ⚪ decisión de negocio (Fase G)
- **Explicación:** el job de no-show no recorre salidas.
- **Dónde:** `backend/activities/no_show_service.py`, `backend/subscriptions/services.py`.
- **Resolución Fase G:** se mantiene intencional. Las salidas no tienen no-show ni
  recuperación: faltar no descuenta sesión. El gimnasio cobra la salida usada o no; no se
  implementa un job de faltas para salidas.

### ADD-12 · El conteo de salidas depende de la ventana
- **Severidad:** MEDIO · **Estado:** 🟢 (cerrado por ACC-08, Fase G) · **Dónde:**
  `backend/attendance/public_views.py:80-102`.
- **Resolución:** el descuento se centralizó en `backend/attendance/checkin_discount.py` con la
  regla de ACC-08 (descontar siempre que la asistencia sea inequívoca), que cubre también el
  conteo de salidas. La ficha quedó abierta por leftovers de la auditoría.

### ADD-16 · Las salidas no validan choque
- **Severidad:** ALTO · **Estado:** 🟢 (Fase K2) · **Explicación:** `enroll_member` no
  validaba solape con gimnasio, actividades ni PT (compárese con
  `backend/activities/enrollment_service.py:85-88`, que sí validaba).
- **Ejemplo de impacto:** el socio queda en running y en una actividad a la misma hora.
- **Resolución Fase K2:** el problema de fondo era que cada app llevaba su propia copia de la
  comprobación y las copias se desfasaron (actividades la tenía, PT la tenía, salidas no).
  - `backend/core/overlap.py` es ahora la fuente única: revisa las cuatro fuentes (horario
    fijo del gimnasio, actividades, salidas y PT) y devuelve un código de conflicto; cada
    app traduce el código a su texto (los de horario fijo salen de `gyms/labels.py`).
  - Salidas: `enroll_member` valida antes de inscribir, y también la solicitud de inscripción
    del portal (para que el error le llegue al socio y no al staff que aprueba).
  - Actividades y PT: se les agrega la dimensión "salidas" que les faltaba. Si sólo se
    validara del lado de las salidas, el socio que primero se anota en una salida y después
    en una actividad quedaría con las dos cosas a la misma hora: **el orden de las
    anotaciones no puede cambiar la regla**.
  - Se mantienen el filtro por gimnasio y los mensajes de cada app: no cambia el
    comportamiento que ya tenían actividades y PT.
- **Dónde:** `backend/core/overlap.py` (nuevo), `backend/outings/overlap.py` (nuevo),
  `backend/activities/overlap.py`, `backend/personal_training/overlap.py`,
  `backend/outings/enrollment_service.py:80-84`,
  `backend/outings/enrollment_request_service.py:49-64`.
- **Tests:** `backend/outings/tests_phase_k2.py` (8 de solape), `backend/activities/
  tests_phase_k2.py` (2) y `backend/personal_training/tests_phase_k2.py` (3).

### ADD-18 · Botón "Renovar" duplicado
- **Severidad:** BAJO · **Estado:** 🟢 (Fase K1) · **Dónde:** `frontend/src/pages/PersonalTrainingSettings.jsx:710-727` (dos render de "Renovar" en la misma celda: `:710-718` y `:719-727`).
- **Resolución Fase K1:** queda **un solo** botón "Renovar", con la condición más amplia
  (`isPackage`). El duplicado con `!assignment.is_comp` había reemplazado al botón "Cobrar" en
  `df382ae` (unificación de pagos) y el otro quedó de la creación del archivo. Se conserva la
  condición amplia porque el backend **sí** renueva los paquetes de cortesía a precio 0
  (`SessionService.renew_package` pone `session_price=0` para `is_comp`): excluir al socio de
  cortesía le quitaba una capacidad que el backend soporta.

### ADD-21 · En PT las faltas agotan el paquete
- **Severidad:** ALTO · **Estado:** 🟢
- **Explicación:** el no-show de PT no tiene créditos de recuperación (las actividades sí).
- **Ejemplo de impacto:** el socio paga 8 sesiones, falta 3 y le quedan 5 sin reposición.
- **Dónde:** `backend/activities/no_show_service.py`, `backend/attendance/recovery_service.py`.
- **Resolución Fase G:** se agregó `kind="pt"` a `SessionRecovery` con FK a la asignación
  (`attendance/migrations/0025_...`). Al otorgar el recupero se anula la falta `no_show` más
  reciente (mismo invariante "falta + recuperación cuesta 1 sesión" que actividades) y al
  usarlo se crea el `PersonalTrainingSessionRecord` con `source="recovery"`. La ventana de la
  recuperación es el horario propio de la asignación.
- **Criterio de aceptación:** ✅ una falta de PT puede reponerse sin cobrar dos veces.
- **Tests:** `activities/tests_phase_g.py` (7 tests, incl. end-to-end `grant`→`use`→`undo`).

### ADD-23 · Desvincular PT no toca períodos ya generados
- **Severidad:** MEDIO · **Estado:** ⚪ decisión de negocio (K0) · **Dónde:** `backend/personal_training/assignment_service.py:342-367`.
- **Explicación:** `_cancel_pt_items` sólo cancela ítems con `subscription__end_date__gte=today`;
  las suscripciones históricas/vencidas quedan intactas a propósito.
- **Decisión:** se mantiene la inmutabilidad de los períodos ya generados. El socio no ve la
  baja pasada, pero el historial de lo que pagó no se reescribe.

### ADD-26 · PT: reasignar a otro día no se detecta
- **Severidad:** MEDIO · **Estado:** 🟢 (no se reproduce, K0).
- **Explicación:** la asignación de PT es **recurrente semanal** (`day` = día de la semana,
  `backend/personal_training/models.py:164-166`): "mover de día" no puede duplicar una clase
  existente, sólo cambia el día de la serie. En runtime, mover la asignación al día en que el
  entrenador ya tenía clase es **rechazado** por el validador de solape
  (`backend/personal_training/overlap.py:87-100`).
- **Nota (fuera de alcance):** la disponibilidad real del entrenador
  (`backend/personal_training/availability.py`) sólo alimenta la UI; `assign_member` no la
  valida. Endurecerlo queda como mejora menor, no como bug.

### ADD-27 · Una recuperación de sesión perdona dos faltas
- **Severidad:** MEDIO · **Estado:** 🟢 (Fase K3) · **Origen:** P8 de la Fase 8 de
  `PLAN-dinero.md` (nunca triado en este registro).
- **Explicación:** hay dos mecanismos que no se conocen y ambos usan la clave
  `(member, activity)`:
  1. **Al otorgar** la recuperación, `cancel_recovered_no_show` borra la falta `no_show` más
     reciente **sin mirar enrollment ni fecha**
     (`backend/activities/no_show_service.py:286-307`, disparado desde
     `backend/attendance/recovery_service.py:579`).
  2. **En el cron siguiente**, `_pending_recovery_credits` cuenta los créditos `scheduled` de
     `(member, activity)` sin filtrar por enrollment ni por la fecha ya perdonada
     (`backend/activities/no_show_service.py:52-58`) y `_deduct_activity_enrollment` recorta
     `missed[:-credits]` (`backend/activities/no_show_service.py:107-111`).
- **Ejemplo de impacto:** el socio falta la semana pasada → el cron registra la falta → el staff
  otorga 1 recuperación (la borra) → falta otra vez → el cron la borra también. **Dos faltas
  perdonadas con una sola recuperación.** Con dos inscripciones a la misma actividad (lunes y
  miércoles) se perdona **una falta por inscripción**.
- **Dónde:** `backend/activities/no_show_service.py:42-58, 107-111, 286-307`;
  `backend/attendance/recovery_service.py:579`.
- **Criterio de aceptación:** cada recuperación cubre **exactamente una** falta concreta
  (enrollment + fecha) y el crédito deja de estar disponible una vez usado. PT ya está a salvo
  (filtra por `assignment`): el fix es el espejo en actividades.
- **Tests:** hoy los dos mecanismos se prueban por separado
  (`backend/activities/tests_phase_g.py:203,247` y `backend/attendance/tests.py:160`), nunca en
  combinación. Falta el test `grant → cron`.
- **Resolución Fase K3:** `SessionRecovery` gana `forgiven_date`, `forgiven_enrollment` y
  `forgiven_assignment` (migración `attendance/0026`). Al otorgar la recuperación
  (`attendance/recovery_service.py:grant_scheduled`) se anota a qué falta concreta perdona, y los
  créditos ya enlazados **dejan de contar** para cubrir faltas nuevas
  (`activities/no_show_service.py:_pending_recovery_credits` filtra
  `forgiven_date__isnull=True`). Si al otorgarla todavía no hay ninguna falta registrada, el
  crédito queda "en vuelo" y el cron lo enlaza a una falta pendiente (la más reciente:
  `_bind_pending_recoveries`). Espejo en PT (`_bind_pending_pt_recoveries`), que antes filtraba
  por asignación pero no por fecha.
- **Consecuencia documentada:** los créditos ya existentes **no** se pueden backfillear (no hay
  forma de saber qué falta perdonaron), así que siguen en vuelo y se comportan como antes hasta
  que se usen.
- **Tests:** 3 en `backend/activities/tests_phase_k3.py` (grant → cron no perdona dos faltas, la
  recuperación queda atada, la falta perdonada no se vuelve a descontar) + 2 en
  `backend/personal_training/tests_phase_k3.py` (espejo en PT). 5 en rojo sin el fix.

### ADD-28 · Darse de baja de un horario corta el cobro de toda la oferta
- **Severidad:** MEDIO · **Estado:** 🟢 (Fase K2) · **Origen:** P10 de la Fase 8 de
  `PLAN-dinero.md` (nunca triado en este registro).
- **Explicación:** el ítem de suscripción es **por oferta** (actividad/salida), no por horario.
  PT tiene el guard `other_active` (`backend/personal_training/assignment_service.py:353-360`):
  si el socio sigue inscripto en otra asignación, **no** cancela el ítem. Actividades y salidas
  **no lo tienen** (`backend/activities/enrollment_service.py:255, 306-324` y
  `backend/outings/enrollment_service.py:129-150, 290`): `_cancel_activity_items` /
  `_cancel_outing_items` cancelan el ítem activo de la oferta entera.
- **Ejemplo de impacto:** el socio está en el horario lunes **y** miércoles de la misma
  actividad. Se da de baja del lunes → se cancela el único ítem → **sigue inscripto el
  miércoles pero deja de pagar**; la pérdida se repite cada período.
- **Por qué es una regresión de la Fase D:** el commit `1fefa58` replicó la estructura de
  `_cancel_pt_items` para actividades y salidas **sin copiar el guard** (el guard nació en
  `0980ed3` para PT).
- **Criterio de aceptación:** antes de cancelar el ítem, se verifica que no queden otras
  inscripciones activas de la misma oferta (mismo criterio que PT), en el período en curso y en
  los futuros ya generados. ✅
- **Resolución Fase K2:** `_cancel_activity_items` y `_cancel_outing_items` ahora cancelan el
  ítem **sólo** cuando no queda ninguna inscripción activa de la misma oferta, con el mismo
  criterio que `_cancel_pt_items`. El guard es por oferta: otra actividad (u otra salida) no
  lo mantiene vivo, y una inscripción dada de baja antes tampoco cuenta. La baja masiva de
  una oferta desactivada (`cut_*_billing`) no cambia: ahí se dan de baja todas las
  inscripciones, así que el ítem va.
- **Tests:** `backend/activities/tests_phase_k2.py` y `backend/outings/tests_phase_k2.py`
  (11 tests, 2 en rojo con el fix).

### ADD-14 / ADD-22 · Renovar con saldo impago bloquea al staff
- **Severidad:** MEDIO · **Estado:** 🟢 (Fase K2) · **Sub-fase:** K2.
- **Explicación:** `renew_package` de salidas y de PT exige saldo a favor antes de renovar
  (`backend/outings/session_service.py:105-113`,
  `backend/personal_training/session_service.py:85-93`). Con saldo impago la respuesta es 400 y
  el staff **no puede renovar**: la regla "cobrar antes de renovar" (decisión DIN) convierte una
  operación de mantenimiento en un bloqueo.
- **Ejemplo de impacto:** el socio pagó un mes y debe el siguiente; el staff quiere renovarle
  el paquete de PT para no cortar el servicio, y el sistema no lo deja.
- **Decisión tomada (2026-10-21):** la regla de fondo **se mantiene** (no se renueva en deuda por
  defecto, porque el add-on unpaid se descuenta del saldo y enriquece al gimnasio sin cobrar);
  lo que se agrega es un **override explícito** del staff, con confirmación en el front.
- **Resolución Fase K2:** `renew_package(..., allow_unpaid=False)` en las tres apps
  (actividades tenía el mismo bug aunque la ficha no lo listara), `parse_bool` en
  `backend/config/api/params.py` para leer el flag, y confirmación con `window.confirm` en
  `OutingEnrollments.jsx`, `ScheduleEnrollments.jsx` y `PersonalTrainingSettings.jsx`.
- **Tests:** 5 en `backend/outings/tests_phase_k2.py` + 5 en
  `backend/personal_training/tests_phase_k2.py` (10, 5 en rojo con el fix).

### ADD-04 / ADD-15 · Reactivar la oferta revive los horarios apagados a mano
- **Severidad:** MEDIO (ADD-04) / BAJO (ADD-15) · **Estado:** 🟢 (Fase K2) · **Sub-fase:** K2.
- **Explicación:** "Restaurar horarios" (actividades) y "Reactivar" (salidas) hacían
  `update(active=True)` sobre **todos** los horarios de la oferta, incluidos los que el staff
  había apagado a propósito (`backend/activities/views.py:71-80`,
  `backend/outings/views.py:87-96`). El backend no tenía forma de saber por qué estaba apagado un
  horario, así que no podía distinguir "apagado porque se desactivó la oferta" de "apagado a
  mano". El front ya mandaba `restore_schedules` y el backend lo ignoraba.
- **Ejemplo de impacto:** el horario de verano se apaga en abril; en septiembre, al reactivar la
  actividad, vuelve y el socio se encuentra con un horario de verano que ya no aplica.
- **Resolución Fase K2:** nuevo flag `auto_deactivated` en `ActivitySchedule` y `OutingSchedule`:
  la cascada que apaga los horarios al desactivar la oferta los marca, y al reactivar vuelven
  **sólo** los marcados (los apagados a mano siguen apagados). `restore_schedules: false` deja la
  oferta activa sin tocar ningún horario. La respuesta trae `restored_schedules` y el front lo
  dice ("reactivada con 2 horarios"), en vez de prometer "con sus horarios" cuando no es cierto.
  Migraciones `activities/0016` y `outings/0004`, con backfill: los horarios apagados de una
  oferta que sigue desactivada se marcan como auto-desactivados (vuelven al reactivarla, como
  antes) y los de una oferta activa se dejan en False (son manuales).
- **Tests:** 5 en `backend/activities/tests_phase_k2.py` + 3 en `backend/outings/tests_phase_k2.py`
  (8, 1 en rojo con el fix).

### ADD-29 · El watermark avanza sobre faltas que nunca se cobraron
- **Severidad:** BAJO · **Estado:** 🟢 (Fase K3) · **Origen:** P15 de la Fase 8 de
  `PLAN-dinero.md` (nunca triado en este registro).
- **Explicación:** `deduct_missed_activity_enrollments` escribe `no_show_scan_until`
  **incondicionalmente**, aunque `_deduct_activity_enrollment` haya descartado faltas:
  si `remaining <= 0` (paquete agotado) hace early return sin cobrar nada
  (`backend/activities/no_show_service.py:104-105`), y si el tope trunca la lista
  (`:114`), las fechas no descontadas se pierden para siempre (`:215-216`).
- **Ejemplo de impacto:** paquete de 8 ya usado; el socio falta; el cron corre con
  `remaining = 0` y avanza el watermark; después el staff hace "Agregar sesiones"
  (`renew_package`) → esas faltas nunca se descuentan y el socio recibe sesiones que no pagó.
- **Dónde:** `backend/activities/no_show_service.py:104-105, 114, 215-216`; espejo en PT
  (`:153-154, 161, 255-256`).
- **Criterio de aceptación:** el watermark sólo avanza hasta la última fecha efectivamente
  descontada (o la ventana truncada queda marcada como no cobrable sin perderse).
- **Resolución Fase K3:** `_deduct_activity_enrollment` y `_deduct_pt_assignment` devuelven ahora
  `(created, last_charged, pending)`: la última falta **cobrada** y si quedaron faltas
  pendientes. El watermark (`no_show_scan_until`) sólo avanza hasta `last_charged` cuando hay
  pendientes (paquete agotado o lista truncada por el tope); si no hay pendientes, avanza hasta
  el fin del rango como antes. Con el paquete agotado no se avanza nada, así que el rango se
  vuelve a recorrer en la próxima vuelta del cron y las faltas no se pierden. Espejo en PT.
- **Tests:** 2 en `backend/activities/tests_phase_k3.py` (paquete agotado y lista truncada) + 2
  en `backend/personal_training/tests_phase_k3.py` (espejo en PT). 4 en rojo sin el fix.

### ADD-04, ADD-14, ADD-15, ADD-17, ADD-19, ADD-22, ADD-24, ADD-25 — verificados en K0, dos cerrados en K1, cuatro en K2
Los 8 hallazgos que las auditorías dejaron sin re-verificar. Veredicto del 2026-10-21
(lectura de código + runtime en BD descartable):

| ID | Veredicto | Detalle | Sub-fase |
|---|---|---|---|
| ADD-04 | 🟢 vivo (K2) | `backend/activities/views.py:71-80`: "Restaurar horarios" hacía `update(active=True)` sobre **todos** los horarios. **Cerrado en K2**: con el flag `auto_deactivated` vuelve sólo lo que se apagó con la oferta. | — |
| ADD-14 | 🟢 vivo (K2) | `backend/outings/session_service.py:105-113`: renovar con saldo impago → **400**. **Cerrado en K2**: la regla sigue, pero con override explícito (`allow_unpaid`). | — |
| ADD-15 | 🟢 vivo (K2) | `backend/outings/views.py:87-96`: "Reactivar" revivía todos los horarios. **Cerrado en K2**: mismo flag `auto_deactivated` que actividades. | — |
| ADD-17 | ⚪ decisión | `backend/outings/public_views.py:180` excluye `billing_mode="sessions"` del portal: la salida en modo sesiones requiere inscripción del staff. Comportamiento previsto (`AUDITORIA-SALIDAS.md:273-274`). | — |
| ADD-19 | 🔴 vivo | `frontend/src/services/personalTraining.service.js:57-63` define `updatePersonalTrainingAssignment` pero **nadie lo llama**: el backend sí soporta el cambio (`backend/personal_training/serializers.py:349-362`). | K7 |
| ADD-22 | 🟢 vivo (K2) | `backend/personal_training/session_service.py:85-93`: renovar PT con saldo impago → **400**. **Cerrado en K2**: mismo override explícito que ADD-14. | — |
| ADD-24 | 🟢 vivo (K1) | `frontend/src/utils/ptAvailability.js:65-72` (`reconcileSlot`) elegía el primer slot libre sin avisar. **Cerrado en K1**: `reconcileSlot` devuelve `changed` y los 4 llamados (wizard, cambio de día y portal) avisan con un toast. | — |
| ADD-25 | 🟢 vivo (K1) | `backend/personal_training/models.py:344` declaraba el estado `approved`, pero el flujo escribe `executed` (`backend/personal_training/change_request_service.py:132`). **Cerrado en K1**: estado fuera de `STATUS_CHOICES` + migración `personal_training/0003`. | — |

---

## Fichas — Acceso / portal (`ACC`)

### ACC-25 · Login con contraseña incorrecta → 500 (Axes sin `request`)
- **Severidad:** ALTO · **Estado:** 🟢 (Fase E) · **Resolución:** `LoginSerializer` ahora
  recibe `context={"request": request}` y `authenticate(request=..., ...)`; responde **400** y
  Axes registra el `AccessAttempt` (el bloqueo por fuerza bruta queda operativo).
- **Explicación (histórico):** `LoginSerializer.validate` llamaba a
  `django.contrib.auth.authenticate(username=..., password=...)` **sin `request`**, y
  `LoginView` no le pasaba `context`. Con la contraseña correcta `ModelBackend` (primero en
  `AUTHENTICATION_BACKENDS`) resolvía antes; con la incorrecta se llegaba a
  `AxesStandaloneBackend`, que exige `request` y lanzaba
  `AxesBackendRequestParameterRequired` → **500**.
- **Detectado por:** `accounts.tests.LoginTests.test_login_wrong_password_rejected` (rojo
  preexistente; `accounts` no corría en CI — ver REF-02/Fase J).

### ACC-01 · El cupo se cuenta a sí mismo
- **Severidad:** CRÍTICO · **Estado:** 🟢 (Fase E) · **Resolución:** el cupo excluye al propio
  socio: `compute_effective_occupancy(..., exclude_member=...)` en
  `backend/attendance/utils.py` (check-in y alta de staff).
- **Explicación (histórico):** la ocupación base incluía los horarios activos del propio socio;
  sólo el swap lo excluía. Un horario con capacidad 10 y 10 inscriptos le decía "El horario
  está completo" a esos mismos 10 socios.

### ACC-05 · Doble registro del staff → 500
- **Severidad:** ALTO · **Estado:** 🟢 (Fase E) · **Resolución:** pre-check + traducción del
  `IntegrityError` del constraint a **400** en `AttendanceSerializer.create`.
- **Dónde:** `backend/attendance/serializers.py`, `backend/attendance/models.py:154`.

### ACC-06 / ACC-13(dup) · Throttle 30/h por IP
- **Severidad:** ALTO · **Estado:** 🟢 (Fase E) · **Resolución:** se quitó el throttle por IP;
  queda sólo el de token del portal.
- **Explicación (histórico):** `AnonRateThrottle` de 30/hora hacía que en un gimnasio con un
  sólo WiFi el socio nº 31 en una hora recibiera 429 y no pudiera registrar su asistencia.
- **Dónde:** `backend/config/api/throttles.py`, `backend/attendance/public_views.py:107`.

### ACC-08 · La sesión no se descuenta fuera de la ventana
- **Severidad:** ALTO · **Estado:** 🟢
- **Explicación:** el descuento dependía de entrar dentro de la ventana horaria.
- **Dónde:** `backend/attendance/public_views.py`, `backend/attendance/serializers.py`.
- **Resolución Fase G:** el descuento se centralizó en `attendance/checkin_discount.py` con la
  regla "descontar siempre que la asistencia sea inequívoca": con **una** inscripción de
  paquete activa ese día se descuenta sin mirar la hora; con **varias**, sólo las que caen en
  la ventana; ninguna en ventana → no se descuenta (evita cobrar la clase equivocada). El
  check-in de staff (`now_dt=None`) sólo aplica el caso inequívoco de una inscripción.
- **Criterio de aceptación:** ✅ entra/entrena fuera de la ventana → el paquete baja.
- **Tests:** `activities/tests_phase_g.py.Acc08DiscountOutsideWindowTests` (5 tests).
- **Equivale a:** P11 de la Fase 8 de `PLAN-dinero.md` (la asistencia de staff no consumía la
  sesión del paquete de salida) — cerrado por este mismo fix.

### ACC-10 · Aprobar desactiva el horario viejo de inmediato
- **Severidad:** ALTO · **Estado:** 🟢 (Fase K4) · **Sub-fase:** K4
- **Ejemplo:** la UI promete vigencia futura pero el horario actual se apaga al aprobar; el
  socio pierde las clases de la semana en curso.
- **Dónde:** `backend/attendance/views.py:919-930` (desactiva `current_schedule` y activa el
  slot pedido, sin compuerta de fecha). `ScheduleChangeRequest` **no tiene** `effective_date`
  persistido: la fecha es un valor calculado del serializer
  (`backend/attendance/serializers.py:565-572`).
- **Decisión (2026-10-21):** **no** se implementa la vigencia futura (hubo que elegir entre
  migrar + job diferido, ~2 días, o corregir la promesa). Se **corrige la UI**: `frontend/src/pages/ScheduleChangeRequests.jsx:337-341`
  deja de decir "Vigente: {fecha}" y pasa a decir que el cambio aplica al aprobarlo.
- **Criterio de aceptación:** la UI no promete una vigencia que el backend no implementa.
- **Resolución Fase K4:** el panel de cambios permanentes ya no dice "Vigente: {fecha}" (que se
  leía como vigencia futura) sino "Próxima clase del horario pedido" y aclara que el cambio se
  aplica de inmediato al aprobarlo (`frontend/src/pages/ScheduleChangeRequests.jsx`).

### ACC-11 · El cooldown cuenta las rechazadas
- **Severidad:** ALTO · **Estado:** 🟢 (Fase E) · **Resolución:** el cooldown ignora las
  solicitudes rechazadas (`backend/attendance/serializers.py`, rama de cooldown).

### ACC-12 · Doble pedido → 500
- **Severidad:** ALTO · **Estado:** 🟢 · **Resolución Fase E:** el serializer de cambio de
  horario (staff y público) traduce el `IntegrityError` de `unique_pending_change_request` a
  409; `_handle_action` dejó de usar `except Exception` y sólo captura `ScheduleError`/
  `IntegrityError`.
- **Dónde:** `backend/attendance/serializers.py` (`ScheduleChangeConflict`),
  `backend/attendance/views.py:_handle_action`.

### ACC-17 · El alta pública descarta el descuento
- **Severidad:** ALTO · **Estado:** 🟢 · **Resolución Fase E (decisión de negocio).**
- **Explicación:** `is_comp` y `discount_id` son privilegios de staff, pero el alta pública es
  anónima y no puede validar quién elige el descuento: honrar un `discount_id` del payload deja
  a cualquiera auto-asignarse, por ejemplo, un 50% off de por vida (el gimnasio pierde plata).
  Se mantiene el descarte y se agrega un `logger.warning` con el gimnasio para que el staff lo
  asigne desde el panel. El socio nunca ve un descuento aplicado que no corresponda.
- **Dónde:** `backend/members/public_views.py`.

### ACC-18 · Rotación de token
- **Severidad:** ALTO · **Estado:** 🟢 · **Resolución Fase E:** `portal_member_or_404`
  (`resolve_public_portal_member`) es la fuente única y acepta el token vigente o el de la
  generación anterior; adjuntos, foto y check-in también lo usan. Gracia de 1 generación: un
  token de dos rotaciones atrás queda invalidado (por diseño/TTL de 30 días).
- **Dónde:** `backend/members/models.py`, endpoints de portal en `attendance`, `activities`,
  `outings`, `subscriptions`, `personal_training`, `community`, `gyms`, `routines`, `members`.

### ACC-23 · Obra social sin match
- **Severidad:** ALTO · **Estado:** 🟢 (Fase K5) · **Sub-fase:** K5 · **Explicación:** `_autolink_insurance`
  normaliza (minúsculas/acentos) pero si no matchea queda `None` → sin precio de coseguro.
- **Dónde:** `backend/members/serializers.py:423-450` (`_autolink_insurance` + `validate`).
- **Ejemplo de impacto:** el campo es texto libre también en el alta pública
  (`frontend/src/pages/Register.jsx:435-436`): un nombre mal escrito deja el coseguro en 0 y el
  gimnasio no cobra. Medido en staging el 2026-10-21: 187 socios, **0** con el hueco abierto
  (nadie lo explotó todavía).
- **Criterio de aceptación:** el coseguro no puede quedar en 0 por un nombre mal escrito (400
  con la lista de obras sociales, o enlace explícito) + backfill de las filas existentes.
- **Resolución Fase K5 (decisión 2026-10-21: no bloquear el alta):** el socio se da de alta
  igual, pero queda marcado. `Member.insurance_unverified` (serializer) expone el texto cargado
  sin FK; el panel muestra un badge, un filtro "obra social sin verificar" y un botón que abre
  el combo de obras ya desplegado (`MemberForm` con `focusInsurance`), así se enlaza con un
  clic. El alta pública ofrece la lista de obras del gym (`GET
  /api/public/health-insurances/<code>/`) con una opción "Otra obra social..." para el texto
  libre. Al crear o renombrar una obra social, un signal re-enlaza los socios por nombre
  actual o anterior (`members/insurance.py`, `members/signals.py`) y el comando
  `relink_insurances --gym <id>|--all` permite forzarlo. `_autolink_insurance` deja un WARNING
  con el nombre y el gym cuando no matchea. Backfill medido: 0 socios con texto sin FK en
  staging, así que no hizo falta migrar datos.
- **Tests:** `backend/members/tests_phase_k5.py` (21 tests: normalización, auto-link,
  re-enlace al renombrar, badge, filtro, endpoint público, comando, alta con obra conocida y
  desconocida).

### ACC-26 · El portal no puede darse de baja de una inscripción de actividad
- **Severidad:** ALTO · **Estado:** 🟢 (Fase K1) · **Detectado por:** K0 (revisión del
  front contra las rutas del backend; no estaba en ninguna auditoría).
- **Explicación:** el botón "Cancelar inscripción" del portal del socio
  (`frontend/src/pages/MemberActivities.jsx:231,357-359`) llama a
  `unenrollMemberFromActivity` (`frontend/src/services/activitiesPublic.service.js:7-12`), que
  hace **POST** a `/api/activities/public/<token>/`. Esa ruta apunta a
  `PublicMemberEnrollmentsView.post` (`backend/activities/public_views.py:44-85`), que es el
  endpoint de **alta** (`EnrollmentService.enroll_member`): la baja nunca existió en el API
  público. Con el socio ya inscripto, la respuesta es **409 "El miembro ya está inscripto en
  este horario"** y la inscripción sigue activa.
- **Ejemplo de impacto:** el socio **no puede darse de baja de una actividad** desde el portal.
- **Regresión:** `664737a` (2026-09-02) cambió el POST de *baja* a *alta* sin actualizar el
  front (último toque: `6edbeec`, 2026-07-03). Salidas y PT sí tienen su `DELETE` público
  (`outings/public_views.py:134`, `personal_training/public_views.py:157`).
- **Resolución Fase K1:** `DELETE /api/activities/public/<token>/` con `schedule_id` en el body
  (`PublicMemberEnrollmentsView.delete`, `backend/activities/public_views.py:88-138`). Valida
  que el horario sea del gym, usa `EnrollmentService.unenroll_member` (cancela el ítem de la
  actividad en la suscripción y resincroniza el saldo) y devuelve la inscripción dada de baja.
  A diferencia del alta **no exige `can_operate`** (darse de baja nunca está penalizado;
  decisión 2026-10-21) y **no** exige que el horario esté activo (si el gym desactivó la
  actividad, el socio igual tiene que poder salir). 403 para `billing_mode="sessions"`
  (mismo criterio que el alta: las maneja el staff). El front pasó a `DELETE`
  (`frontend/src/services/activitiesPublic.service.js:7-12`).
- **Tests:** `backend/activities/tests_phase_k.py` (10 tests: baja, lista del portal, ítem de
  la suscripción, 400 sin `schedule_id`, 404 de otro gym, 404 sin inscripción, 404 de token
  inexistente, 403 de sesiones, baja con el socio bloqueado, baja con el horario desactivado).
- **Criterio de aceptación:** ✅ el botón del portal da de baja la inscripción y refresca la
  lista.

### ACC-02, ACC-03, ACC-04, ACC-14, ACC-16 — verificados en K0, cerrados en K4
Detalle en `AUDITORIA-ASISTENCIAS.md §7` y `AUDITORIA-HORARIOS.md §7`. Veredicto del 2026-10-21
(K0) y resolución de la Fase K4:

| ID | Veredicto | Detalle | Sub-fase |
|---|---|---|---|
| ACC-02 | 🟢 cerrado (K4) | `Gym.checkin_window_minutes` (0 = sin ventana) + comparación de la hora en los dos paths (público y staff) + el campo en la UI de configuración. La ventana va de (inicio − N) hasta el fin real del bloque. | K4 |
| ACC-03 | 🟢 cerrado (K4) | El serializer de staff valida `GymClosedDate` y responde 400 si el día está cerrado. | K4 |
| ACC-04 | 🟢 cerrado (K4) | El check-in duplicado (normal o intercambio) responde 409 y el front distingue el éxito real (`data.success`). | K4 |
| ACC-14 | 🟢 cerrado (K4) | Al aprobar se re-verifica que el horario viejo siga activo (si el staff editó la ficha, 400: el socio tiene que volver a pedirlo) y se valida el límite de visitas del plan antes de tocar la ficha. | K4 |
| ACC-16 | 🟢 cerrado (K4) | Los pedidos pendientes se cancelan sólo al **aprobar** el cambio de plan (al rechazar ya no se tocan) y la nota `admin_notes` —lo único que ve el socio en el portal— está en español. | K4 |

### ACC-19 · Teléfono único por gimnasio
- **Severidad:** MEDIO · **Estado:** 🟢 (Fase K5) · **Sub-fase:** K5 · **Explicación:** la unicidad del
  teléfono es **sólo de serializer** (`backend/members/serializers.py:373-403` y `:667-683`),
  por `(phone, gym)`. No hay constraint en el modelo (`backend/members/models.py:111-115`).
- **Ejemplo de impacto:** una familia con un solo teléfono no puede inscribir a dos socios en
  el mismo gimnasio.
- **Decisión (2026-10-21):** se **mantiene** el teléfono único por gimnasio; se agrega un
  constraint en el modelo (parcial, para no romper filas cargadas por otros caminos) y un
  mensaje explícito: *"Ya existe un socio con ese teléfono en este gimnasio"*.
- **Criterio de aceptación:** la restricción no depende del serializer (constraint en DB) y el
  mensaje dice en qué gimnasio choca.
- **Resolución Fase K5:** `UniqueConstraint(fields=["gym","phone"], condition=~Q(phone=""),
  name="unique_member_phone_per_gym")` en `Member.Meta` (los teléfonos vacíos quedan fuera).
  `MemberViewSet.create/update` y `PublicRegisterView` traducen el `IntegrityError` del
  constraint a **400** con *"Ya existe un socio con ese teléfono en este gimnasio."* (sólo si el
  error es de ese índice; el resto se re-lanza), y los dos serializers usan el mismo texto. La
  migración `0019_member_unique_phone_per_gym` corre `RunPython` con la limpieza **antes** de
  `AddConstraint`, así un deploy no puede fallar por datos sucios; el comando
  `cleanup_duplicate_phones [--gym <id>] [--apply]` permite revisarla aparte (dry-run por
  defecto) y `members/phone_cleanup.py` concentra la lógica (keeper = el más antiguo, sufijo
  `-<id>`, tope de 30 caracteres).
- **Dato corregido (2026-10-22):** la medición que hablaba de "12 grupos duplicados" agrupaba
  por **nombre** de gym (hay varios "Test") — falso positivo. Re-medido por `gym_id` en
  producción (sólo lectura): **1 grupo real** (`gym_id=9`, teléfono `000-0000`, socios
  882/883/884) y 1 socio con teléfono vacío (excluido). En la copia local de staging la
  migración renombró 2 filas y dejó 0 duplicados. La unicidad se aplica **por `gym_id`**, no por
  nombre.
- **Tests:** `backend/members/tests_phase_k5.py` (15 tests: constraint en el mismo gym y entre
  gyms, vacíos permitidos, 400 en alta/edición staff y alta pública, `plan_phone_dedupe`,
  `build_unique_phone` con sufijo/tope/colisiones y el comando en dry-run y `--apply`).

### ACC-20 · Borrar un socio es hard delete en cascada
- **Severidad:** MEDIO · **Estado:** 🔴 · **Sub-fase:** K6 · **Explicación:** `Member` no tiene
  baja lógica: `MemberViewSet.destroy` (`backend/members/views.py:260-277`) llama
  `instance.delete()` y las FK con `on_delete=CASCADE` borran suscripciones, pagos,
  asistencias, inscripciones y rutinas (`backend/subscriptions/models.py:24`,
  `backend/attendance/models.py:53,99,180,261,351`, `backend/activities/models.py:147,273`, etc.).
  El único freno es `ProtectedError` → 409 en los pagos.
- **Ejemplo de impacto:** sin papelera, un borrado accidental destruye el historial comercial
  del socio (y el del gimnasio).
- **Decisión (2026-10-21):** **baja lógica**. Se agrega `Member.deleted_at` (nuevo campo, *no*
  se reutiliza `active`: `active=False` significa "suspendido" y el portal debe seguir
  accesible para que el socio suba un comprobante — ver COM-01), `DELETE` deja de existir
  (405) y todos los listados filtran los socios dados de baja.
- **Criterio de aceptación:** dar de baja un socio conserva el historial y no aparece en los
  listados; "reactivar" lo devuelve.

### ACC-22 · Quitar la cortesía exige elegir un plan de pago
- **Severidad:** MEDIO · **Estado:** ⚪ decisión de negocio (K0) · **Explicación:** es el
  comportamiento correcto y está implementado en dos capas:
  `backend/members/serializers.py:576-602` (`_resolve_plan_for_comp_off`, que exige `plan_id`
  salvo para `entry_mode == "ACTIVITY_ONLY"`, donde usa el plan base) y
  `backend/subscriptions/domain.py:254-258, 313-317` (`SubscriptionConflictError`).
- **Decisión:** quitar la cortesía implica elegir un plan de pago; si el socio no tiene
  ninguno, la operación falla con un mensaje claro. No se cambia.

---

## Fichas — Rutinas (`RUT`)

### RUT-01 · Sin control de rol
- **Severidad:** ALTO · **Estado:** 🟢
- **Resolución Fase H:** `core/permissions.py` → `require_routine_manager` (owner, staff y
  profesor). `routines/views.py` lo aplica vía `RoutineManagerMixin.initial` en los cuatro
  ViewSets y en `BulkAssignRoutineView`. El trainer personal (cuya pantalla es su agenda)
  recibe 403.
- **Criterio de aceptación:** ✅ catálogo y asignación exigen rol de staff/profesor(owner).
- **Tests:** `routines/tests_phase_h.py.RoutineRolePermissionTests` (6 tests).

### RUT-02 · Asignación con hard DELETE
- **Severidad:** MEDIO · **Estado:** 🟢
- **Resolución Fase H:** `RoutineAssignment.delete()` marca `active=False` (soft delete) y
  `RoutineAssignmentViewSet` quita `delete` de `http_method_names` (405).
- **Tests:** `routines/tests_phase_h.py.RoutineAssignmentSoftDeleteTests` (3 tests).

### RUT-03 · Sin unicidad de rutina activa; bulk-assign no atómico
- **Severidad:** MEDIO · **Estado:** 🟢
- **Resolución Fase H:** constraint `uniq_active_routine_per_member` (índice único parcial
  `(gym, member) WHERE active=True`, migración `routines/0010`); `bulk-assign` corre en
  `transaction.atomic()` y mapea `IntegrityError` a un 400 controlado.
- **Tests:** `routines/tests_phase_h.py.RoutineUniquenessTests` (5 tests).

### RUT-04 · Ejercicio desactivado por PATCH
- **Severidad:** BAJO · **Estado:** 🟢
- **Resolución Fase H:** `MemberRoutineSerializer.get_exercises` filtra
  `routine_exercises.filter(is_active=True)`, así que un ejercicio desactivado por PATCH
  ya no aparece en la rutina del socio.
- **Tests:** `routines/tests_phase_h.py.RoutineExerciseHiddenWhenInactiveTests` (2 tests).

### RUT-07 · La app no tiene tests
- **Severidad:** MEDIO · **Estado:** 🟢
- **Resolución Fase H:** `backend/routines/tests_phase_h.py` (16 tests). Sumar `routines` al
  CI sigue pendiente y queda para la Fase J (`REF-02`).

### RUT-09 · `/routines` no está en `ProfessorRoute`
- **Severidad:** MEDIO · **Estado:** 🟢
- **Resolución Fase H:** nuevo `RoutineManagerRoute` en `App.jsx` que permite
  owner/staff/professor y manda al trainer a `/trainer-agenda`. No se usa `ProfessorRoute`
  porque `/routines` ES la home del profesor (envolverla lo expulsaría).

### RUT-06 · Endpoints públicos exponen datos financieros — ⚪ decisión de negocio
- **Severidad:** ALTO · **Estado:** ⚪ (Fase H)
- **Explicación:** `PublicRoutineView` (`/api/routines/public/<token>/`) es el **mismo** endpoint
  que usa el portal del socio y devuelve su rutina, suscripción, pagos, deuda y estado de acceso.
- **Decisión:** el token del portal ES la credencial del socio; el portal necesita esos datos
  para operar (pagar, ver deuda, ver estado de acceso). El riesgo es el de cualquier endpoint
  de portal si el token se filtra, no un leak entre socios. Se documenta y no se cambia.

### RUT-08 · El progreso se resetea por día — ⚪ decisión de negocio
- **Severidad:** MEDIO · **Estado:** ⚪ (Fase H)
- **Explicación:** `WorkoutSet` sólo guarda el entrenamiento del día (`timezone.localdate()`);
  no hay historial entre días.
- **Decisión:** no se implementa historial de entrenamiento; se documenta.

---

## Fichas — Comunidad (`COM`)

> **Auditoría nueva (no existía).** El control de rol (`require_owner`) y el filtrado por
> gimnasio **están correctos**; el endpoint público **no** expone deuda (sólo nombre y locales).
> Lo que sigue es lo que está mal.

### COM-01 · Socio inactivo accede a la tarjeta pública — ⚪ decisión de negocio
- **Severidad:** MEDIO · **Estado:** ⚪ (Fase I).
- **Explicación:** `PublicMemberCommunityView` resuelve al socio con
  `portal_member_or_404`, que no filtra `active`.
- **Decisión:** todo el portal del socio es accesible a socios inactivos **a propósito**
  (ej: subir un comprobante para destrabar un acceso suspendido — ver
  `members/public_views.PublicMemberAttachmentListView`). La tarjeta de comunidad no es un
  dato sensible y no se bloquea. Se documenta en `AUDITORIA-COMUNIDAD.md` §4.2.
- **Test:** `community/tests.py.PublicCommunityVisibilityTests.test_inactive_member_still_sees_card`.

### COM-02 · `discount` sin validar y sin efecto
- **Severidad:** MEDIO · **Estado:** ⚪ (Fase I; validación 🟢 en Fase C).
- **Explicación:** `CharField` libre; no participa de ningún cálculo de cobro.
- **Resolución Fase C:** `CommunityBusinessSerializer.discount` es obligatorio y no admite
  vacío ni sólo espacios. **Decisión de negocio (Fase I):** el `discount` del local es
  informativo (el socio lo muestra en el comercio); no toca la facturación del gimnasio,
  así que no se convierte en descuento de cobro.
- **Tests:** `community/tests.py.CommunityBusinessDiscountTests`.

### COM-03 · Sin unicidad de `name` por gimnasio
- **Severidad:** MEDIO · **Estado:** 🟢 · **Resolución Fase I.**
- **Fix:** `UniqueConstraint(fields=["gym","name"], condition=Q(active=True))` (índice
  único parcial `uniq_community_business_name_per_gym`, migración `community/0002`). Crear o
  editar con un nombre activo repetido mapea `IntegrityError` → **400**. Un local dado de
  baja libera su nombre.
- **Tests:** `community/tests.py.CommunityNameUniquenessTests`.

### COM-04 · Hard delete
- **Severidad:** MEDIO · **Estado:** 🟢 · **Resolución Fase I.**
- **Fix:** `CommunityBusiness.delete()` es baja lógica (`active=False`,
  `save(update_fields=["active"])`); `DELETE` sigue devolviendo 204 pero conserva la fila.
  El listado (staff y público) filtra `active=True`.
- **Tests:** `community/tests.py.CommunitySoftDeleteTests`.

### COM-05 · Sin tests
- **Severidad:** MEDIO · **Estado:** 🟢 · **Resolución Fase I.**
- `backend/community/tests.py` (15 tests: discount obligatorio, soft delete, unicidad,
  guard de rol owner, visibilidad pública). Sumar `community` al CI queda para la Fase J
  (`REF-02`).

### COM-06 · Panel visible a roles sin permiso
- **Severidad:** BAJO · **Estado:** 🟢 (Fase I, re-verificado).
- **No se reproduce:** la pantalla Configuración está bajo `ProfessorRoute`
  (`App.jsx:208`) y `Settings.jsx:746` redirige a cualquier rol distinto de `owner` a
  `/dashboard`; la pestaña "Comunidad" sólo aparece con la feature activa
  (`Settings.jsx:254,843`).

---

## Fichas — Robustez / CI (`REF`)

- **REF-01 · Apps sin tests** 🟢 (Fase J) — `profiles/tests.py` (señal de `UserProfile`),
  `seed/tests.py` (aislamiento de `BaseSeeder`), `core/tests.py` (reglas de precio, gym
  obligatorio, permisos).
- **REF-02 · El CI no corre esas apps** 🟢 (Fase J) —
  `.github/workflows/backend-tests.yml` pasó a correr todas las apps con tests:
  `subscriptions members attendance payments plans config activities outings gyms admins
  accounts personal_training routines community profiles seed core`. Se sumó un job de
  frontend (`pnpm build`).
- **REF-03 · Consultas de dinero sin filtro de gym** 🟢 (Fase J) — `member_credit_balance`,
  `credit_recorded_for` y `consume_member_credit` filtran por `gym` (del socio o de la
  suscripción). Tests de aislamiento cruzado en
  `subscriptions/test_money_invariants.CrossGymCreditIsolationTests`.
- **REF-04 · Admin `paid`/`price_snapshot`** 🟢 — premisa falsa: ya son `readonly_fields`.
- **REF-05 · Frontend sin tests / lint con deuda** 🔴 (K7) — el CI corre `pnpm build`;
  `pnpm lint` hoy falla con **88 problemas (68 errores, 20 warnings)** (91 → 88 con las
  correcciones de K1 y K2): 23 de
  `react-hooks/set-state-in-effect`, 19 de `no-undef` (globals virtuales `__BUILD_ID__` /
  `__APP_VERSION__` / `process` sin declarar en `eslint.config.js`), 19 de
  `react-hooks/exhaustive-deps` (warnings), 13 de `no-unused-vars`, 6 de `no-empty`. Archivos con
  más errores: `src/store/pwa.store.js` (10), `src/features/FeatureProvider.jsx` (4),
  `src/pages/MemberActivities.jsx` (4). **Decisión (2026-10-21):** entra en la Fase K — se
  arregla la config de eslint y la deuda de hooks hasta dejar el lint en 0, y recién entonces
  `pnpm lint` se vuelve **bloqueante en el CI**. Sigue sin tests de front (no hay script
  `test`): queda como mejora posterior.
- **REF-06 · `validate_discount` es código muerto** 🟢 (Fase J) — renombrado a
  `validate_discount_id`; el descuento de otro gimnasio ahora da 400. Tests en
  `members/tests.py`.
- **REF-07 · N+1 en listados** 🟢 (Fase J, nuevo) — el listado semanal/estado de asistencia
  repetía `member_service_label` por socio (~3 queries/inscripto); recuperaciones, pedidos
  de cambio de horario e items de suscripción cargaban FKs de a una. Prefetch/`select_related`
  agregados; tests con `assertNumQueries` en `attendance/tests_phase_j.py` (7→22 y 8→23
  queries sin el fix).
- **REF-08 · Admin sin scope de gimnasio** 🟢 (Fase J, nuevo) — un dueño con acceso al admin
  veía filas de otros gimnasios (`gyms`, `subscriptions`, `plans`, `attendance`, `routines`,
  `community`, `profiles`). `core.admin.GymScopedAdminMixin` acota el queryset; tests en
  `core/tests_admin_scoping.py`.
- **REF-09 · Sin `FRONTEND_URL` los constructores de URLs dan 500** 🟢 (Fase J, nuevo) — el CI
  destapó 14 errores al sumar `gyms`/`admins`: `settings.FRONTEND_URL` era `None` (la variable
  no existe en CI) y `None + str` rompía `Gym.get_onboarding_url`/`get_public_register_url`,
  `GymAdmin.public_register_link` y `GymSeoView`. No era sólo un problema de tests: cualquier
  deploy sin `FRONTEND_URL` daba 500 en el alta de gimnasio y en la vista SEO pública. Cerrado:
  default `""` en `settings.py` + guardas `(settings.FRONTEND_URL or "")` en los cuatro call
  sites; tests `gyms.tests.FrontendUrlMissingTests`.

---

## Pendientes (decisiones de negocio — no se arreglan, se documentan)

| ID | Qué | Afecta a |
|---|---|---|
| DIN-11 | El crédito no se aplica al recuperar un socio | El socio espera que su saldo se use |
| DIN-13 | El chequeo de deuda corre antes que el de ciclo vigente | Inactivo con ciclo vigente + deuda |
| DIN-16 | Recuperar no prorratea (mes completo por pocos días) | El socio que recupera a fin de mes |
| CFG-02 | `allow_member_schedule_changes` legacy | Limpieza de catálogo |
| CFG-03 | `initial_pending` bloquea desde el día 1 | Socio nuevo que paga tarde |
| ADD-11 | Las salidas no descuentan faltas | Ingreso del gimnasio por paquetes |
| ADD-17 | Las salidas en modo sesiones no se ofrecen en el portal | El socio tiene que pedir la inscripción al staff |
| ADD-23 | Desvincular PT no toca los períodos ya generados | El socio no ve la baja pasada (el historial no se reescribe) |
| ACC-22 | Quitar la cortesía exige elegir un plan de pago | Es lo correcto: sin plan, el período quedaría impago |
| RUT-06 | Los endpoints públicos del portal exponen pagos/deuda/acceso | El token del portal es la credencial del socio |
| RUT-08 | El progreso de entrenamiento se resetea por día | Sin historial de entrenamiento |
| COM-01 | Un socio inactivo sigue viendo su tarjeta de comunidad | Todo el portal es accesible a inactivos a propósito (subir comprobante) |
| COM-02 | El `discount` del local no se aplica a ningún cobro | El beneficio es informativo (se muestra en el comercio) |

**Decisiones de negocio que vienen de `PLAN-dinero.md` (Fase 7) y siguen sin dueño:**

| ID | Qué | Afecta a |
|---|---|---|
| DIN-P1 | Los 45 socios de `Gym Demo` congelados desde junio por H1 | Negocio: se reactivan con `recover_member`, nunca con el auto-renovador |
| DIN-P2 | La deuda de los 38 socios bloqueados (3.659.100) | Negocio: hoy no se cobran |
| DIN-P3 | Backfill de `discount_percent_snapshot` para las suscripciones ya abiertas | Sólo hace falta con socios reales (hoy `Sinkro` está en 0: inocuo) |
| DIN-P4 | Los 8 números del audit que no existen en el código (`#32, #30, #35, #18, #40, #38, #33, #37`) | Sin el listado original no son accionables: se cierran como "no accionable" |
| DIN-P5 | `TaskRun` real en producción (el 502 de las 6h) | Verificación operativa: no es código, lo confirma el negocio con un request real |

Además, ya documentados como "no hace hoy" en las auditorías (no se prometen en el manual):
sin reembolsos, sin pago online, sin recordatorios por email/WhatsApp, sin prorrateo en
cambios de plan ni renovaciones, sin fecha de efecto configurable, precios viejos que no se
propagan a socios ya inscriptos.

---

## Anexo A — Bugs de dinero ya cerrados (P12-P29)

Viven en `BUG-Pagos.md`. Resumen: P12 (pagos huérfanos), P19/P20 (integridad de la API de
pagos), P21 (reprecio sin sync), P22/P23 (flag `paid` stale), P24 (`is_recoverable`),
P25 (`/outstanding` paginación), P26 (dashboard float), P27 (CI payments), P28 (higiene),
P29 (crédito consumido). Todos ✅. P13 sigue diferido (ver DIN-17).

En este registro quedan como `🟢`: `DIN-01` (P21 y P14), `DIN-02`/`DIN-08`/`DIN-09` (P24),
`DIN-03` (P22/P23), `DIN-07` (P12), `ADD-08`/`ADD-13`/`ADD-20`, `ACC-08` (P11), `ACC-24` (fix
`f27bc67`), `CFG-05`, `CFG-10`, `CFG-11`, `CFG-13`, `RUT-05`, `REF-04`.

De la Fase 8 (`PLAN-dinero.md`): **P8 → `ADD-27`** 🟢 (K3) · **P10 → `ADD-28`** 🟢 (K2) ·
**P15 → `ADD-29`** 🟢 (K3) · **P9 → `ADD-11`** (decisión de negocio) ·
**P11 → `ACC-08`** 🟢 · **P13 → `DIN-17`** 🟢 (K5) · **P14 → `DIN-01`** 🟢 · **P16** 🟢.

---

## Anexo B — Correr los gates

Ver `PLAN-bugs.md` → "Entorno de gates". Neon no permite crear `test_neondb`; usar el cluster
Postgres 16 descartable en `/tmp`.

**Estado del gate al 2026-10-21** (línea base de la Fase K):

| Gate | Estado |
|---|---|
| Suite completa (`manage.py test` de las 17 apps) | 🟢 529 tests OK (Fase K5) |
| `makemigrations --check --dry-run` | 🟢 sin cambios pendientes |
| `pnpm build` (frontend) | 🟢 verde |
| `pnpm lint` (frontend) | 🔴 **88 problemas (68 errores, 20 warnings)** → `REF-05`, a cerrar en K7 |
| `audit_money_bugs` | 🟢 sin "armados" nuevos |
| Arnés de invariantes (I1–I8) | 🟢 27 violaciones, todas de `seed/base.py` (`DIN-20`); ninguna de código |
| Migraciones pendientes | 🟢 ninguna |

> La Fase K **no** puede darse por cerrada con el lint en rojo: `REF-05` es bloqueante del
> release (decisión 2026-10-21).
