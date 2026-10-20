# BUGS — Registro general de bugs pre-lanzamiento

Estado: **2026-10-20** — Fases A, B, C, D y E hechas. Total: **98 hallazgos** — 5 `CRÍTICO`,
29 `ALTO`, 47 `MEDIO`, 17 `BAJO`. De ellos **37 ya están cerrados**, **6 son decisiones de
negocio** y quedan **41 abiertos** + 4 a verificar (los 🟡). Fichas de los abiertos con
explicación, ejemplo de impacto y criterio de aceptación.

> Documento de registro. **Fuente de verdad** de bugs/riesgos. Las `AUDITORIA-*.md` son el
> manual descriptivo ("cómo funciona hoy"); esto es "qué está mal y qué hacemos".
> El plan por fases vive en `PLAN-bugs.md`. Los bugs de dinero ya cerrados, en `BUG-Pagos.md`.

## Método

- Repro en rojo (`@unittest.expectedFailure`) → fix → se quita la marca → gate contra
  Postgres descartable → un commit por fase.
- **Triage:** cada hallazgo se re-verificó contra `development` (`f27bc67`) por lectura de
  código; el veredicto está en la ficha. Los marcados 🟡 aún no se re-verificaron.

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

| Área | Crítico | Alto | Medio | Bajo | Cerrados | Decisiones |
|---|---|---|---|---|---|---|
| Dinero/suscripción (`DIN`) | 0 | 7 | 8 | 2 | 7 | 3 |
| Configuración (`CFG`) | 1 | 2 | 4 | 5 | 9 | 2 |
| Add-ons (`ADD`) | 3 | 7 | 11 | 5 | 8 | 1 |
| Acceso/portal (`ACC`) | 1 | 11 | 11 | 0 | 11 | 0 |
| Rutinas (`RUT`) | 0 | 2 | 5 | 2 | 1 | 0 |
| Comunidad (`COM`) | 0 | 0 | 5 | 1 | 1 | 0 |
| Robustez/CI (`REF`) | 0 | 0 | 3 | 2 | 1 | 0 |
| **Total** | **5** | **29** | **47** | **17** | **37** | **6** |

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
| DIN-04 | ALTO | 🔴 | Un cambio de plan con efecto inmediato no consume el crédito del socio | Socio con $20.000 a favor cambia de plan hoy: el período nuevo nace debiendo todo y su crédito queda dormido |
| DIN-05 | ALTO | 🔴 | Otorgar una cortesía reenciende `auto_renew` | El socio había apagado la renovación; al darle cortesía vuelve a renovar solo |
| DIN-06 | ALTO | 🔴 | El socio que nunca pagó el primer mes igual se auto-renueva | Se le acumula un período nuevo de deuda sin haber pagado el anterior |
| DIN-10 | MEDIO | 🔴 | El badge rechaza socios de cortesía, pero `recover_member` los acepta | La UI oculta el botón; el POST igual funciona (inconsistencia) |
| DIN-11 | ALTO | ⚪ | Recuperar a un socio no aplica su saldo a favor | Recupera con crédito disponible pero el período nace 100% impago |
| DIN-12 | BAJO | 🔴 | El endpoint de recuperar responde 201 aunque no cree nada | En el Caso A (reactivación) informa "creado" sin crear |
| DIN-13 | MEDIO | ⚪ | El chequeo de deuda corre antes que el de ciclo vigente | Inactivo con ciclo vigente + deuda residual no puede reactivarse |
| DIN-15 | MEDIO | 🔴 | `recover_member` no toma lock; la carrera la resuelve el constraint con 500 | Doble click → 500 en vez de error controlado (no duplica ciclo) |
| DIN-16 | ALTO | ⚪ | Recuperar no prorratea | Recuperar el día 25 cobra el mes completo por 5 días |
| DIN-17 | BAJO | 🔴 | `calculate_subscription_total` reintroduce el precio vigente (fallback P13) | Una fila legacy sin ítem de plan se factura al precio actual del plan |
| DIN-18 | ALTO | 🟢 | Agregar sesiones a un paquete vuelve a dejar el sellado pendiente | Cerrado Fase D: `renew_package` ya no resetea `sellado_paid` |
| CFG-01 | MEDIO | 🟢 | Unidades horas/días mezcladas entre pantallas | Cerrado Fase C: ambas UIs en horas, entero ≥ 0 (backend ya era entero) |
| CFG-02 | BAJO | ⚪ | `allow_member_schedule_changes` legacy | Campo que ya no gobierna ninguna regla |
| CFG-03 | MEDIO | ⚪ | `initial_pending` bloquea desde el día 1 | Socio nuevo sin primer pago no puede entrar aunque haya pagado el día 2 |
| CFG-04 | MEDIO | 🔴 | El staff crea cambios de horario sin cooldown ni máximo mensual | Sin el límite que sí aplica al socio |
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
| ADD-03 | ALTO | 🔴 | Cambiar de horario puede dejar al socio sin ninguno | Si falla la reinscripción queda sin horario |
| ADD-04 | MEDIO | 🟡 | "Restaurar horarios" revive todos, incluidos los desactivados a propósito | Reactiva horarios que el staff había apagado |
| ADD-05 | MEDIO | 🔴 | El choque con el gimnasio se calcula como "hora + 1 h" | Bloques de más de 1 hora pueden no detectarse |
| ADD-06 | ALTO | 🟢 | El portal rompe al renderizar una actividad desactivada | Cerrado Fase E (re-verificado): `MemberActivities.jsx` segrega huérfanas/desactivadas y el serializer expone `activity_active`/`schedule_active` |
| ADD-07 | CRÍTICO | 🔴 | El no-show descuenta sesión en fechas sin clase | Feriado no cargado o clase cancelada → el socio pierde una sesión paga |
| ADD-08 | ALTO | 🟢 | Paquete sobre-cobrable fuera de `record_package_payment` | Cerrado: el serializer de pagos unificado valida el tope y resincroniza |
| ADD-11 | ALTO | ⚪ | Faltar a una salida no descuenta sesión | El paquete nunca se agota; el gimnasio no cobra sesiones usadas |
| ADD-12 | MEDIO | 🔴 | El conteo de salidas depende de entrar dentro de la ventana | Llegar tarde no descuenta; queda pendiente manual |
| ADD-13 | ALTO | 🟢 | Paquete de salida sobre-cobrable | Cerrado por el mismo serializer unificado |
| ADD-14 | MEDIO | 🟡 | Renovación de salidas bloqueada por sesiones impagas | Bloquea una acción de staff |
| ADD-15 | BAJO | 🟡 | "Reactivar" revive todos los horarios (engañoso) | UX |
| ADD-16 | ALTO | 🔴 | Las salidas no validan choque con gimnasio/actividades/PT | El socio queda anotado en dos cosas a la misma hora |
| ADD-17 | MEDIO | 🟡 | El portal no ofrece salidas en modo sesiones | El socio no puede inscribirse solo |
| ADD-18 | BAJO | 🔴 | Botón "Renovar" duplicado | Cosmético |
| ADD-19 | BAJO | 🟡 | El PATCH directo de trainer/horario no está en la UI | Feature no alcanzable |
| ADD-20 | MEDIO | 🟢 | `record_payment` de PT sin usar / desincroniza `amount_paid` | Cerrado: `RecoverMembers.jsx` lo usa y todo Payment resincroniza |
| ADD-21 | ALTO | 🔴 | En PT las faltas agotan el paquete sin recuperación | El socio paga sesiones que no usó y no se le reponen |
| ADD-22 | MEDIO | 🟡 | Renovación de PT bloqueada por saldo impago | Bloquea una acción de staff |
| ADD-23 | MEDIO | 🔴 | Desvincular PT no toca los períodos ya generados | Intencional (inmutabilidad), pero el socio no ve la baja pasada |
| ADD-24 | BAJO | 🟡 | El wizard de asignación reconcilia el horario elegido | Puede no ser el que el staff esperaba |
| ADD-25 | BAJO | 🟡 | Estado `approved` muerto en PT | Código latente |
| ADD-26 | MEDIO | 🔴 | PT: reasignar a otro día no se detecta como doble-booking | Solo valida mismo día + solape horario |
| ACC-01 | CRÍTICO | 🟢 | El cupo se cuenta a sí mismo: "El horario está completo" | Cerrado Fase E: el cupo excluye al propio socio (check-in y alta de staff) |
| ACC-02 | MEDIO | 🔴 | No hay ventana horaria de check-in | Se puede marcar a las 03:00 |
| ACC-03 | MEDIO | 🔴 | El staff puede marcar asistencia en un día cerrado | `GymClosedDate` no se chequea en el serializer de staff |
| ACC-04 | MEDIO | 🔴 | "Ya entró hoy" devuelve 200 con `success:false` | El front no lo distingue de un éxito por status |
| ACC-05 | ALTO | 🟢 | Doble registro del staff → 500 | Cerrado Fase E: pre-check + `IntegrityError` → 400 en `AttendanceSerializer.create` |
| ACC-06 | ALTO | 🟢 | Límite de 30/h por IP en el portal | Cerrado Fase E: se quitó el throttle por IP; queda sólo el de token del portal |
| ACC-07 | MEDIO | 🟢 | Dos horarios el mismo día: entra una sola vez por QR | Cerrado Fase E: el QR registra una sola asistencia por día |
| ACC-08 | ALTO | 🔴 | La sesión del paquete no se descuenta si entra fuera de la ventana | Entra, entrena, y el paquete queda igual (pierde el gimnasio) |
| ACC-09 | MEDIO | 🟢 | Panel de horarios: label `executed` y filtro "Aprobadas" vacío | Cerrado Fase E: `executed` mapeado y "Aprobadas" matchea approved+executed |
| ACC-10 | ALTO | 🔴 | Aprobar desactiva el horario viejo de inmediato | El socio pierde las clases de la semana en curso |
| ACC-11 | ALTO | 🟢 | El cooldown de 7 días cuenta las rechazadas | Cerrado Fase E: el cooldown ignora las solicitudes rechazadas |
| ACC-12 | ALTO | 🟢 | Doble pedido de horario → 500 | Cerrado Fase E: `IntegrityError` del constraint → 409 (serializer y `_handle_action`) |
| ACC-13 | MEDIO | 🔴 | Staff crea cambios sin límites (ver CFG-04) | Duplicado de CFG-04 |
| ACC-14 | MEDIO | 🔴 | Un horario puede quedar duplicado | Editar horarios con pedido pendiente |
| ACC-16 | MEDIO | 🔴 | Aprobar un cambio de plan cancela pedidos de horario en silencio | El socio debe volver a pedir y no se le avisa |
| ACC-17 | ALTO | 🟢 | El alta pública descarta el descuento y fuerza `is_comp=False` en silencio | Cerrado Fase E (decisión de negocio): el alta pública nunca honra `discount_id`/`is_comp` (son privilegios de staff) y deja warning en logs para asignarlos desde el panel |
| ACC-18 | ALTO | 🟢 | Rotación de token deja el link viejo muerto | Cerrado Fase E: todos los endpoints del portal aceptan el token de una generación anterior (gracia de 1 generación; 2+ invalidado por diseño) |
| ACC-19 | MEDIO | 🟡 | Teléfono único por gimnasio | Una familia con un solo teléfono no puede inscribir a dos |
| ACC-20 | MEDIO | 🟡 | Borrar un socio es hard delete en cascada | Sin papelera; se pierde historial |
| ACC-22 | MEDIO | 🟡 | Quitar la cortesía exige elegir un plan de pago | El cambio falla si no se elige plan |
| ACC-23 | ALTO | 🔴 | Obra social sin match → texto libre sin precio | No se cobra el coseguro; el gimnasio pierde plata |
| ACC-24 | ALTO | 🟢 | 500 al pedir cambio de horario de PT | Cerrado `f27bc67` (bug real no documentado en ninguna auditoría) |
| ACC-25 | ALTO | 🟢 | Login con contraseña incorrecta → 500 y Axes no registra el intento | Cerrado Fase E: `authenticate(request=...)`; responde 400 y Axes registra el `AccessAttempt` |
| RUT-01 | ALTO | 🔴 | Sin control de rol en rutinas | Cualquier usuario del gym gestiona catálogo y asigna rutinas |
| RUT-02 | MEDIO | 🔴 | Asignación con hard DELETE | Se borra la fila; sin soft delete ni historial |
| RUT-03 | MEDIO | 🔴 | Sin unicidad de rutina activa; bulk-assign no atómico | Doble submit deja dos rutinas activas o estados a medias |
| RUT-04 | BAJO | 🔴 | Un ejercicio desactivado por PATCH sigue saliendo en la rutina | El socio ve ejercicios "borrados" |
| RUT-05 | BAJO | 🟢 | `RoutineExerciseViewSet` sin `GymModelViewSet` | No se reproduce: `RoutineExercise` no tiene campo `gym` |
| RUT-06 | ALTO | 🔴 | Endpoints públicos exponen pagos, deuda y estado de acceso | Un token filtra la situación financiera del socio sin login |
| RUT-07 | MEDIO | 🔴 | La app no tiene tests | Sin red de seguridad |
| RUT-08 | MEDIO | 🔴 | El progreso se resetea por día | Sin historial de entrenamiento |
| RUT-09 | MEDIO | 🔴 | `/routines` no está en `ProfessorRoute` | Cualquier rol la abre |
| COM-01 | MEDIO | 🔴 | Un socio inactivo sigue accediendo a su tarjeta pública | El endpoint público no filtra `active` ni acepta el token rotado |
| COM-02 | MEDIO | 🟢 | `discount` es texto libre y no participa de ningún cobro | Cerrado Fase C: `discount` obligatorio y no en blanco (mensaje de dominio). Que el descuento no se aplique a un cobro queda como decisión de negocio (Fase I) |
| COM-03 | MEDIO | 🔴 | Sin unicidad de `name` por gimnasio → duplicados | Locales repetidos con descuentos distintos |
| COM-04 | MEDIO | 🔴 | `business.delete()` es hard delete | Sin soft delete ni histórico |
| COM-05 | MEDIO | 🔴 | `community` no tiene tests y no corre en CI | Tests agregados en Fase C (`community/tests.py`); falta sumarla al CI (Fase J / REF-02) |
| COM-06 | BAJO | 🟡 | El panel de comunidad se muestra a roles que recibirán 403 | UX |
| REF-01 | MEDIO | 🔴 | Apps sin tests: `community`, `routines`, `profiles`, `seed`, `core` | — |
| REF-02 | MEDIO | 🔴 | El CI no corre `gyms`, `admins`, `accounts`, `personal_training`, `profiles`, `routines`, `community`, `seed`, `core` | Apps con tests no se ejecutan en CI |
| REF-03 | MEDIO | 🔴 | Consultas de dinero sin filtro de gym | La invariante `Member.gym` inmutable sólo está en un comentario |
| REF-04 | BAJO | 🟢 | Admin `paid`/`price_snapshot` editables | Premisa falsa: ya están en `readonly_fields` |
| REF-05 | BAJO | 🟡 | El frontend no tiene tests | Los bugs de render se verifican a mano |

