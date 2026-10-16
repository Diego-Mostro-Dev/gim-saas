# Auditoría de Entrenamiento Personal — Cómo funciona hoy el sistema

> Documento descriptivo: **lo que el sistema hace hoy**, verificado contra el código.
> Está pensado para servir de base a un manual para gimnasios, por eso está escrito
> en lenguaje simple. Las referencias de código van aparte, en letra chica, para
> no ensuciar el texto.

---

## 1. Qué es y cómo se habilita

- El **entrenamiento personal** (PT) es un servicio **1 a 1** entre un **socio** y
  un **entrenador/a**, en un **horario fijo semanal**. A diferencia de las
  actividades, no hay grupos ni cupos: cada asignación es exclusiva de un socio
  con un trainer.
- El módulo entero sólo existe si el gimnasio tiene habilitada la **feature
  "Entrenamiento personal"** (`personal_training`). Si no, ni el staff ni el portal
  lo ven y la API responde "feature deshabilitada". El flag por defecto es `False`.
- Se habilita desde el panel de administración del gimnasio (el mismo catálogo
  data-driven de features). La API vive bajo `/api/personal-training/`.

### Referencia
- Feature: `backend/gyms/features.py:20-24` (`FEATURE_PERSONAL_TRAINING =
  "personal_training"`), `:38-46` (catálogo) y `:85-96` (`personal_training_enabled` /
  `require_personal_training`); toggle admin `backend/gyms/admin.py:11`.
- Guard de la API: `backend/personal_training/views.py:41-44`
  (`PersonalTrainingGuardMixin`); rutas `backend/personal_training/urls.py:19-59`.

---

## 2. La oferta (el servicio de entrenamiento)

- La **oferta** (`PersonalTrainingService`) es el servicio facturable del gimnasio.
  Campos que importan:
  - **Nombre**: único dentro del gimnasio (no puede repetirse entre ofertas).
  - **Descripción**: texto libre.
  - **Precio mensual** (`monthly_price`): lo que cuesta por mes en modalidad
    mensual.
  - **Modalidad de cobro** (`billing_mode`): **Mensual** o **Por sesiones**.
  - **Duración de la sesión** (`duration_minutes`): minutos de cada sesión (por
    defecto 60). Define qué franjas se ofrecen al asignar.
  - **Género del entrenador/a** (`trainer_gender`): **Varón**, **Mujer** o
    **Varón o mujer**. Restringe qué trainers pueden tomar esa oferta.
  - **Activo**: el interruptor de publicación (baja lógica).
- **Regla clave**: una oferta **"por sesiones" no tiene cuota mensual**. El backend
  **fuerza `monthly_price = 0`** cuando la modalidad es por sesiones, para que el
  socio no pague el paquete *y* la cuota todos los meses.
- Al crear una oferta sin elegir servicio, se le asigna el servicio agrupador por
  defecto **"Entrenamiento personal"** (slug `personal_training`) del gimnasio.
- **Eliminar** en la API es siempre **baja lógica** (`active = False`): nunca se
  borra la fila. Se puede **reactivar**.
- Varias asignaciones activas de la **misma oferta** comparten **una sola línea de
  facturación** en la suscripción del socio (no se duplica la cuota).

### Referencia
- Modelo: `backend/personal_training/models.py:44-105`
  (`PersonalTrainingService`); modalidad `:21-24,73-82`; precio mensual `:66-72`;
  duración `:83-86`; género `:37-41,87-93`; activo `:94`; nombre único `:98-102`.
- Precio forzado a 0 en "por sesiones": `backend/personal_training/serializers.py:74-93`.
- Servicio por defecto: `backend/plans/models.py:53-64`
  (`PlanService.get_default_personal_training_service`, slug `personal_training`);
  asignación al crear `backend/personal_training/serializers.py:95-102`.
- Baja lógica y reactivar: `backend/personal_training/views.py:74-85`.
- Línea única por oferta: `_ensure_pt_item` `backend/personal_training/assignment_service.py:303-335`.

---

## 3. Los trainers

- El **entrenador/a** es un **usuario del sistema** con rol `trainer` del gimnasio
  (no texto libre). El endpoint de trainers lista los `UserProfile` del gimnasio
  con ese rol, con su nombre, email, género, teléfono y WhatsApp.
