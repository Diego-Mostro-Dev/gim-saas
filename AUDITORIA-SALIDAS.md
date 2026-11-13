# Auditoría de Salidas (Running grupal) — Cómo funciona hoy el sistema

> Verificado contra: `f5b4b07`
> Fecha: 2026-11-06
> Alcance: definición, horarios, inscripción, solicitudes, cobro, sesiones,
> ciclo de vida y problemas conocidos de las salidas.
> Documentos relacionados: `AUDITORIA-ACTIVIDADES.md`,
> `AUDITORIA-PERSONAL-TRAINING.md`, `AUDITORIA-ASISTENCIAS.md`,
> `AUDITORIA-HORARIOS.md`, `AUDITORIA-NUCLEO-REGLAS.md`,
> `AUDITORIA-PAGOS.md`, `AUDITORIA-SUSCRIPCIONES.md`,
> `AUDITORIA-RECUPERACION.md`
> Código cubierto: `backend/outings`, `backend/attendance/checkin_discount.py`,
> `backend/attendance/public_views.py`, `backend/attendance/serializers.py`,
> `backend/core/overlap.py`, `backend/core/mixins.py`,
> `backend/plans/models.py`, `backend/gyms/features.py`,
> `backend/members/eligibility.py`, `backend/payments/services.py`,
> `backend/subscriptions/services.py`, `backend/subscriptions/domain.py`,
> `frontend/src/pages/Outings.jsx`,
> `frontend/src/pages/OutingSchedules.jsx`,
> `frontend/src/pages/OutingEnrollments.jsx`,
> `frontend/src/pages/member/MemberOutings.jsx`,
> `frontend/src/components/outings`
> Tests: `backend/outings/tests.py`,
> `backend/outings/tests_deactivation.py`,
> `backend/outings/tests_phase_k2.py`
> Estado: verificado

> Documento descriptivo: **lo que el sistema hace hoy**, verificado contra el código.
> Está pensado para servir de base a un manual para gimnasios, por eso está escrito
> en lenguaje simple. Las referencias de código van aparte, en letra chica, para
> no ensuciar el texto.

---

## 1. Qué es una salida y cómo se paga