---

## Fichas — Dinero / suscripción (`DIN`)

### DIN-04 · Un cambio de plan con efecto inmediato no consume el crédito
- **Severidad:** ALTO · **Estado:** 🔴 (PARCIAL)
- **Explicación:** el camino del día 1 (`create_next_subscription`) consume el saldo a favor
  del socio; el camino de efecto inmediato (aprobar con fecha de efecto HOY, sin ciclo
  vigente) no llama a `consume_member_credit`. El ítem de PT mensual **sí** quedó cubierto
  (`open_subscription` llama `ensure_pt_items_for_active_assignments`).
- **Ejemplo de impacto:** socio con $20.000 a favor cambia de plan con efecto inmediato: el
  período nuevo nace debiendo todo y el crédito queda durmiendo hasta la próxima renovación.
- **Dónde:** `backend/subscriptions/views.py:348-358`, `backend/subscriptions/services.py:1356`.
- **Criterio de aceptación:** el período creado por efecto inmediato descuenta el crédito
  disponible de la misma forma que la renovación.

### DIN-05 · La cortesía reenciende `auto_renew`
- **Severidad:** ALTO · **Estado:** 🔴
- **Explicación:** `mutate_membership(comp=True)` escribe `current.auto_renew = True`
  incondicionalmente; en el branch sin ciclo vigente se abre con `auto_renew=True` fijo.