- La oferta puede **restringir el género** del trainer. Al asignar (o al rotar el
  trainer de una asignación) se valida compatibilidad.
- El trainer **no carga nada**: ve su agenda en modo lectura y no puede registrar
  sesiones ni cobrar (esa restricción la pone la pantalla, no el backend).

### Referencia
- Endpoint: `backend/personal_training/views.py:88-96` (`TrainerViewSet`);
  serializer `backend/personal_training/serializers.py:118-136` (`TrainerSerializer`).
- Compatibilidad de género: `_gender_compatible` `backend/personal_training/assignment_service.py:294-300`;
  validación al asignar `:41-45` y al rotar `:171-173`.

---

## 4. La asignación (el horario 1:1)

- Una **asignación** (`PersonalTrainingAssignment`) es **el horario y la
  inscripción a la vez**: define el vínculo socio ↔ trainer y el bloque semanal
  (día, hora de inicio, hora de fin).
- Campos que importan:
  - **Modalidad** (`modality`): **Mensual** o **Paquete de sesiones**.
  - **Total de sesiones del paquete** (`package_total_sessions`) y **precio por
    sesión** (`session_price`): sólo en paquetes.
  - **Monto cobrado** (`amount_paid`): cuánto pagó el socio del paquete (se
    sincroniza desde los pagos).
  - **Sellado / coseguro** (`sellado_amount`, `sellado_paid`): monto opcional único
    que cobra el gimnasio (p. ej. la obra social), con su marca de cobrado.
  - **Activa**: baja lógica al desvincular.
- Reglas estructurales: la hora de fin debe ser **posterior** a la de inicio; no
  puede haber dos asignaciones **activas** iguales para el mismo socio, mismo día
  y misma hora de inicio.
- No hay **cupo** ni **lista de espera**: el horario es 1:1 y punto.

### Referencia
- Modelo: `backend/personal_training/models.py:108-265`
  (`PersonalTrainingAssignment`); modalidad `:26-29,154-163`; paquete `:164-195`;
  activo `:197`; `end > start` y único activo `:211-221`; propiedades
  `used_sessions` / `total_amount` / `remaining_amount` / `exhausted` `:230-254`.

---

## 5. Quién lo carga (todo)

- **Sólo el staff** carga entrenamiento personal. No hay autoasignación ni carga en
  el alta/onboarding: el socio **no** se puede asignar solo un entrenamiento.
  - **Owner / administrador**: desde *Entrenamiento personal → Asignaciones →
    "Asignar socio"*, en **dos pasos** (elegir el socio, luego los detalles:
    oferta, trainer, día y horario).
  - **Trainer**: sólo consulta su agenda.
  - **Socio**: desde su portal puede **pedir un cambio de horario** (ver §8), pero
    no darse de alta.
- Al asignar, el sistema valida (en este orden):
  1. El gimnasio tiene la **feature** habilitada.
  2. La **oferta** y el **trainer** pertenecen al gimnasio.
  3. El usuario elegido tiene **rol trainer**.
  4. El **género** del trainer es compatible con la oferta.
  5. El **socio es elegible** para operar (no está bloqueado por falta de pago). La
     aprobación de una solicitud del socio **sí** puede saltear este chequeo.
  6. El socio tiene **dirección cargada** (el entrenamiento es **a domicilio**).
  7. **No hay solapamiento** con: el horario fijo de gimnasio del socio, sus
     **actividades**, sus **otros PT**, ni los **otros PT del trainer** (un trainer
     no puede estar en dos lugares a la vez).
- La pantalla ofrece las **franjas libres** por día (según la duración de la
  oferta). El backend las calcula a partir de las ventanas de apertura del
  gimnasio menos los intervalos ocupados; el frontend las presenta.

### Referencia
- Alta: `AssignmentService.assign_member` `backend/personal_training/assignment_service.py:47-154`;
  chequeos estáticos `check_assignment_inputs` `:24-45`; elegibilidad `:108-110`;
  dirección `:112-116`; validación de solapamiento `:118-121`.
- Solapamiento: `backend/personal_training/overlap.py:11-109` (gimnasio `:37-48`,
  actividades `:51-67`, PT del socio `:70-84`, PT del trainer `:87-100`).
- Serializer de alta: `backend/personal_training/serializers.py:337-360`.
- Franjas libres: `backend/personal_training/availability.py:10-165`;
  endpoint `backend/personal_training/views.py:146-193`;
  utilidades del frontend `frontend/src/utils/ptAvailability.js`.
