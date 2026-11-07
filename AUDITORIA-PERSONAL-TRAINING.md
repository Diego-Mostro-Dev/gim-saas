# Auditoría de Entrenamiento Personal — Cómo funciona hoy el sistema

> Documento descriptivo: **lo que el sistema hace hoy**, verificado contra el código.
> Está pensado para servir de base a un manual para gimnasios, por eso está escrito
> en lenguaje simple. Las referencias de código van aparte, en letra chica, para
> no ensuciar el texto.
>
> **Estado:** secciones 1–7 verificadas en las Fases 5.5–5.6. Las secciones 8–13
> siguen pendientes de la Fase 5.7; el documento completo se marcará como
> `Verificado` al cerrar la Fase 5.7.

---

## 1. Qué es y cómo se habilita

- El **entrenamiento personal** (PT) es un servicio **1 a 1** entre un **socio** y
  un **entrenador/a**, en un **horario fijo semanal**. A diferencia de las
  actividades, no hay grupos ni cupos: cada asignación es exclusiva de un socio
  con un trainer.
- El módulo entero sólo existe si el gimnasio tiene habilitada la **feature
  "Entrenamiento personal"** (`personal_training`). El flag viene **apagado por
  defecto**; si no está activo, ni el staff ni el portal lo ven y la API responde
  "feature deshabilitada".
- Se habilita desde el **panel de administración del gimnasio** (el catálogo
  data-driven de features). La API vive bajo `/api/personal-training/` y todos sus
  endpoints pasan por el guard de la feature.

### Referencia
- Feature: `backend/gyms/features.py · FEATURE_PERSONAL_TRAINING`,
  `feature_catalog`, `personal_training_enabled` y `require_personal_training`.
- Toggle del admin: `backend/gyms/admin.py · GymAdminForm`.
- Guard y rutas: `backend/personal_training/views.py · PersonalTrainingGuardMixin`;
  `backend/personal_training/urls.py · router.register`.

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
- **Regla de precio**: en modalidad **mensual** el precio mensual debe ser
  **mayor a 0**; en modalidad **por sesiones** el backend fuerza
  `monthly_price = 0`, para que el socio no pague el paquete *y* una cuota mensual.
- Al crear una oferta sin elegir servicio, se le asigna el servicio agrupador por
  defecto **"Entrenamiento personal"** (slug `personal_training`) del gimnasio.
- **Baja lógica**: `DELETE` en la API pone `active = False`; nunca se borra la fila.
  Si la oferta estaba activa, darla de baja también **da de baja sus asignaciones
  activas** y **corta el cobro de PT** en las suscripciones no vencidas. El detalle
  del flujo queda en §11.
- **Reactivar** una oferta sólo la vuelve a publicar: no reactiva asignaciones ni
  líneas de cobro canceladas.
- Varias asignaciones activas de la **misma oferta mensual** comparten **una sola
  línea de facturación** en la suscripción del socio (no se duplica la cuota). Los
  paquetes por sesiones no crean cuota mensual.

### Referencia
- Modelo y campos: `backend/personal_training/models.py · PersonalTrainingService`,
  `PersonalTrainingService.Meta`; modalidad y género
  `backend/personal_training/models.py · BILLING_MODE_CHOICES`,
  `TRAINER_GENDER_CHOICES`.
- Precio: `backend/core/mixins.py · BillingPriceMixin.apply_billing_price_rules`;
  `backend/personal_training/serializers.py · PersonalTrainingServiceSerializer.validate`,
  `PersonalTrainingServiceSerializer.validate_name`,
  `PersonalTrainingServiceSerializer.create`.
- Servicio por defecto:
  `backend/plans/models.py · Service.get_default_personal_training_service`.
- Baja y reactivación: `backend/personal_training/models.py · PersonalTrainingService.save`;
  `backend/personal_training/views.py · PersonalTrainingServiceViewSet.destroy`,
  `PersonalTrainingServiceViewSet.reactivate`;
  `backend/personal_training/assignment_service.py · cut_service_billing`;
  `backend/subscriptions/services.py · cancel_addon_items`.
- Línea mensual única:
  `backend/personal_training/assignment_service.py · _ensure_pt_item`.