- **Ejemplo de impacto:** el socio había apagado la renovación; al darle cortesía empieza a
  renovar solo de nuevo.
- **Dónde:** `backend/subscriptions/domain.py:210-211`, `:309`.
- **Criterio de aceptación:** dar/quitar cortesía no altera `auto_renew` que eligió el socio.

### DIN-06 · El impago inicial no frena la renovación
- **Severidad:** ALTO · **Estado:** 🔴
- **Explicación:** `get_subscription_payment_status` devuelve `initial_pending`, pero
  `payment_blocked()` sólo frena con estado `blocked`; el loop de renovación no tiene guard
  para el primer mes impago.
- **Ejemplo de impacto:** socio que nunca pagó el primer mes recibe el segundo período con
  deuda nueva encima.
- **Dónde:** `backend/subscriptions/services.py:1215-1216`, `:1585-1592`, `:1634-1666`.
- **Criterio de aceptación:** "primer mes impago" es un estado que impide la auto-renovación
  (o decisión de negocio explícita en contrario).

### DIN-10 · El badge rechaza comp; la acción no
- **Severidad:** MEDIO · **Estado:** 🔴
- **Explicación:** `get_is_recoverable` devuelve `False` si `is_comp`, `recover_member` no
  tiene ningún gate por comp.