- Alta/onboarding **no** carga PT (sólo actividades y gimnasio):
  `backend/members/services.py:184-207`.

---

## 6. Cómo se paga

Hay **dos formas** de cobrar el entrenamiento personal, según la **modalidad de la
asignación** (que a su vez depende de la modalidad de la oferta):

### Mensual
- Al asignar se crea (o se reutiliza) una **línea de facturación**
  (`SubscriptionItem` de tipo `personal_training`) dentro de la **suscripción
  vigente** del socio.
- El precio se toma de la **cuota mensual** de la oferta y queda **congelado**. Si
  la suscripción nació **prorrateada**, la línea también se prorratea.
- Para socios de **cortesía** (`is_comp`), la línea se factura en **$0**.
- Se cobra **todos los meses** junto con la cuota del socio, como cualquier plan. No
  tiene seguimiento de sesiones.

### Paquete de sesiones (por sesiones)
- El staff define el **total de sesiones** y el **precio por sesión** (coseguro). El
  monto por sesión es **obligatorio** (usar 0 si la obra social cubre o es sin
  cargo).
- Opcionalmente se define un **sellado / coseguro** (`sellado_amount`): un monto
  **único** que el gimnasio cobra una sola vez por paquete.
- El sistema **no cobra el paquete por adelantado**: se registran **pagos
  parciales** contra el total (`precio por sesión × total de sesiones`).
- Cada cobro crea un `Payment` con concepto **`personal_training`**. El monto
  acumulado (`amount_paid`) se **sincroniza desde esos pagos**: **los pagos son la
  fuente de verdad**.
- **No se puede cobrar más** que el saldo pendiente. A los socios de **cortesía** no
  se les cobra.
- El **sellado** se cobra aparte con concepto **`sellado`**: debe ser exactamente el
  monto configurado, y una sola vez por paquete (mientras siga vigente).

### Deuda
- El saldo pendiente de los paquetes de PT se suma a la **deuda del socio** y a la
  deuda del **gimnasio**, y aparece en **Pagos** y en el portal del socio.

### Dónde se cobra
- El cobro real ocurre desde la pantalla de **Pagos** (el formulario de pago lista
  los paquetes de PT y el sellado como ítems a cobrar) y desde **Recuperar socios**.
- El endpoint `record_payment` de la asignación existe y funciona, pero la pantalla
  de entrenamiento personal **no lo usa**.

### Referencia
- Línea mensual: `_ensure_pt_item` `backend/personal_training/assignment_service.py:303-335`
  (prorrateo `:329-331`; cortesía $0 `:134`); tipo de ítem
  `backend/subscriptions/models.py:205,241-242,299-300`.
- Paquete: datos en `backend/personal_training/models.py:164-195`; totales
  `:235-254`.
- Cobro del paquete: `record_package_payment` `backend/personal_training/assignment_service.py:215-291`
  (`Payment(concept="personal_training")` `:274-286`; tope del saldo `:266-272`;
  cortesía `:235-238`); sincronización `backend/payments/services.py:26-33,69-78`
  (`assignment_sessions_paid`, `sync_assignment_paid`).
- Sellado: `backend/payments/serializers.py:185-199` (`_validate_sellado`);
  `backend/payments/services.py:46-56` (`sellado_paid_exists`).
- Deuda: `backend/subscriptions/services.py:812-846` y `:911-933`
  (`member_personal_training_package_debt`, `gym_personal_training_package_debt`,
  entradas `type="personal_training_package"`); se suma al listado `:1101`;
  dashboard `backend/config/api/dashboard.py:220-225`.
- Dónde se cobra: `frontend/src/components/payments/PaymentForm.jsx:129-179`
  (grupos "PT" y "Sellado"); `frontend/src/pages/RecoverMembers.jsx:230,260-277`.
- Continuidad entre períodos/renovaciones: `_copy_personal_training_items`
  `backend/subscriptions/services.py:139-183`; reactivación `backend/subscriptions/domain.py:220,267-269,381-384`.
- Baja de líneas: `_cancel_pt_items` `backend/personal_training/assignment_service.py:338-363`.

---

## 7. Cómo se usa (sesiones, faltas y renovación)