- Pantalla: `frontend/src/pages/PersonalTrainingSettings.jsx · ServicesPanel`.

---

## 3. Los trainers

- El **entrenador/a** es un **usuario del sistema** con rol `trainer` del gimnasio
  (no texto libre). El endpoint de trainers lista los `UserProfile` del gimnasio
  con ese rol, con su nombre, email, género, teléfono y WhatsApp.
- **Dónde se carga**: se crea y gestiona desde *Staff*, no desde la pantalla de
  entrenamiento personal. Allí se define el rol `trainer`, el género y el WhatsApp
  que después se usan para filtrar y validar las asignaciones.
- La oferta puede **restringir el género** del trainer. Al asignar (o al rotar el
  trainer de una asignación) se valida compatibilidad.
- El trainer **no carga nada**: ve su agenda en modo lectura y no puede registrar
  sesiones ni cobrar. **Limitación**: esa restricción la pone la pantalla, no el
  backend; la API no distingue owner/admin de trainer. `ProfessorRoute` redirige al
  trainer a `/trainer-agenda`.

### Referencia
- Endpoint y serializer: `backend/personal_training/views.py · TrainerViewSet`;
  `backend/personal_training/serializers.py · TrainerSerializer`.
- Carga desde Staff: `frontend/src/pages/Staff.jsx · Staff`.
- Restricción de pantalla: `frontend/src/App.jsx · ProfessorRoute`;
  `frontend/src/pages/TrainerAgenda.jsx · TrainerAgenda`.
- Compatibilidad de género:
  `backend/personal_training/assignment_service.py · _gender_compatible`,
  `AssignmentService.check_assignment_inputs`, `AssignmentService.update_assignment`.

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
- **Reglas estructurales**:
  - La hora de fin debe ser **posterior** a la de inicio.
  - No puede haber dos asignaciones **activas** con el mismo **gimnasio, socio, día
    y hora de inicio** (restricción `unique_active_pt_assignment`). Esa restricción
    no impide por sí sola otros solapes de horario ni incluye al trainer: los
    solapes se validan en el servicio.
  - `duration_minutes` de la oferta **no se valida contra el bloque**: sólo se usa
    para calcular las franjas que se ofrecen al asignar.
- No hay **cupo** ni **lista de espera**: el horario es 1:1 y punto.
- **Edición**: desde la tarjeta de la asignación se puede cambiar **trainer, día y
  horario**. La oferta **no** se cambia desde la pantalla; requeriría desvincular y
  volver a asignar.

### Referencia
- Modelo y restricciones:
  `backend/personal_training/models.py · PersonalTrainingAssignment`,
  `PersonalTrainingAssignment.Meta`.
- Edición:
  `backend/personal_training/assignment_service.py · AssignmentService.update_assignment`.
- Pantalla: `frontend/src/pages/PersonalTrainingSettings.jsx · AssignmentsPanel`,
  `AssignmentCard`, `EditAssignmentModal`.

---

## 5. Quién lo carga y qué se valida

- **Sólo el staff** carga entrenamiento personal. No hay autoasignación ni carga en
  el alta/onboarding: el socio **no** se puede asignar solo un entrenamiento.
  - **Owner / administrador**: desde *Entrenamiento personal → Asignaciones →
    "Asignar socio"*, en **dos pasos** (elegir el socio, luego los detalles:
    oferta, trainer, día y horario).
  - **Trainer**: sólo consulta su agenda.
  - **Socio**: desde su portal puede **pedir un cambio de horario** (ver §8), pero
    no darse de alta.
- **Decisión de negocio**: el PT es **a domicilio**, por eso la dirección del socio
  es obligatoria. El trainer es un **usuario del sistema** y no un texto libre; no
  hay autoasignación.
- Al **crear** una asignación, el sistema valida en este orden:
  1. El gimnasio tiene la **feature** habilitada.
  2. La **oferta** y su **servicio subyacente** pertenecen al gimnasio.
  3. El **trainer** pertenece al gimnasio y el usuario tiene **rol trainer**.
  4. El **género** del trainer es compatible con la oferta.
  5. El **socio es elegible** para operar (no está bloqueado por falta de pago).
  6. El socio tiene **dirección cargada**.
  7. **No hay solapamiento** con: el horario fijo de gimnasio del socio, sus
     **actividades**, sus **salidas**, sus **otros PT**, ni los **otros PT del
     trainer** (un trainer no puede estar en dos lugares a la vez).