- **Ejemplo de impacto:** socio comp que el sistema podría recuperar no muestra el botón;
  desde la API el POST funciona.
- **Dónde:** `backend/members/serializers.py:272-273` vs `backend/subscriptions/services.py:1423-1433`.

### DIN-11 · Recuperar no aplica el saldo a favor
- **Severidad:** ALTO · **Estado:** ⚪ decisión de negocio
- **Explicación:** `recover_member` no llama a `consume_member_credit` (sólo lo hace
  `create_next_subscription`).
- **Ejemplo de impacto:** socio con crédito disponible recupera y su período nace 100% impago.

### DIN-12 · El endpoint de recuperar siempre responde 201
- **Severidad:** BAJO · **Estado:** 🔴
- **Dónde:** `backend/subscriptions/views.py:175-176`.

### DIN-13 · El chequeo de deuda corre antes que el de ciclo vigente
- **Severidad:** MEDIO · **Estado:** ⚪ (documentado como intencional)
- **Explicación:** `member_total_outstanding_debt > 0` se evalúa antes del Case A.
- **Dónde:** `backend/subscriptions/services.py:1423` antes de `:1428-1433`.

### DIN-15 · Recuperar sin lock
- **Severidad:** MEDIO · **Estado:** 🔴
- **Explicación:** `open_subscription` toma `select_for_update` sobre un query de overlap,
  pero en recovery no hay filas que lockear; lo que evita el ciclo duplicado es el constraint
  `unique_subscription_member_period`, que ante doble click devuelve **500**.