- **Sólo los paquetes** tienen sesiones. Una asignación mensual no registra nada.
- Hay **dos formas** de registrar una sesión (siempre del lado del staff; **no**
  hay check-in automático por QR para PT como en las clases):

  | Origen | Cuándo pasa |
  |--------|-------------|
  | **Manual** (`manual`) | El staff la registra a mano desde la asignación |
  | **Automática** (`auto`) | Reservado para automatismos internos; hoy la carga visible es manual |
  | **No asistió** (`no_show`) | La crea el **job de faltas** (ver abajo) |

- El registro es **idempotente por (asignación, fecha)**: repetir el mismo día no
  duplica ni cobra dos veces (responde 409).
- El staff puede **quitar** una sesión (corrección) y **renovar** el paquete
  agregando sesiones extra.
- **A diferencia de las salidas, acá SÍ se descuentan las faltas**: un job diario
  crea un registro `no_show` por cada clase esperada a la que el socio no asistió,
  para todas las asignaciones de paquete activas. Así el paquete **se agota por
  inasistencia**. El job avanza un **marcador** (`no_show_scan_until`) para no
  contar dos veces la misma fecha.
- **Renovar** agrega sesiones al total, **reactiva** la asignación y **resetea el
  sellado** (`sellado_paid = False`). Para socios de cortesía deja el precio en $0.
  **No se puede renovar si el socio tiene saldo sin cobrar**.

### Referencia
- Modelo de sesión: `backend/personal_training/models.py:31-35,268-309`
  (`PersonalTrainingSessionRecord`); único por asignación+fecha `:301-306`.
- Servicio de sesiones: `backend/personal_training/session_service.py:15-103`
  (`record_session` `:16-46`, `remove_session` `:48-63`, `renew_package` `:65-102`;
  bloqueo por saldo sin cobrar `:81-89`).
- Faltas de PT: `deduct_missed_pt_assignments` `backend/activities/no_show_service.py:196-232`;
  disparo del job en `backend/subscriptions/services.py:2062-2064`.
- Acciones del staff: `backend/personal_training/views.py:206-296`
  (`record_session`, `remove_session`, `renew`, `record_payment`).

---

## 8. Solicitudes de cambio de horario

- El socio **no** puede cambiar su horario por su cuenta: crea una **solicitud de
  cambio** desde su portal.
- Una solicitud pide un **día y horario nuevos**. El sistema valida:
  - que la asignación esté **activa**,
  - que la hora de fin sea posterior a la de inicio,
  - que el horario pedido **no sea idéntico** al actual,
  - que **no exista ya una solicitud pendiente** para esa asignación (una a la vez),
  - que **no haya solapamiento** con gimnasio, actividades, otros PT del socio ni PT
    del trainer.
- La solicitud nace **pendiente** y puede terminar en:
  - **ejecutada** (`executed`): el staff la aprobó y la asignación ya cambió de
    horario,
  - **rechazada** (`rejected`): el staff la descartó,
  - **cancelada por el socio** (`cancelled_by_member`),
  - **cancelada por el staff** (`cancelled_by_staff`).
- El staff, desde la pestaña **Solicitudes**, **aprueba** o **rechaza**. Al aprobar
  se **revalida el solapamiento** y recién ahí se actualiza el horario recurrente de
  la asignación.
- El estado `approved` existe en el modelo pero **no se usa**: la aprobación pasa
  directo a `executed`.

### Referencia
- Modelo y estados: `backend/personal_training/models.py:312-396`; estados
  `:319-326`; única solicitud pendiente `:380-386`.
- Servicio: `backend/personal_training/change_request_service.py:13-144`
  (`create_request` `:14-64`, `approve_request` `:66-116`, `reject_request` `:118-133`,
  `cancel_request` `:135-143`).
- Staff: `backend/personal_training/views.py:299-381`
  (`approve`, `reject`, `cancel`, y `destroy` que exige cancelar antes de borrar).
- Portal: `backend/personal_training/public_views.py:100-177` (crear) y listado en
  `:41-52`; cancelación por el socio `:157-177`.

---

## 9. La agenda del trainer y el portal del socio

- **Agenda del trainer** (`/trainer-agenda`): pantalla de **sólo lectura**,
  agrupada por día, con el contacto del socio y, en paquetes, el saldo de sesiones.
  El trainer no registra ni cobra.