- Al **editar** una asignación (incluida la aprobación de un cambio de horario,
  ver §8) se usa `update_assignment`, que revalida **género** y **solape** para el
  nuevo día/horario/trainer. **No** vuelve a chequear elegibilidad ni dirección.
- **Limitación**: las **franjas libres** se calculan desde las ventanas de apertura
  del gimnasio menos el horario de gimnasio, actividades y PT del socio, y PT del
  trainer; **no descuentan salidas**. Por eso una franja puede mostrarse como libre
  y luego ser rechazada con `CONFLICT_OUTING`. La disponibilidad tampoco valida
  elegibilidad ni dirección: eso se controla al confirmar el alta.
- **Limitación**: la pantalla de asignación sólo ofrece socios con **suscripción
  activa** y **sin otra asignación PT activa**. El backend no impone esa unicidad
  por socio: permite varias asignaciones activas si cambian día y hora. La pantalla
  es más restrictiva que la API.

### Referencia
- Alta: `backend/personal_training/assignment_service.py · AssignmentService.assign_member`,
  `AssignmentService.check_assignment_inputs`, `_gender_compatible`;
  `backend/personal_training/serializers.py · PersonalTrainingAssignmentSerializer.create`,
  `PersonalTrainingAssignmentSerializer.validate`.
- Edición y baja:
  `backend/personal_training/assignment_service.py · AssignmentService.update_assignment`,
  `AssignmentService.unassign_member`;
  `PersonalTrainingAssignmentSerializer.update`.
- Solapes: `backend/personal_training/overlap.py · validate_assignment`,
  `_check_trainer_pt_overlap`; `backend/core/overlap.py · check_member_slot`,
  `_check_outing`, `SlotConflict`, `CONFLICT_OUTING`.
- Franjas: `backend/personal_training/availability.py · available_slots`,
  `free_intervals`;
  `backend/personal_training/views.py · PersonalTrainingAssignmentViewSet.available_slots`;
  `frontend/src/utils/ptAvailability.js · reconcileSlot`.
- Pantalla: `frontend/src/pages/PersonalTrainingSettings.jsx · AssignModal`,
  `AssignmentsPanel`, `AssignmentCard`, `EditAssignmentModal`.
- Alta/onboarding sin PT: `backend/members/services.py · RegistrationService.register`.

---

## 6. Cómo se paga

Hay **dos modalidades** de asignación, y cada una se cobra distinto. La modalidad
se guarda en la asignación (`monthly` o `package`); la pantalla la deriva del
**modo de facturación de la oferta** (`billing_mode`): una oferta mensual genera
asignaciones mensuales y una oferta "por sesiones" genera paquetes. El backend
exige que la oferta esté en modo **"por sesiones"** para crear un paquete.

**Limitación técnica:** como la pantalla deriva la modalidad del modo de
facturación, no ofrece combinaciones raras; pero por API todavía se puede crear
una asignación **mensual** sobre una oferta configurada **por sesiones**. No es
un flujo que use la UI.

### Mensual
- Al asignar, el sistema busca la **suscripción vigente** del socio y crea (o
  reutiliza) una **línea de facturación** de tipo `personal_training`.
- Varias asignaciones mensuales de la **misma oferta** comparten una sola línea
  activa: no se cobra dos veces la misma oferta.
- El precio sale de la **cuota mensual** de la oferta y queda guardado como
  **precio del período** (`price_snapshot`). Si la suscripción nació
  **prorrateada**, la línea también se prorratea.
- El precio queda **fijo para el período ya emitido**: cambiar la cuota mensual
  de la oferta no repricea ese período. Al copiarse al período siguiente se toma
  el precio **vigente** de la oferta en ese momento.