- **Criterio de aceptación:** la carrera se resuelve con un 409/400 controlado, no con 500.

### DIN-16 · Recuperar sin prorrateo
- **Severidad:** ALTO · **Estado:** ⚪ decisión de negocio
- **Ejemplo de impacto:** recuperar el día 25 cobra el mes completo por 5 días.

### DIN-17 · Fallback de precio (P13)
- **Severidad:** BAJO · **Estado:** 🔴 (diferido)
- **Explicación:** `if not has_plan_item ... total += subscription.plan.price` para filas legacy.
- **Dónde:** `backend/subscriptions/services.py:326-327`.

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
- **Severidad:** MEDIO · **Estado:** 🔴
- **Explicación:** el serializer **staff** de cambio permanente no usa
  `count_schedule_changes_used_this_month` ni cooldown, a diferencia de los caminos público y
  de swap.
- **Dónde:** `backend/attendance/serializers.py:443` vs `:666`, `:938`, `:1163`.
- **Criterio de aceptación:** el cambio creado por staff respeta el límite mensual configurado.

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
- **Severidad:** ALTO · **Estado:** 🔴
- **Explicación:** el cambio hace `unenroll` y luego `enroll` sin rollback.
- **Dónde:** `frontend/src/pages/MemberActivities.jsx:98-113`.

### ADD-05 · Choque asume bloques de 1 hora
- **Severidad:** MEDIO · **Estado:** 🔴 · **Dónde:** `backend/activities/overlap.py:30,117,143-145`.

### ADD-06 · El portal rompe con una actividad desactivada
- **Severidad:** ALTO · **Estado:** 🟡 (sin re-verificar) · **Dónde:** `frontend/src/pages/MemberActivities.jsx` (ref. auditoría `:338`).