- **Portal del socio** (`/routine/:token/personal-training`): el socio ve sus
  asignaciones activas (servicio, trainer y su contacto, día y horario, dirección),
  el **progreso** del paquete, el **sellado** y cuánto pagó; y puede **pedir un
  cambio de horario** o cancelar una solicitud propia.

### Referencia
- Agenda: `frontend/src/pages/TrainerAgenda.jsx`.
- Portal: `frontend/src/pages/MemberPersonalTraining.jsx`; datos
  `PublicMemberPersonalTrainingView` `backend/personal_training/public_views.py:25-54`
  y `PublicAssignmentSerializer` `backend/personal_training/serializers.py:472-547`.

---

## 10. Asistencia y métricas

- La pantalla de **Asistencia de entrenamiento personal** (también embebida como
  pestaña "Entrenamiento" en la asistencia del gimnasio) muestra, para un rango de
  fechas, un **resumen** (sesiones programadas, asistidas, no asistidas, pendientes
  y tasa de asistencia) y el **desglose por trainer**, con cada asignación activa,
  el socio y el estado de cada fecha esperada.
- **Sólo los paquetes** tienen seguimiento; las asignaciones **mensuales** se listan
  con `attendance: null` (sin seguimiento). Las fechas esperadas saltean los **días
  cerrados** del gimnasio y arrancan desde la fecha de alta de la asignación (o el
  inicio del rango, lo que sea posterior). Si el paquete ya está agotado, sólo se
  listan las fechas que tienen registro.

### Referencia
- Vista: `backend/personal_training/views.py:395-599`
  (`PersonalTrainingAttendanceView`); fechas esperadas `:580-590`; días cerrados
  `:433-437`.
- Pantalla: `frontend/src/pages/PersonalTrainingAttendance.jsx`; servicio
  `frontend/src/services/personalTraining.service.js:136-150`.

---

## 11. Desvincular, reactivar y renovar

- **Desvincular** (el botón de eliminación hace un `DELETE`) es **baja lógica**: la
  asignación queda inactiva. Además, si era la **última** asignación activa de esa
  oferta, se **cancelan las líneas de facturación** de PT del servicio en las
  suscripciones no vencidas (los períodos históricos no se tocan).
- **Reactivar una oferta** la vuelve a activar (no toca asignaciones ni facturación
  de los ya asignados).
- **Renovar** un paquete agrega sesiones, reactiva la asignación y resetea el
  sellado (ver §7).

### Referencia
- Baja lógica y cancelación de ítems: `unassign_member`
  `backend/personal_training/assignment_service.py:196-213`; `_cancel_pt_items`
  `:338-363`.
- Reactivar oferta: `backend/personal_training/views.py:80-85`.
- Renovar paquete: `backend/personal_training/session_service.py:65-102`.

---

## 12. Lo que el sistema NO hace hoy (para no prometerlo en el manual)

- **No autoasigna el socio**: no hay autoinscripción ni carga de PT en el
  alta/onboarding; todo lo carga el staff.
- **No tiene lista de espera ni cupos**: el horario es 1:1; no hay cola.
- **No tiene check-in por QR para PT**: la sesión del paquete se carga a mano; el
  origen "automático" existe en el modelo pero no hay un flujo de portal que lo
  dispare como en las clases.
- **No tiene recuperaciones**: no existe recuperar una sesión de PT faltada (a
  diferencia de las actividades, sí se descuenta la falta).
- **No cobra el paquete por adelantado**: sólo registra pagos parciales; no hay
  pasarela ni link de pago de PT.
- **No versiona precios en la asignación**: el precio queda congelado en la línea
  de facturación (`SubscriptionItem`) o en el paquete; cambiar la oferta no toca a
  los ya asignados.
- **No actualiza el precio** de los socios ya asignados a una oferta mensual cuando
  el gimnasio cambia el precio.
- **No distingue roles en el backend**: cualquier usuario autenticado del gimnasio
  que pase las validaciones puede crear/editar asignaciones por API; la restricción
  de pantalla (owner vs trainer) la pone el frontend.
- **No avisa por email ni WhatsApp** (aunque el portal muestra los datos de
  contacto del trainer).
- **No valida la duración real** al cargar un horario: sólo exige fin posterior a
  inicio; no obliga a que la duración coincida con los `duration_minutes` de la
  oferta.

---

## 13. Problemas que pueden pasar