- Una **salida** ("Running grupal") es una actividad al aire libre que el gimnasio
  organiza: una corrida grupal en un punto de encuentro. Cada salida pertenece a
  **un gimnasio** (a través de un **servicio**, por defecto el servicio "Running
  grupal") y agrupa sus propios **horarios** e **inscripciones**.
- Los campos que importan:
  - **Nombre**: único dentro del gimnasio (no puede repetirse entre salidas).
  - **Entrenador/a**: a diferencia de las actividades, acá es un **usuario del
    sistema**. El modelo acepta cualquier usuario; la API de staff limita las
    opciones a usuarios con rol trainer del mismo gimnasio.
  - **Precio mensual**: cuánto cuesta la salida por mes cuando se cobra como
    cuota. Al inscribir a un socio se crea una **línea de facturación**
    (`SubscriptionItem`) dentro de su suscripción, con el precio congelado.
  - **Modalidad de cobro** (`billing_mode`): **Mensual** o **Por sesiones**.
    - **Mensual**: se factura una cuota fija por mes, como cualquier plan.
    - **Por sesiones**: la salida no se cobra por cuota mensual. El staff puede
      inscribir a cada socio en **Mensual** o en un **paquete de N sesiones** con
      un precio por sesión (ver §5).
  - **Punto de encuentro**: dónde arranca la salida (texto libre).
  - **Recorrido y distancia**: el staff puede dibujar el recorrido en el mapa
    (`route_polyline`); la **distancia en km se calcula sola** (fórmula haversine)
    y no se edita a mano.
  - **Duración**: cuántos minutos dura la salida (por defecto 60). Es un dato
    informativo: el bloque horario real se define con hora de inicio y fin (ver §2).
  - **Activo**: el interruptor de publicación. Su ciclo de vida se detalla en §7.
- **Regla de precio al guardar**:
  - En modo **Mensual** el precio mensual es obligatorio y debe ser **mayor a 0**.
  - En modo **Por sesiones** el precio mensual se **fuerza a 0**, aunque el
    formulario permita escribir otro valor.
  - La modalidad **Mensual** dentro de una salida por sesiones crea o reutiliza
    una línea de salida en **$0**: no cobra cuota. El cobro real, si existe, es
    el paquete.
- **Importante**: un precio mensual `0` no significa "incluida en la
  membresía". En modo Mensual el backend lo rechaza; para no cobrar hay que usar
  el **pase de cortesía** del socio. El formulario muestra la ayuda "0 = incluida
  en la membresía", pero esa ayuda no coincide con la validación actual.
- Una salida sólo existe si el gimnasio tiene habilitada la **feature "Running
  grupal"** (`salidas`). Si no, ni el staff ni el portal la ven y la API responde
  "feature deshabilitada". El flag por defecto es `False`.

### Referencia
- Modelo: `backend/outings/models.py · Outing`; nombre único
  `backend/outings/models.py · Outing.Meta`; entrenador
  `backend/outings/models.py · Outing.trainer`; recorrido y distancia
  `backend/outings/models.py · Outing.compute_route_distance_km`.
- Servicio por defecto: `backend/plans/models.py · Service.get_default_outings_service`
  (slug `running_grupal`); asignación al crear
  `backend/outings/serializers.py · OutingSerializer.create`.
- Feature: `backend/gyms/features.py · FEATURE_OUTINGS`,
  `backend/gyms/features.py · outings_enabled` y
  `backend/gyms/features.py · require_outings`.
- Reglas de precio: `backend/core/mixins.py · BillingPriceMixin.apply_billing_price_rules`;
  aplicación en `backend/outings/serializers.py · OutingSerializer.validate`.
- Trainer limitado por rol y gimnasio:
  `backend/outings/serializers.py · OutingSerializer.get_fields` y
  `backend/outings/views.py · OutingViewSet.trainers`.
- UI: `frontend/src/components/outings/OutingForm.jsx · OutingForm` y
  `frontend/src/components/outings/OutingPanel.jsx · OutingPanel`.

---

## 2. Los horarios de la salida

- Cada salida tiene **uno o más horarios** (`OutingSchedule`): **día**, **hora de
  inicio**, **hora de fin** y **capacidad** (cupo de socios).
- Reglas de carga:
  - La hora de fin debe ser **posterior** a la de inicio.
  - No puede haber **dos horarios activos que se superpongan** dentro de la
    **misma salida**, el mismo día.
  - No se puede repetir la misma combinación salida + día + hora de inicio.
- La validación de superposición interna compara sólo horarios **activos** de la
  misma salida y excluye el horario que se está editando.
- El listado del staff muestra por defecto **sólo los horarios activos**; se
  pueden pedir los inactivos con `?active=false`.
- Un horario **no se borra**: se **desactiva** (baja lógica). Un horario apagado
  a mano no vuelve automáticamente al reactivar la salida. No se puede
  desactivar el **único horario activo** de una salida activa.
- **Agenda del socio**: al **inscribir** o **solicitar inscripción**, el sistema
  sí valida que el horario de la salida no choque con:
  - el horario fijo del gimnasio del socio,
  - otra actividad inscripta,
  - otra salida inscripta,
  - un entrenamiento personal asignado.
- Esa validación de agenda ocurre en la **inscripción o solicitud**, no al crear
  o editar el horario. Crear un horario no conoce todavía qué socios se anotarán.
- La **duración** de la salida es informativa. El bloque que ocupa en la agenda
  se calcula con `start_time` y `end_time` del horario.

### Referencia
- Modelo: `backend/outings/models.py · OutingSchedule`; unicidad
  salida+día+inicio `backend/outings/models.py · OutingSchedule.Meta`;
  `end > start` en el mismo `OutingSchedule.Meta`.
- Validación de fin posterior y superposición interna:
  `backend/outings/serializers.py · OutingScheduleSerializer.validate` y
  `backend/outings/serializers.py · OutingScheduleSerializer._validate_no_overlap`.
- Filtro de activos y baja lógica:
  `backend/outings/views.py · OutingScheduleViewSet.get_queryset` y
  `backend/outings/views.py · OutingScheduleViewSet.destroy`.
- Agenda del socio: `backend/outings/overlap.py · validate_enrollment` y
  `backend/core/overlap.py · check_member_slot`; llamada desde
  `backend/outings/enrollment_service.py · OutingEnrollmentService.enroll_member`
  y `backend/outings/enrollment_request_service.py · OutingEnrollmentRequestService.create_enroll_request`.
- UI: `frontend/src/pages/OutingSchedules.jsx · OutingSchedules` y
  `frontend/src/components/outings/OutingScheduleForm.jsx · OutingScheduleForm`.

---

## 3. Cómo se inscribe un socio

Hay **dos caminos** para inscribir a un socio a un horario de salida. A diferencia
de las actividades, **el alta/onboarding no inscribe salidas**:

| Camino | Quién lo hace | Detalle |
|--------|---------------|---------|
| **Solicitud del socio** | El propio socio, con su token, y el staff la aprueba | Sólo salidas **mensuales**. El staff aprueba o rechaza (ver §4) |
| **Staff** | El personal, desde la pantalla de inscripciones del horario | Es el **único** camino para las salidas "por sesiones"; puede elegir mensual o paquete |

### Inscripción por staff

- La API exige la feature **Running grupal** y que la salida y el horario estén
  **activos**.
- El socio debe pertenecer al gimnasio, poder operar (no estar bloqueado por
  falta de pago) y no estar ya inscripto en ese horario (responde 409).
- Se valida la **agenda del socio** contra gimnasio, actividades, otras salidas
  y entrenamiento personal.
- Se toma un bloqueo (`select_for_update`) sobre el horario y se cuenta la
  capacidad. Dos inscripciones simultáneas no deberían superar el cupo.
- En modalidad **Mensual** se crea o reutiliza la línea de facturación de la
  salida en la suscripción vigente.
- En modalidad **Paquete** la salida debe ser "Por sesiones". Se exige un total
  de sesiones mayor a 0 y un precio por sesión; para socios de cortesía el
  precio se fuerza a 0.

### Solicitud desde el portal

- El socio sólo puede solicitar inscripción a salidas **mensuales**; una salida
  "Por sesiones" responde "Esta salida requiere inscripción por el staff" (403).
- Se valida que el socio pueda operar, que haya cupo, que no esté ya inscripto y
  que no tenga choque de agenda.
- La creación de la solicitud **no toma lock del horario ni reserva cupo**. La
  aprobación vuelve a validar y puede fallar si el horario se llenó mientras
  tanto.
- Sólo puede haber **una solicitud de inscripción pendiente** por socio.
- Puede coexistir con una solicitud de **baja** pendiente: la unicidad es por
  socio + tipo, no global.

### Bajas y reinscripciones

- El staff puede dar de baja directamente, sin chequeo de elegibilidad de pago.
- El portal exige elegibilidad para **solicitar** la baja; el staff la ejecuta
  después (ver §4).
- La baja marca la inscripción como inactiva y corta la facturación de la salida.
- **ADD-28**: la línea de facturación es **por salida**, no por horario. Si el
  socio sigue inscripto en otro horario activo de la misma salida, la línea **no**
  se cancela. Se cancela al dar de baja el último horario activo.
- Una **reinscripción** crea una nueva fila de inscripción. Si la línea anterior
  había sido cancelada, se crea una nueva con el precio actual; si sigue activa,
  se reutiliza.
- **Limitación:** el guard de ADD-28 mira cualquier inscripción activa de la
  salida, sin distinguir modalidad. Si un socio mezcla una inscripción mensual y
  una de paquete en la misma salida, dar de baja la mensual no cancela la línea
  mientras siga activa la de paquete. Se documenta el comportamiento, no se
  corrige en esta fase.

### Referencia
- Staff: `backend/outings/views.py · ScheduleOutingEnrollmentViewSet.enroll`;
  servicio central
  `backend/outings/enrollment_service.py · OutingEnrollmentService.enroll_member`.
- Elegibilidad: `backend/members/eligibility.py · MemberEligibility.can_operate`.
- Lock y cupo:
  `backend/outings/enrollment_service.py · OutingEnrollmentService.enroll_member`;
  duplicado en el mismo método.
- Solicitud del portal:
  `backend/outings/public_views.py · PublicOutingEnrollmentRequestView.post` y
  `backend/outings/enrollment_request_service.py · OutingEnrollmentRequestService.create_enroll_request`.
- Baja directa:
  `backend/outings/enrollment_service.py · OutingEnrollmentService.unenroll_member`.
- ADD-28: `backend/outings/enrollment_service.py · _cancel_outing_items`.
- Línea mensual: `backend/outings/enrollment_service.py · _ensure_outing_item`.
- Alta/onboarding **sí** inscribe actividades y PT, pero **no** salidas:
  `backend/members/services.py · RegistrationService.register`.
- UI: `frontend/src/components/outings/EnrollOutingMemberModal.jsx · EnrollOutingMemberModal`
  y `frontend/src/pages/OutingEnrollments.jsx · OutingEnrollments`.

---

## 4. El flujo de solicitudes del socio

La inscripción del socio desde el portal no es inmediata: es una **solicitud**
que el staff revisa.

No confundir con las solicitudes de los otros add-ons: en entrenamiento
personal el socio pide un **cambio de horario** de una asignación existente
(`AUDITORIA-PERSONAL-TRAINING.md` §8) y en actividades no hay solicitudes: la
autoinscripción mensual y la baja del portal son inmediatas
(`AUDITORIA-ACTIVIDADES.md` §3).

- El socio **crea** una solicitud desde su portal, de dos tipos:
  - **Inscripción** (`enroll`): a un horario mensual con cupo.
  - **Baja** (`unenroll`): de una inscripción activa propia.
- La solicitud nace **pendiente** y puede terminar en:
  - **aprobada** (`approved`): el staff la ejecuta (crea o cancela la inscripción),
  - **rechazada** (`rejected`): el staff la descarta,
  - **cancelada por el socio** (`cancelled_by_member`),
  - **cancelada por el staff** (`cancelled_by_staff`).
- Sólo puede haber **una solicitud pendiente por tipo y socio**: no se puede
  tener dos inscripciones pendientes ni dos bajas pendientes a la vez. Sí puede
  convivir una solicitud de inscripción con una de baja.
- **Solicitud de inscripción**:
  - Sólo aplica a salidas mensuales.
  - Exige que el socio pueda operar y que haya cupo en ese momento.
  - Valida que el socio no esté ya inscripto y que no choque con su agenda.
  - **No reserva cupo** ni toma lock: entre la solicitud y la aprobación el
    horario puede llenarse.
- **Solicitud de baja**:
  - Exige elegibilidad de pago y que el socio tenga una inscripción activa en ese
    horario.
  - El staff la ejecuta después aprobándola.
- **Aprobación de inscripción**:
  - El staff revisa la solicitud y la aprueba.
  - Se revalidan cupo, duplicado y agenda; se crea la inscripción y, si
    corresponde, el cobro mensual.
  - Se **saltea** la elegibilidad de pago porque se supone que el staff ya la
    evaluó.
  - Si la salida o el horario se desactivaron mientras tanto, responde "La salida
    ya no está activa" (410).
  - Si falla la revalidación, la solicitud queda **pendiente**.
- **Aprobación de baja**:
  - Cancela la inscripción y su facturación.
  - **Limitación:** la aprobación busca el horario desde `request.schedule`, no
    desde la inscripción vinculada (`request.enrollment`). Si el socio se dio de
    baja y se reinscribió, una solicitud vieja podría apuntar al horario y no a la
    inscripción original. Se documenta como riesgo actual, no se corrige acá.
- **Rechazo**: guarda revisor, fecha y notas opcionales; no ejecuta nada.
- **Cancelación por el socio**: sólo aplica mientras la solicitud sigue pendiente.
- **Pantalla del portal**:
  - Lista los horarios activos de salidas activas, con cupo, y los horarios donde
    el socio ya está inscripto.
  - También lista los horarios con solicitud pendiente, para que no vuelva a
    pedirlos.
  - `available_outings` excluye salidas "Por sesiones", horarios ya inscriptos,
    horarios con solicitud pendiente y horarios llenos.
  - **Limitación:** el cálculo visual de cupos disponibles no filtra socios
    eliminados, aunque los controles de capacidad sí los excluyen.

### Referencia
- Modelo: `backend/outings/models.py · OutingEnrollmentRequest`; tipos
  `backend/outings/models.py · ENROLLMENT_REQUEST_TYPE_CHOICES`; estados
  `backend/outings/models.py · ENROLLMENT_REQUEST_STATUS_CHOICES`; unicidad
  por tipo `backend/outings/models.py · OutingEnrollmentRequest.Meta`.
- Crear inscripción:
  `backend/outings/enrollment_request_service.py · OutingEnrollmentRequestService.create_enroll_request`.
- Crear baja:
  `backend/outings/enrollment_request_service.py · OutingEnrollmentRequestService.create_unenroll_request`.
- Aprobar:
  `backend/outings/enrollment_request_service.py · OutingEnrollmentRequestService.approve_request`.
- Rechazar y cancelar:
  `backend/outings/enrollment_request_service.py · OutingEnrollmentRequestService.reject_request`
  y `backend/outings/enrollment_request_service.py · OutingEnrollmentRequestService.cancel_request`.
- Staff: `backend/outings/views.py · OutingEnrollmentRequestViewSet` y
  `backend/outings/views.py · OutingEnrollmentActionViewSet`.
- Portal: `backend/outings/public_views.py · PublicMemberOutingsView` y
  `backend/outings/public_views.py · PublicOutingEnrollmentRequestView`.
- Disponibilidad: `backend/outings/public_views.py · _available_outings` y
  `backend/outings/public_views.py · PublicMemberOutingsView.get`.
- UI: `frontend/src/pages/member/MemberOutings.jsx · MemberOutings` y
  `frontend/src/components/outings/OutingEnrollmentRequests.jsx · OutingEnrollmentRequests`.

---

## 5. El cobro de salidas

### Salida mensual

- Al inscribir se crea (o reutiliza) una línea de facturación de tipo `outing` en
  la suscripción vigente del socio.
- El precio se toma del **precio mensual actual** de la salida. Si la suscripción
  nació prorrateada, la línea también se prorratea.
- Si el socio ya tenía la línea activa, **no se actualiza el precio** ante un
  cambio posterior, salvo que sea cortesía.
- El **pase de cortesía** (`is_comp`) fuerza la línea a **$0**.
- Si el socio **no tiene suscripción vigente**, la inscripción se crea pero **no
  se crea la línea de facturación**. El sistema no genera una suscripción nueva
  automáticamente.
- Al renovar la suscripción, las líneas de salida activas se copian al nuevo
  período. La reactivación del cobro mensual se resuelve con las reglas de
  suscripciones.

### Salida por sesiones (paquete)

- Sólo se puede inscribir en paquete si la salida tiene `billing_mode="sessions"`.
- El staff define el **total de sesiones** y el **precio por sesión**
  (`session_price`). El total del paquete es `precio por sesión × sesiones`.
- Para socios de cortesía, el precio por sesión se fuerza a **0**.
- Un paquete con precio por sesión **0** para un socio no cortesía es aceptado:
  queda sin deuda y no permite generar cobros.
- El sistema **no cobra por adelantado** el paquete. Se registran **pagos
  parciales** que descuentan del total.
- Cada cobro crea un `Payment` con concepto `outing`. El monto acumulado
  (`OutingEnrollment.amount_paid`) se sincroniza desde esos pagos: **los pagos
  son la fuente de verdad**.
- No se puede cobrar más que el total pendiente. A los socios de cortesía no se
  les permiten cobros.

### Deuda y baja

- El saldo pendiente de los paquetes de salida activos, no cortesía y con monto
  pendiente se suma a la **deuda del socio** y a la **deuda del gimnasio**.
- La **baja** marca la inscripción como inactiva y cancela las líneas de
  facturación de esa salida en la suscripción vigente y en períodos futuros ya
  generados.
- Los períodos históricos no se tocan.
- **Limitación:** no se valida que el ítem mensual y el paquete correspondan a la
  misma modalidad. El guard de ADD-28 ya descripto en §3 puede dejar una línea
  activa si el socio mantiene otra inscripción de la misma salida.

### Lo que ve el staff en pantalla

- El panel de la salida muestra la modalidad y el precio. Si el precio mensual es
  0, muestra "Gratis"; en una salida "Por sesiones" eso puede ocurrir aunque el
  cobro real sea por paquete.
- El modal de inscripción permite elegir **Mensual** o **Paquete**. La opción de
  paquete sólo corresponde a salidas "Por sesiones".
- La lista de inscriptos distingue **Mensual** de **Paquete**, muestra sesiones
  usadas/total, precio por sesión, total, saldo adeudado y el estado "Sesiones
  agotadas".
- El portal del socio muestra las solicitudes y los horarios disponibles; no
  muestra el detalle interno de facturación.

### Referencia
- Línea de salida:
  `backend/outings/enrollment_service.py · _ensure_outing_item`; prorrateo
  `backend/subscriptions/services.py · prorated_price_for`; tipos de ítem
  `backend/subscriptions/models.py · SubscriptionItem.item_type`.
- Unicidad de línea activa:
  `backend/subscriptions/models.py · SubscriptionItem.Meta` y
  `backend/subscriptions/models.py · unique_active_outing_item_per_subscription`.
- Paquete: `backend/outings/models.py · OutingEnrollment`;
  `backend/outings/models.py · OutingEnrollment.total_amount`,
  `backend/outings/models.py · OutingEnrollment.remaining_amount` y
  `backend/outings/models.py · OutingEnrollment.exhausted`.
- Cobro:
  `backend/outings/enrollment_service.py · OutingEnrollmentService.record_package_payment`;
  endpoint `backend/outings/views.py · OutingEnrollmentActionViewSet.record_payment`;
  sincronización `backend/payments/services.py · outing_sessions_paid` y
  `backend/payments/services.py · sync_outing_paid`.
- Deuda: `backend/subscriptions/services.py · member_outing_package_debt` y
  `backend/subscriptions/services.py · gym_outing_package_debt`.
- Continuidad: `backend/subscriptions/services.py · _copy_outing_items`;
  reactivación mensual `backend/subscriptions/domain.py · SubscriptionDomain`.
- Baja: `backend/outings/enrollment_service.py · OutingEnrollmentService.unenroll_member`
  y `backend/outings/enrollment_service.py · _cancel_outing_items`.
- UI: `frontend/src/components/outings/OutingPanel.jsx · OutingPanel`,
  `frontend/src/components/outings/EnrollOutingMemberModal.jsx · EnrollOutingMemberModal`
  y `frontend/src/pages/OutingEnrollments.jsx · OutingEnrollments`.

---

## 6. Registrar sesiones (y por qué acá NO hay faltas)

Las sesiones sólo existen para inscripciones en **modalidad paquete**
(`modality="package"`) de una salida configurada **por sesiones**. Una inscripción
mensual no consume sesiones: paga su cuota y no tiene contador de asistencias.

Hay **dos orígenes**:

| Origen | Cuándo pasa |
|--------|-------------|
| **Automática** (`auto`) | El socio o el staff registran un check-in; el sistema intenta descontar 1 sesión |
| **Manual** (`manual`) | El staff la registra a mano desde la inscripción |

### Cuándo se descuenta automáticamente

El check-in sólo conoce el día, no la clase o salida a la que fue el socio. La
regla ACC-08 busca las inscripciones de paquete **activas** del socio para ese
día, con horario y salida **activos**, y decide así:

- **Una sola inscripción de paquete ese día**: se descuenta aunque el check-in
  caiga **fuera** de la ventana horaria (se considera que entrenó y se cobra).
- **Varias inscripciones de paquete ese día**: se descuentan sólo las que están
  **dentro de su ventana horaria**.
- **Sin hora de check-in** (carga del staff): sólo se descuenta el caso
  inequívoco de una sola inscripción; con varias no se descuenta ninguna.
- **Sin candidatos**: no se descuenta nada.

La sesión automática **se traga los errores**: si ya estaba registrada, el
paquete está agotado, la inscripción está inactiva o el horario/salida se
desactivó, no se descuenta pero **el check-in igual se registra**. La sesión
manual, en cambio, exige modalidad paquete, inscripción activa y paquete no
agotado; si no, responde error.

### Reglas de registro y corrección

- El registro es **idempotente por (inscripción, fecha, horario)**: repetir la
  misma carga el mismo día no duplica la sesión (responde 409; el automático lo
  ignora).
- El staff puede **quitar una sesión** de una fecha (corrección). Se borran los
  registros de esa inscripción en esa fecha; si no hay ninguno, responde 404.
  Quitar una sesión no devuelve ni ajusta pagos.
- **Limitación:** el registro acepta cualquier fecha, incluso un día en que el
  gimnasio estuvo cerrado: no valida los días cerrados (`GymClosedDate`). La
  tarea de faltas de actividades y PT sí los saltea, pero acá no existe.
- El staff puede **renovar el paquete** agregando N sesiones. La renovación:
  - sólo aplica a paquetes;
  - agrega las sesiones al total y vuelve a dejar la inscripción activa;
  - actualiza el precio por sesión con la obra social vigente del socio, lo deja
    en 0 si es pase de cortesía y conserva el precio anterior si el socio no
    tiene obra social cargada;
  - **no genera ningún cobro**: sólo agrega sesiones; el pago se registra
    después con la acción de cobro del paquete.
- Por defecto, **no se puede renovar si el socio tiene sesiones sin cobrar**
  (`remaining_amount > 0`). El staff puede saltear ese bloqueo a propósito con
  el override explícito `allow_unpaid=true`; la pantalla le advierte y le pide
  confirmación.

### Por qué no hay faltas ni recuperaciones

**A diferencia de las actividades y del entrenamiento personal, acá NO existe
la tarea de no-asistencia**: si el socio falta, **no se le descuenta ninguna
sesión**. Tampoco existen las **recuperaciones** para salidas. El paquete sólo
baja por un check-in que el sistema pudo contar o por una carga manual del
staff. Por eso un socio puede tener el paquete abierto indefinidamente si nunca
asiste. El motor compartido de faltas y recuperaciones recorre actividades y
PT, pero no salidas (ver `AUDITORIA-ACTIVIDADES.md` §5 y
`AUDITORIA-PERSONAL-TRAINING.md` §7).

El staff ve sesiones usadas/total, si el paquete está agotado, la última fecha
registrada y el saldo pendiente. El portal del socio muestra el mismo progreso,
pero **no le permite registrar sesiones por su cuenta**.

### Referencia
- Modelo y reglas del paquete: `backend/outings/models.py · OutingEnrollment`,
  `backend/outings/models.py · OutingEnrollment.used_sessions`,
  `backend/outings/models.py · OutingEnrollment.total_amount`,
  `backend/outings/models.py · OutingEnrollment.remaining_amount`,
  `backend/outings/models.py · OutingEnrollment.exhausted` y
  `backend/outings/models.py · OutingSessionRecord` (origen y unicidad).
- Registro, borrado y renovación:
  `backend/outings/session_service.py · SessionService.record_session`,
  `backend/outings/session_service.py · SessionService.record_auto`,
  `backend/outings/session_service.py · SessionService.remove_session` y
  `backend/outings/session_service.py · SessionService.renew_package`.
- Regla ACC-08: `backend/attendance/checkin_discount.py · _discount_candidates`,
  `backend/attendance/checkin_discount.py · _outing_candidates` y
  `backend/attendance/checkin_discount.py · count_outing_sessions`.
- Disparo desde el check-in del portal:
  `backend/attendance/public_views.py · PublicCheckinView.post` y
  `backend/attendance/public_views.py · PublicScheduleSwapRequestView.post`.
- Disparo desde la asistencia cargada por staff:
  `backend/attendance/serializers.py · AttendanceSerializer.create`
  (sin hora: `now_dt=None`).
- Acciones del staff:
  `backend/outings/views.py · OutingEnrollmentActionViewSet.record_session`,
  `backend/outings/views.py · OutingEnrollmentActionViewSet.remove_session`,
  `backend/outings/views.py · OutingEnrollmentActionViewSet.renew` y
  `backend/outings/views.py · OutingEnrollmentActionViewSet.record_payment`.
- Cobro del paquete:
  `backend/outings/enrollment_service.py · OutingEnrollmentService.record_package_payment`.
- Faltas y recuperaciones no aplican a salidas:
  `backend/activities/no_show_service.py` y
  `backend/attendance/recovery_service.py` no recorren salidas.
- Vistas:
  `backend/outings/serializers.py · OutingEnrollmentSerializer.get_sessions_total`,
  `backend/outings/serializers.py · OutingEnrollmentSerializer.get_exhausted`,
  `backend/outings/serializers.py · OutingEnrollmentSerializer.get_last_session_date`,
  `backend/outings/serializers.py · PublicOutingEnrollmentSerializer.get_sessions_used`,
  `frontend/src/pages/OutingEnrollments.jsx · OutingEnrollments` y
  `frontend/src/pages/member/MemberOutings.jsx · MemberOutings`.
- Flujo visual de desarrollo: `frontend/src/dev/OutingsFlow.jsx · OutingsFlow`.
- Tests de renovación:
  `backend/outings/tests_phase_k2.py · Add14OutingRenewTests.test_renew_with_unpaid_balance_is_rejected_by_default`,
  `backend/outings/tests_phase_k2.py · Add14OutingRenewTests.test_renew_with_allow_unpaid_succeeds`
  y `backend/outings/tests_phase_k2.py · Add14OutingRenewTests.test_api_renew_succeeds_with_the_override`.

---

## 7. Activar, desactivar y reactivar

El campo **Activo** es el interruptor de publicación de la salida. **Eliminar**
en la API es siempre una **baja lógica**: nunca se borra la fila.

### Desactivar

Al pasar una salida de activa a inactiva:

- la salida deja de ofrecerse en el staff y en el portal;
- **se apagan sus horarios activos** y quedan marcados como
  `auto_deactivated=True`;
- **se desactivan las inscripciones activas** de todos sus horarios;
- **se corta la facturación**: se cancelan las líneas de salida activas en las
  suscripciones no vencidas y se resincroniza el saldo de cada suscripción. Si
  el período ya estaba pago, la diferencia queda como saldo a favor.

No se borran los registros históricos de sesiones, pagos ni inscripciones: sólo
se marcan como inactivos. Los horarios que ya estaban apagados **a mano** no se
tocan y conservan `auto_deactivated=False`.

### Reactivar

El endpoint de reactivación vuelve a marcar la salida como activa. Después:

- con `restore_schedules=true` (**por defecto**) vuelven **sólo los horarios
  marcados como `auto_deactivated`**, es decir, los que se apagaron junto con la
  oferta. Los que el staff apagó a mano **siguen apagados**;
- con `restore_schedules=false` no vuelve ningún horario;
- **no se reactivan las inscripciones ni las líneas de facturación**. Los socios
  que estaban anotados quedaron dados de baja al desactivar la salida y el staff
  tiene que volver a inscribirlos.

**Importante**: la acción de reactivar **no valida** que quede al menos un
horario activo. Si no había horarios `auto_deactivated` (por ejemplo, porque
todos se habían apagado a mano) o si se usa `restore_schedules=false`, la API
puede dejar una salida activa **sin horarios**. En cambio, guardar una salida
como activa por la edición normal (`PATCH`/`PUT`) sí exige al menos un horario
activo; la creación por API no aplica esa validación.

### Horarios y caminos visuales

- Un horario **nuevo activo** en una salida inactiva **activa la salida
  automáticamente** después de crearlo. Es el camino "crear horarios nuevos".
- El endpoint de baja de un horario **no permite desactivar el último horario
  activo** de una salida activa (responde 400). Para apagarla entera hay que
  desactivar la salida. Esta protección vive en el endpoint, no en el modelo.
- La pantalla de salidas inactivas ofrece dos caminos:
  - **"Restaurar horarios anteriores"**: llama a reactivar con el valor por
    defecto, restaura los `auto_deactivated` y saca la marca de reactivación
    pendiente;
  - **"Crear nuevos horarios"**: **no reactiva la salida en ese momento**;
    guarda la marca de **reactivación pendiente** en la sesión del navegador y
    navega a la pantalla de horarios. La salida se activa recién cuando se crea
    el primer horario activo. Mientras tanto, la lista de inactivas muestra
    "Reactivación pendiente: falta crear horarios".
- La marca de reactivación pendiente es **sólo de la pantalla** (se guarda en
  `sessionStorage`), no es un estado del backend.
- El portal sólo muestra inscripciones con horario y salida activos.

### Referencia
- Cascada al desactivar y corte de facturación:
  `backend/outings/models.py · Outing.save`.
- Corte masivo de cobro:
  `backend/outings/enrollment_service.py · cut_outing_billing` y
  `backend/subscriptions/services.py · cancel_addon_items`.
- Baja lógica: `backend/outings/views.py · OutingViewSet.destroy`.
- Reactivación selectiva: `backend/outings/views.py · OutingViewSet.reactivate`
  y `backend/outings/models.py · OutingSchedule.auto_deactivated`.
- Auto-activar al crear horario:
  `backend/outings/views.py · OutingScheduleViewSet.perform_create`.
- Último horario activo:
  `backend/outings/views.py · OutingScheduleViewSet.destroy`.
- Activar sin horarios activos por edición:
  `backend/outings/serializers.py · OutingSerializer.update`.
- Portal: `backend/outings/public_views.py · PublicMemberOutingsView.get`.
- UI: `frontend/src/pages/Outings.jsx · Outings` (`handleRestoreSchedules`,
  `handleCreateSchedulesRedirect` y la marca `pendingActivation`),
  `frontend/src/pages/OutingSchedules.jsx · OutingSchedules` (consumo de
  `pendingOutingActivation` al crear el primer horario) y
  `frontend/src/pages/member/MemberOutings.jsx · MemberOutings`.
- Flujo visual de desarrollo: `frontend/src/dev/OutingsFlow.jsx · OutingsFlow`.
- Tests:
  `backend/outings/tests_deactivation.py · OutingDeactivationBillingTests.test_deactivating_cancels_item_enrollment_and_billing`,
  `backend/outings/tests_deactivation.py · OutingPortalOrphanTests.test_enrollment_on_inactive_schedule_is_hidden`,
  `backend/outings/tests_phase_k2.py · Add15SelectiveRestoreTests.test_reactivate_brings_back_the_schedules_deactivated_with_the_offer`,
  `backend/outings/tests_phase_k2.py · Add15SelectiveRestoreTests.test_reactivate_keeps_the_schedules_deactivated_by_hand`
  y `backend/outings/tests_phase_k2.py · Add15SelectiveRestoreTests.test_reactivate_without_restore_schedules_keeps_everything_off`.

---

## 8. Lo que el sistema NO hace hoy (para no prometerlo en el manual)

- **Decisión: no hay lista de espera.** Un horario lleno simplemente rechaza la
  inscripción o la solicitud; no hay cola ni aviso de cupo liberado.
- **Decisión: no inscribe en el alta/onboarding.** A diferencia de las
  actividades, las salidas sólo se cargan por el staff o por una solicitud
  aprobada.
- **Decisión: no autoinscribe salidas "por sesiones".** El socio nunca puede
  tomar un paquete solo; siempre lo carga el staff.
- **Decisión: no descuenta faltas.** No hay tarea de no-asistencia para
  salidas; el paquete no se agota por inasistencia.
- **Decisión: no tiene recuperaciones.** No existe el concepto de recuperar una
  salida faltada.
- **Decisión: no valida choques al crear o editar horarios** contra el
  gimnasio, otras actividades, el entrenamiento personal u otras salidas; sólo
  impide que dos horarios **de la misma salida** se superpongan. En cambio,
  **al inscribir o solicitar** sí revisa la agenda del socio contra el
  gimnasio, las actividades, otras salidas y el entrenamiento personal.
- **Decisión: no cobra el paquete por adelantado.** Sólo registra pagos
  parciales del precio por sesión; no hay pasarela ni link de pago de salidas.
- **Decisión: no versiona precios de salida.** El precio se congela en la línea
  de facturación (`SubscriptionItem`) o en el paquete, no en la salida.
- **Decisión: no actualiza el precio** de los socios ya inscriptos a una salida
  mensual cuando el gimnasio cambia el precio.
- **Decisión: no avisa por email ni WhatsApp** (aunque el portal muestra el
  teléfono y el WhatsApp del entrenador para contactarlo).
- **Limitación: no distingue roles en el backend.** Cualquier usuario
  autenticado del gimnasio puede inscribir por API; la restricción de pantalla
  la pone el frontend.
- **Decisión: no reserva cupo de gimnasio.** Sólo controla el cupo del horario
  de salida.

### Referencia
- Solapes internos al crear/editar un horario:
  `backend/outings/serializers.py · OutingScheduleSerializer._validate_no_overlap`.
- Agenda del socio al inscribir o solicitar:
  `backend/outings/overlap.py · validate_enrollment` y
  `backend/core/overlap.py · check_member_slot`.
- Tests de choques: `backend/outings/tests_phase_k2.py · Add16OutingOverlapTests`
  y `backend/outings/tests_phase_k2.py · Add16OutingRequestTests`.
- Sin faltas ni recuperaciones para salidas:
  `backend/activities/no_show_service.py · deduct_missed_sessions` y
  `backend/attendance/recovery_service.py · eligible_options`.
- Exclusión de "por sesiones" del portal:
  `backend/outings/public_views.py · _available_outings`.

---

## 9. Problemas y decisiones vigentes

Situaciones a tener en cuenta, porque el sistema hoy se comporta así:

1. **Faltar no descuenta sesión.** A diferencia de las actividades, un socio que
   nunca asiste a una salida **no consume el paquete**: no existe tarea de
   no-asistencia. El saldo del paquete queda intacto y el socio puede no agotarlo
   nunca (ADD-11, decisión).
2. **El auto-conteo puede quedar ambiguo.** La regla ACC-08 descuenta una sola
   inscripción de paquete del día aunque el check-in caiga fuera de la ventana.
   Con **varias** inscripciones del mismo día sólo descuenta las que están
   dentro de la ventana; si el check-in no tiene hora, no descuenta ninguna. En
   esos casos la sesión queda pendiente hasta que el staff la cargue a mano.
3. **Mezclar modalidades en la misma salida puede dejar la cuota viva.** La baja
   por oferta no distingue modalidad: si el socio mantiene otra inscripción
   activa de la misma salida (por ejemplo, una de sesiones), el ítem mensual no
   se cancela aunque ya no corresponda cobrarlo.
4. **La baja aprobada se ejecuta contra el horario, no contra la inscripción
   guardada.** Al aprobar una solicitud de baja el sistema vuelve a buscar la
   inscripción activa por (socio, horario). Si el socio se reinscribió en ese
   horario o cambió de horario, la aprobación puede dar de baja la inscripción
   nueva o responder 404.
5. **Los cupos del portal cuentan socios eliminados.** El cálculo de
   `available_spots` suma inscripciones activas sin filtrar `deleted_at`, así
   que puede mostrar menos lugares de los que realmente hay. La validación al
   inscribir sí excluye a los socios eliminados.
6. **Reactivar por API puede dejar la salida activa sin horarios.** La acción de
   reactivación no reutiliza la validación del serializer: con
   `restore_schedules=false`, o si no había horarios auto-desactivados, la
   salida queda activa aunque no tenga ningún horario activo.
7. **Renovar con deuda es posible con confirmación.** El bloqueo por sesiones
   sin cobrar sigue siendo el comportamiento por defecto, pero el staff puede
   forzarlo con `allow_unpaid=true`. La deuda no se cancela y puede crecer si se
   repite el override.
8. **El portal no ofrece salidas por sesiones.** Las salidas `billing_mode="sessions"`
   se excluyen de las disponibles para solicitar; el socio sólo ve el aviso de
   consultar en recepción (ADD-17, decisión).

### Referencia
- Sin tarea de faltas para salidas: `backend/activities/no_show_service.py ·
  deduct_missed_sessions` (sólo actividades y PT;
  `backend/attendance/recovery_service.py · eligible_options` sólo actividades y
  PT).
- Regla ACC-08: `backend/attendance/checkin_discount.py · _discount_candidates`,
  `backend/attendance/checkin_discount.py · count_outing_sessions`,
  `backend/attendance/public_views.py · PublicCheckinView.post` y
  `backend/attendance/serializers.py · AttendanceSerializer.create`.
- Baja por oferta sin distinguir modalidad:
  `backend/outings/enrollment_service.py · _cancel_outing_items`; test
  `backend/outings/tests_phase_k2.py ·
  Add28OutingItemTests.test_unenroll_keeps_the_item_while_another_schedule_is_active`.
- Baja aprobada contra el horario:
  `backend/outings/enrollment_request_service.py ·
  OutingEnrollmentRequestService.approve_request` y
  `backend/outings/enrollment_request_service.py ·
  OutingEnrollmentRequestService.create_unenroll_request`.
- Cupos del portal:
  `backend/outings/public_views.py · _available_outings`.
- Reactivación sin validar horarios activos:
  `backend/outings/views.py · OutingViewSet.reactivate` (compara con
  `backend/outings/serializers.py · OutingSerializer.update`); test
  `backend/outings/tests_phase_k2.py ·
  Add15SelectiveRestoreTests.test_reactivate_without_restore_schedules_keeps_everything_off`.
- Renovación con override:
  `backend/outings/session_service.py · SessionService.renew_package` y
  `frontend/src/pages/OutingEnrollments.jsx · handleRenew`; test
  `backend/outings/tests_phase_k2.py ·
  Add14OutingRenewTests.test_renew_with_allow_unpaid_succeeds`.
- Exclusión de "por sesiones" del portal:
  `backend/outings/public_views.py · _available_outings`.

---

### Notas de entorno para leer el código

- Zona horaria: `America/Argentina/Buenos_Aires`
  (`backend/config/settings.py · TIME_ZONE`).
- Toda operación de staff se filtra automáticamente por el gimnasio del usuario
  logueado (`backend/core/mixins.py · GymQuerysetMixin`); el portal público
  entra por el token del socio.
- Los endpoints de salidas exigen la feature `salidas`
  (`backend/outings/views.py · OutingsGuardMixin` y
  `backend/gyms/features.py · require_outings`).
- Las salidas comparten el motor de paquetes y de pagos con actividades y
  entrenamiento personal (mismo `Payment` con distintos conceptos), pero **no**
  comparten el motor de faltas ni el de recuperaciones.
- La asistencia del gimnasio lista a los socios de salidas como ítems propios
  (IDs negativos en un rango distinto al de las clases), tanto por día como por
  estado: `backend/attendance/views.py · _build_outing_items_by_day` y
  `backend/attendance/views.py · _build_outing_items_for_status`.
- El flujo visual de esta feature vive en `frontend/src/dev/OutingsFlow.jsx`
  (sólo desarrollo) y se alimenta de este documento.