- Para socios de **cortesía** (`is_comp`), la línea se crea en **$0**.
- Si la línea **ya existía**, el precio se **actualiza** al de la asignación
  nueva: asignar un socio de cortesía a una oferta que ya tiene línea puede
  dejarla en **$0** para todos los que la comparten.
- La línea se **copia al período siguiente** junto con la suscripción, siempre que
  la oferta siga activa y la feature de PT esté habilitada. Las ofertas en modo
  paquete **no** se copian: los paquetes no generan cuota mensual.
- Al desvincular la **última** asignación activa de una oferta, la línea se
  cancela en las suscripciones no vencidas. Desactivar la oferta corta el cobro de
  todas sus asignaciones.
- **Limitación:** si el socio no tiene suscripción vigente, la asignación se crea
  igual pero **sin línea de facturación**, así que no se cobra nada por mes.

### Paquete de sesiones
- El staff define el **total de sesiones**, el **precio por sesión** (obligatorio,
  puede ser 0) y, opcionalmente, un **sellado**.
- El total del paquete es **precio por sesión × total de sesiones**.
- El sistema **no cobra el paquete por adelantado**: se registran **pagos
  parciales** con concepto `personal_training`. **Los pagos son la fuente de
  verdad** del monto pagado (`amount_paid`), y el saldo pendiente es el total menos
  lo pagado (nunca negativo).
- **No se puede cobrar más** que el saldo pendiente. La validación existe en dos
  capas: el servicio de la asignación y el serializador de pagos.
- A los socios de **cortesía** no se les cobra: el precio por sesión queda en 0 y
  no se les pide sellado.
- El paquete **no genera cuota mensual** ni se renueva solo.

### Sellado
- Sólo se configura en **paquetes**; en una asignación mensual el backend lo
  descarta.
- Se cobra **aparte**, con concepto `sellado`, por el **monto exacto** configurado.
- Es **único por asignación**: se cobra una vez y **no se repite al renovar** el
  paquete (DIN-18). Sigue pagado aunque el paquete se agote o se reactive.
- El estado `sellado_paid` se **recalcula desde los pagos**: si existe el pago de
  sellado, queda pagado; si se borra, vuelve a pendiente.
- A los socios de **cortesía** no se les cobra.

### Deuda
- La deuda por **paquetes de PT** y por **sellados** se suma a la deuda del socio
  y a la del gimnasio.
- **Paquetes:** sólo cuentan los que tienen saldo **mayor a cero**, asignación
  **activa** y socio **no de cortesía**.
- **Sellados:** sólo cuentan las asignaciones **activas** con sellado configurado
  y **no cobrado**, de socios **no eliminados** y **no de cortesía**.
- El **agregado** del socio combina suscripciones, paquetes (actividades, PT y
  salidas) y sellados. El listado de deudores del gimnasio también incluye PT y
  sellado.
- Se ve en la pantalla de **Pagos** (el formulario lista los paquetes y sellados
  pendientes), en **Recuperar socios** y en el **resumen del dashboard**. El portal
  público de PT no muestra saldos.

### Dónde se cobra
- La pantalla de **Pagos** cobra PT y sellado con el formulario genérico (grupos
  "PT" y "Sellado").
- **Recuperar socios** cobra los paquetes de PT llamando directamente al endpoint
  `record_payment` de la asignación.
- El endpoint existe y **está en uso**. No hay cobro automático al renovar ni al
  agotarse el paquete: el cobro siempre lo registra el staff.

### Problemas y decisiones de negocio
- **Decisión:** la modalidad mensual se factura por suscripción; el paquete se
  cobra por sesiones.
- **Decisión:** el precio por sesión es obligatorio y puede ser 0 (obra social o
  sin cargo).
- **Decisión:** el sellado es único por asignación y no se repite al renovar.
- **Decisión:** un socio de cortesía nunca paga sesiones ni sellado.
- **Limitación:** una línea mensual compartida puede pasar a $0 si después se
  asigna un socio de cortesía a la misma oferta en esa suscripción.
- **Limitación:** sin suscripción vigente no se genera línea ni cobro mensual.
- **Limitación:** la pantalla puede precargar un sellado al asignar en modalidad
  mensual, pero el backend lo ignora.