### ADD-07 · El no-show descuenta en fechas sin clase
- **Severidad:** CRÍTICO · **Estado:** 🔴
- **Explicación:** toda fecha válida sin registro se marca falta; sólo se saltean
  `GymClosedDate`, no clases canceladas ni feriados no cargados.
- **Ejemplo de impacto:** feriado que nadie cargó → el socio pierde una sesión paga sin haber
  tenido clase.
- **Dónde:** `backend/activities/no_show_service.py:76,158-163`.
- **Criterio de aceptación:** no se descuenta sesión en fechas sin clase dictada (feriado,
  cancelación).

### ADD-11 · Faltar a una salida no descuenta
- **Severidad:** ALTO · **Estado:** ⚪ decisión de negocio · **Explicación:** el job de no-show no recorre salidas.
- **Dónde:** `backend/activities/no_show_service.py:235-256`, `backend/subscriptions/services.py:14,2080`.
- **Criterio de aceptación:** decisión de negocio: o no descuenta (documentar) o se agrega el
  job.

### ADD-12 · El conteo de salidas depende de la ventana
- **Severidad:** MEDIO · **Estado:** 🔴 · **Dónde:** `backend/attendance/public_views.py:80-102`.

### ADD-16 · Las salidas no validan choque
- **Severidad:** ALTO · **Estado:** 🔴 · **Explicación:** `enroll_member` no valida solape con
  gimnasio, actividades ni PT.
- **Ejemplo de impacto:** el socio queda en running y en una actividad a la misma hora.
- **Dónde:** `backend/outings/enrollment_service.py:20-121`.

### ADD-18 · Botón "Renovar" duplicado
- **Severidad:** BAJO · **Estado:** 🔴 · **Dónde:** `frontend/src/pages/PersonalTrainingSettings.jsx:711-727`.

### ADD-21 · En PT las faltas agotan el paquete
- **Severidad:** ALTO · **Estado:** 🔴 · **Explicación:** el no-show de PT no tiene créditos de
  recuperación (las actividades sí).
- **Ejemplo de impacto:** el socio paga 8 sesiones, falta 3 y le quedan 5 sin reposición.
- **Dónde:** `backend/activities/no_show_service.py:109-149`, `backend/attendance/recovery_service.py:19-21`.

### ADD-23 · Desvincular PT no toca períodos ya generados
- **Severidad:** MEDIO · **Estado:** 🔴 (intencional) · **Dónde:** `backend/personal_training/assignment_service.py:338-361`.

### ADD-26 · PT: reasignar a otro día no se detecta
- **Severidad:** MEDIO · **Estado:** 🔴 · **Explicación:** sólo valida mismo día + solape
  horario; un día mal cargado no salta.
- **Dónde:** `backend/personal_training/overlap.py:97-108`, `backend/personal_training/assignment_service.py:176-190`.

### ADD-04, ADD-14, ADD-15, ADD-17, ADD-19, ADD-22, ADD-24, ADD-25 — 🟡 a verificar
Hallazgos de las auditorías de actividades/salidas/PT sin re-verificar aún. Detalle en
`AUDITORIA-ACTIVIDADES.md §8`, `AUDITORIA-SALIDAS.md §9`, `AUDITORIA-PERSONAL-TRAINING.md §13`.

---

## Fichas — Acceso / portal (`ACC`)

### ACC-25 · Login con contraseña incorrecta → 500 (Axes sin `request`)
- **Severidad:** ALTO · **Estado:** 🔴 (detectado por el gate de Fase D)
- **Explicación:** `LoginSerializer.validate` llama a
  `django.contrib.auth.authenticate(username=..., password=...)` **sin `request`**, y
  `LoginView` no le pasa `context`. Con la contraseña correcta `ModelBackend` (primero en
  `AUTHENTICATION_BACKENDS`) resuelve antes; con la incorrecta se llega a
  `AxesStandaloneBackend`, que exige `request` y lanza
  `AxesBackendRequestParameterRequired` → **500**.
- **Ejemplo de impacto:** un usuario que se equivoca de contraseña ve un error de servidor en
  vez de "usuario o contraseña inválidos", y **Axes nunca registra los intentos fallidos**, así
  que el bloqueo por fuerza bruta del login API queda inoperante.