Situaciones a tener en cuenta, porque el sistema hoy se comporta así:

1. **El botón "Renovar" aparece duplicado.** En la tarjeta de una asignación de
   paquete no-cortesía se renderizan **dos** botones "Renovar" (uno genérico y otro
   para no-cortesía), ambos abren el mismo diálogo. Es un defecto visual, no cambia
   la lógica.
2. **Cambiar trainer/horario directo no está en la UI.** Existe el endpoint de
   edición (`PATCH` de la asignación, que rota trainer/horario revalidando
   solapamiento), pero la pantalla de PT sólo usa el flujo de **solicitudes de
   cambio**. Editar a mano requiere la API.
3. **El cobro de PT no vive en la pantalla de PT.** El endpoint `record_payment`
   existe pero no se usa; los paquetes y el sellado se cobran desde **Pagos** /
   **Recuperar socios**. Si alguien cobra por otra vía, `amount_paid` puede quedar
   desincronizado hasta el próximo `sync_assignment_paid`.
4. **Faltar agota el paquete.** El job de no-asistencia descuenta sesiones por cada
   clase esperada no asistida; un socio que no asiste puede agotar el paquete sin
   haber entrenado. No hay recuperaciones para compensar.
5. **Renovar puede quedar bloqueado.** Si el socio tiene saldo sin cobrar del
   paquete, la renovación se rechaza hasta que se cobre.
6. **Desvincular la última asignación cancela el cobro, pero sólo en el período
   vigente/futuro.** La cancelación de líneas aplica a suscripciones no vencidas;
   los períodos ya generados y vencidos no se tocan por inmutabilidad.
7. **El wizard de asignación puede "acomodar" el horario.** La lista de franjas se
   arma con inicios alineados a la hora; si la duración de la oferta no encaja en
   una franja, la selección se reconcilia con la primera franja libre, que puede no
   ser la que el staff imaginaba.
8. **Estado `approved` muerto.** El modelo admite `approved`, pero la aprobación
   escribe `executed`; si algo consultara por `approved`, nunca lo encontraría.
9. **Un trainer no puede estar en dos sesiones a la vez, pero sólo se valida por
   día + solapamiento de horas.** Reasignar mal el día (por ejemplo sábado vs
   domingo) no se detecta por error de carga, sólo se valida que no se superpongan
   dentro del mismo día.

### Referencia
- Botón duplicado: `frontend/src/pages/PersonalTrainingSettings.jsx:698-715`.
- Edición por API vs UI: `frontend/src/services/personalTraining.service.js:57-63`
  (`updatePersonalTrainingAssignment`, sin uso en la pantalla); serializer
  `backend/personal_training/serializers.py:362-375`.
- Cobro por otra vía: `backend/personal_training/assignment_service.py:215-291`
  (tope sólo en este flujo) y `backend/payments/services.py:69-78`.
- Faltas: `backend/activities/no_show_service.py:196-232`.
- Bloqueo por saldo: `backend/personal_training/session_service.py:81-89`.
- Cancelación sólo no-vencida: `backend/personal_training/assignment_service.py:345-363`.
- Reconciliación de franjas: `frontend/src/utils/ptAvailability.js:18-72`.
- Estado muerto `approved`: `backend/personal_training/models.py:319-326` vs
  `backend/personal_training/change_request_service.py:108`.

---

### Notas de entorno para leer el código

- Zona horaria: `America/Argentina/Buenos_Aires` (`backend/config/settings.py:461`).
- Toda operación de staff se filtra automáticamente por el gimnasio del usuario
  logueado (`backend/core/mixins.py`); el portal público entra por el token del
  socio (`access_token`).
- Los endpoints de staff exigen la feature `personal_training`
  (`backend/personal_training/views.py:41-44`); los públicos también
  (`require_personal_training` en `backend/personal_training/public_views.py`).
- El entrenamiento personal **comparte el motor de paquetes y de pagos** con
  actividades y salidas (mismo `Payment` con distintos conceptos), y **comparte el
  motor de faltas con las actividades** (a diferencia de las salidas).
- La pantalla de PT se sirve sólo a owner/administrador (la ruta excluye profesor y
  trainer): `frontend/src/App.jsx:100-109,191`.
- El flujo visual de esta feature vive en `frontend/src/dev/PersonalTrainingFlow.jsx`
  (sólo desarrollo) y se alimenta de este documento.