- **Inconsistencia documentada:** `backend/payments/views.py · PaymentViewSet.perform_destroy`
  y `backend/subscriptions/services.py · member_sellado_debt` todavía documentan
  que la renovación "resetea" el sellado; el comportamiento actual es el
  contrario.

### Referencia
- Línea mensual y alta: `backend/personal_training/assignment_service.py · AssignmentService.assign_member`,
  `_ensure_pt_item`; tipo de ítem `backend/subscriptions/models.py · SubscriptionItem`.
- Precio del período: `backend/subscriptions/services.py · prorated_price_for`.
- Paquete: `backend/personal_training/models.py · PersonalTrainingAssignment`,
  `PersonalTrainingAssignment.total_amount`, `PersonalTrainingAssignment.remaining_amount`,
  `PersonalTrainingAssignment.exhausted`.
- Cobro del paquete: `backend/personal_training/assignment_service.py · AssignmentService.record_package_payment`;
  sincronización `backend/payments/services.py · assignment_sessions_paid`,
  `sync_assignment_paid`.
- Sellado: `backend/payments/serializers.py · PaymentSerializer._validate_sellado`;
  `backend/payments/serializers.py · PaymentSerializer._validate_package_amount`;
  `backend/payments/services.py · sellado_paid_exists`,
  `set_sellado_paid`.
- Deuda: `backend/subscriptions/services.py · member_personal_training_package_debt`,
  `gym_personal_training_package_debt`, `_pt_package_debt_entries`,
  `member_sellado_debt`, `gym_sellado_debt`, `member_total_outstanding_debt`,
  `gym_debtor_member_ids`; resumen `backend/config/api/dashboard.py · DashboardSummaryView`.
- Dónde se cobra: `frontend/src/components/payments/PaymentForm.jsx · pendingItems`;
  `frontend/src/services/personalTraining.service.js · recordPersonalTrainingPayment`;
  `frontend/src/pages/RecoverMembers.jsx`.
- Continuidad entre períodos: `backend/subscriptions/services.py · _monthly_pt_service_ids`,
  `_copy_personal_training_items`.
- Baja de líneas: `backend/personal_training/assignment_service.py · _cancel_pt_items`,
  `cut_service_billing`.
- Pantalla de PT: `frontend/src/pages/PersonalTrainingSettings.jsx · AssignmentCard`,
  `AssignModal`.

---

## 7. Cómo se usa (sesiones, faltas y renovación)

### Qué asignaciones tienen sesiones
- Sólo las de modalidad **paquete**. Una asignación mensual no registra sesiones
  ni tiene progreso.

### Registro de sesiones
- El staff registra una sesión desde la asignación, indicando la **fecha** (por
  defecto, hoy).
- Orígenes posibles:

  | Origen | Cuándo pasa |
  |--------|-------------|
  | **Manual** (`manual`) | El staff la registra a mano desde la asignación |
  | **No asistió** (`no_show`) | La crea la tarea de faltas |
  | **Automática** (`auto`) | Reservado para automatismos; hoy no hay carga visible que lo use |

- El registro es **idempotente por (asignación, fecha)**: repetir el mismo día no
  duplica ni cobra dos veces; responde **409**.
- Se rechaza si la asignación no es paquete, está inactiva o el paquete ya se
  agotó.
- **Limitación:** no se valida que la fecha elegida corresponda al día del horario
  ni al período de la asignación: se acepta cualquier fecha.

### Quitar sesiones
- El staff puede **borrar** el registro de una fecha para corregir.
- Sólo aplica a paquetes; si no hay registro en esa fecha, responde **404**.
- No toca pagos, deuda ni sellado. Puede borrar registros `manual`, `auto` o
  `no_show` (no distingue el origen).

### Renovación
- Sólo aplica a **paquetes**.
- **Suma** las sesiones indicadas al total y **reactiva** la asignación.
- Para cortesía deja el precio por sesión en 0.
- **No cobra**: no crea pagos. El cobro se registra después desde Pagos.
- **No resetea el sellado**: se cobra una sola vez por asignación (DIN-18).
- Si el socio tiene **sesiones sin cobrar**, la renovación se **bloquea por
  defecto**. El staff puede forzarla de forma explícita (`allow_unpaid`); la
  pantalla pregunta y confirma antes de hacerlo.