- **Dónde:** `backend/accounts/serializers.py:14-26`, `backend/accounts/views.py:43-45`,
  `backend/config/settings.py:117-120`.
- **Criterio de aceptación:** contraseña incorrecta devuelve 401 controlado (nunca 500) y Axes
  cuenta/limita el intento. Fix esperado: `LoginSerializer(data=request.data,
  context={"request": request})` y `authenticate(request=..., ...)`.
- **Detectado por:** `accounts.tests.LoginTests.test_login_wrong_password_rejected` (rojo
  preexistente; `accounts` no corre en CI — ver REF-02/Fase J).

### ACC-01 · El cupo se cuenta a sí mismo
- **Severidad:** CRÍTICO · **Estado:** 🔴
- **Explicación:** la ocupación base incluye los horarios activos del propio socio; sólo el
  swap lo excluye.
- **Ejemplo de impacto:** un horario con capacidad 10 y 10 inscriptos le dice "El horario está
  completo" a esos mismos 10 socios: nadie puede entrar a su propio horario.
- **Dónde:** `backend/attendance/utils.py:71-77`, `backend/attendance/serializers.py:281`,
  `backend/attendance/public_views.py:315`.
- **Criterio de aceptación:** el socio ya inscripto nunca cuenta contra el cupo que él mismo
  ocupa.

### ACC-05 · Doble registro del staff → 500
- **Severidad:** ALTO · **Estado:** 🔴 · **Dónde:** `backend/attendance/serializers.py:264-281`,
  `backend/attendance/models.py:154`, `backend/attendance/views.py:687`.
- **Criterio de aceptación:** segunda marca devuelve 200/409 controlado, nunca 500.

### ACC-06 / ACC-13(dup) · Throttle 30/h por IP
- **Severidad:** ALTO · **Estado:** 🔴 · **Explicación:** `AnonRateThrottle` de 30/hora.
- **Ejemplo de impacto:** un gimnasio con un sólo WiFi: el socio nº 31 en una hora recibe 429
  y no puede registrar su asistencia.
- **Dónde:** `backend/config/api/throttles.py:27-29`, `backend/attendance/public_views.py:107`.

### ACC-08 · La sesión no se descuenta fuera de la ventana
- **Severidad:** ALTO · **Estado:** 🔴 · **Dónde:** `backend/attendance/public_views.py:54-100`.

### ACC-10 · Aprobar desactiva el horario viejo de inmediato
- **Severidad:** ALTO · **Estado:** 🔴 · **Ejemplo:** la UI promete vigencia futura pero el
  horario actual se apaga al aprobar; el socio pierde las clases de esta semana.
- **Dónde:** `backend/attendance/views.py:893-900`, `backend/attendance/serializers.py:717-724`.

### ACC-11 · El cooldown cuenta las rechazadas
- **Severidad:** ALTO · **Estado:** 🔴 · **Dónde:** `backend/attendance/serializers.py:653-662`.

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
- **Severidad:** ALTO · **Estado:** 🔴 · **Explicación:** `_autolink_insurance` normaliza
  (minúsculas/acentos) pero si no matchea queda `None` → sin precio de coseguro.
- **Dónde:** `backend/members/serializers.py:31-37,239-242,444-452`.
- **Criterio de aceptación:** el coseguro no puede quedar en 0 por un nombre mal escrito.

### ACC-02, ACC-03, ACC-04, ACC-14, ACC-16 — 🔴
Detalle en `AUDITORIA-ASISTENCIAS.md §7` y `AUDITORIA-HORARIOS.md §7`; veredicto en la tabla
maestra (todos re-verificados VIVO el 2026-10-19). Siguen abiertos y sin fase asignada: decidir
en la Fase K.

### ACC-19, ACC-20, ACC-22 — 🟡 a verificar
Detalle en `AUDITORIA-MIEMBROS.md §9`.

---

## Fichas — Rutinas (`RUT`)

### RUT-01 · Sin control de rol
- **Severidad:** ALTO · **Estado:** 🔴 · **Dónde:** `backend/routines/views.py:53,59,65,70,272`.
- **Criterio de aceptación:** catálogo y asignación exigen rol de staff/profesor.

### RUT-06 · Endpoints públicos exponen datos financieros
- **Severidad:** ALTO · **Estado:** 🔴 · **Explicación:** `permission_classes=[]` + throttle;
  el payload trae `paid`, `payment_status`, `payments`, deuda y estado de acceso.