- Al renovar, el total del paquete crece, así que las sesiones agregadas pueden
  generar **nuevo saldo pendiente**.
- Las sesiones ya usadas y sus registros se conservan.
- **Limitación:** no hay tope máximo de sesiones por renovación.

### Faltas y no asistencia
- Una **tarea programada** (no un job diario fijo) corre con la cadencia
  configurada: primero renueva suscripciones automáticas y después descuenta las
  faltas.
- Para PT sólo procesa asignaciones de **paquete activas**, con oferta activa y
  socio no eliminado.
- Recorre las fechas esperadas **desde el alta de la asignación** (o desde el
  marcador `no_show_scan_until`) **hasta ayer**, salteando los días en que el
  gimnasio estuvo cerrado. El día de hoy no se descuenta: el barrido llega hasta
  ayer.
- Por cada fecha esperada sin registro de sesión crea un registro `no_show`: así
  el paquete **se agota también por inasistencia**.
- **Cap:** nunca deja sesiones restantes negativas; si el paquete se agota, deja de
  descontar.
- El **marcador** `no_show_scan_until` evita contar dos veces la misma fecha.
  Avanza sólo cuando no quedan faltas pendientes; si el paquete se agotó o el tope
  truncó faltas, no avanza más allá de la última falta cobrada.

### Recuperaciones de PT
- PT usa el mismo motor de recuperaciones que las actividades, con tipo `pt` y
  referencia a la asignación.
- Una recuperación **programada** cubre la **falta más reciente**: así "falta +
  recuperación" cuesta una sola sesión.
- Al otorgar la recuperación se **borra** la falta más reciente que perdona; las
  faltas ya perdonadas no se vuelven a descontar.
- El descuento automático **respeta las recuperaciones en vuelo**: no descuenta las
  últimas faltas que ya tienen una recuperación programada.
- La recuperación se consume recién cuando el socio asiste el día programado; si
  no la usa, vence.
- La pantalla de **Asistencia PT** es de consulta (métricas y chips); el registro
  real está en la configuración de PT.

### Problemas y decisiones de negocio
- **Decisión:** sólo los paquetes descuentan faltas; las asignaciones mensuales
  (y las salidas) no lo hacen.
- **Decisión:** PT comparte el motor de faltas y recuperaciones con actividades.
- **Decisión:** renovar no cobra ni resetea el sellado.
- **Decisión:** una deuda pendiente bloquea la renovación salvo confirmación
  explícita del staff.
- **Limitación:** registrar una sesión acepta cualquier fecha.
- **Limitación:** quitar una sesión no distingue su origen.
- **Limitación:** la renovación no tiene tope máximo.

### Referencia
- Modelos: `backend/personal_training/models.py · PersonalTrainingAssignment`,
  `PersonalTrainingSessionRecord`, `PersonalTrainingAssignment.used_sessions`,
  `PersonalTrainingAssignment.exhausted`.
- Servicio de sesiones: `backend/personal_training/session_service.py · SessionService.record_session`,
  `SessionService.remove_session`, `SessionService.renew_package`.
- Acciones del staff: `backend/personal_training/views.py · PersonalTrainingAssignmentViewSet.record_session`,
  `PersonalTrainingAssignmentViewSet.remove_session`,
  `PersonalTrainingAssignmentViewSet.renew`.
- Faltas: `backend/activities/no_show_service.py · deduct_missed_sessions`,
  `deduct_missed_pt_assignments`, `_deduct_pt_assignment`,
  `_pending_pt_recovery_credits`, `_bind_pending_pt_recoveries`,
  `cancel_recovered_no_show_pt`.
- Disparo: `backend/subscriptions/services.py · run_scheduled_tasks`;
  `backend/config/api/tasks.py · scheduled_tasks_endpoint`.
- Pantallas: `frontend/src/pages/PersonalTrainingSettings.jsx · AssignmentCard`;
  `frontend/src/pages/PersonalTrainingAttendance.jsx · AttendanceChips`.

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