- **Dónde:** `backend/routines/views.py:340,425,553,727,813-821`.

### RUT-02 / RUT-03 / RUT-07 / RUT-08 / RUT-09 — 🔴
Soft delete de asignación (`views.py:65`), unicidad de rutina activa + bulk no atómico
(`views.py:313`), falta de tests, progreso por día (`views.py:356,404`), ruta sin
`ProfessorRoute` (`frontend/src/App.jsx:199`).

### RUT-04 · Ejercicio desactivado por PATCH
- **Severidad:** BAJO · **Estado:** 🔴 · **Dónde:** `backend/routines/serializers.py:14-18,132`
  (el manager filtra, pero un PATCH a `is_active` sin cascada deja el hueco).

---

## Fichas — Comunidad (`COM`)

> **Auditoría nueva (no existía).** El control de rol (`require_owner`) y el filtrado por
> gimnasio **están correctos**; el endpoint público **no** expone deuda (sólo nombre y locales).
> Lo que sigue es lo que está mal.

### COM-01 · Socio inactivo accede a la tarjeta pública
- **Severidad:** MEDIO · **Estado:** 🔴 · **Dónde:** `backend/community/public_views.py:26`,
  `backend/members/models.py:198,289`.

### COM-02 · `discount` sin validar y sin efecto
- **Severidad:** MEDIO · **Estado:** 🟢 (Fase C, validación) · **Explicación:** `CharField` libre
  que no participa de ningún cálculo de cobro.
- **Dónde:** `backend/community/models.py:35,45`.
- **Resolución Fase C:** `CommunityBusinessSerializer.discount` es obligatorio y no admite vacío
  ni sólo espacios (mensajes en español). Que el descuento no se aplique a ningún cobro queda
  como decisión de negocio y se revisa en Fase I. Tests: `community/tests.py`.

### COM-03 · Sin unicidad de `name` por gimnasio
- **Severidad:** MEDIO · **Estado:** 🔴 · **Dónde:** `backend/community/models.py:45-48`.

### COM-04 · Hard delete
- **Severidad:** MEDIO · **Estado:** 🔴 · **Dónde:** `backend/community/views.py:70`, `models.py:6`.

### COM-05 · Sin tests
- **Severidad:** MEDIO · **Estado:** 🔴 · No existe `backend/community/tests.py`.

### COM-06 · Panel visible a roles sin permiso — 🟡
`frontend/src/pages/Settings.jsx:843`, `frontend/src/App.jsx:195`.

---

## Fichas — Robustez / CI (`REF`)

- **REF-01 · Apps sin tests** 🔴 — `community`, `routines`, `profiles`, `seed`, `core`.
- **REF-02 · El CI no corre esas apps** 🔴 — `.github/workflows/backend-tests.yml:73` corre
  sólo `subscriptions members attendance payments plans config activities outings` (más
  `gyms.tests_restore`). Faltan `gyms`, `admins`, `accounts`, `personal_training`, `profiles`,
  `routines`, `community`, `seed`, `core`.
- **REF-03 · Consultas de dinero sin filtro de gym** 🔴 — `member_credit_balance`,
  `credit_recorded_for`, `consume_member_credit` (`backend/subscriptions/services.py:438,466`);
  la invariante "`Member.gym` inmutable" sólo está en un comentario, no en el esquema.
- **REF-04 · Admin `paid`/`price_snapshot`** 🟢 — premisa falsa: ya son `readonly_fields`.
- **REF-05 · Frontend sin tests** 🟡 — sólo `lint`/`build`.

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

En este registro quedan como `🟢`: `DIN-01` (P21), `DIN-02`/`DIN-08`/`DIN-09` (P24),
`DIN-03` (P22/P23), `DIN-07` (P12), `ADD-08`/`ADD-13`/`ADD-20`, `ACC-24` (fix `f27bc67`),
`CFG-05`, `CFG-10`, `CFG-11`, `CFG-13`, `RUT-05`, `REF-04`.

---

## Anexo B — Correr los gates

Ver `PLAN-bugs.md` → "Entorno de gates". Neon no permite crear `test_neondb`; usar el cluster
Postgres 16 descartable en `/tmp`.
