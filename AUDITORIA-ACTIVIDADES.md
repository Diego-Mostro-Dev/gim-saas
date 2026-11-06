# Auditoría de Actividades — Cómo funciona hoy el sistema

> Verificado contra: `f5b4b07`
> Fecha: 2026-11-05
> Alcance: definición, horarios, inscripción y cobro de actividades; incluye
> la baja desde el portal, el registro de sesiones y faltas, y el ciclo de
> activación/reactivación de la oferta. También cubre los problemas conocidos.
> Documentos relacionados: `AUDITORIA-SALIDAS.md`,
> `AUDITORIA-PERSONAL-TRAINING.md`, `AUDITORIA-ASISTENCIAS.md`,
> `AUDITORIA-HORARIOS.md`, `AUDITORIA-NUCLEO-REGLAS.md`,
> `AUDITORIA-PAGOS.md`, `AUDITORIA-SUSCRIPCIONES.md`,
> `AUDITORIA-RECUPERACION.md`
> Código cubierto: `backend/activities`,
> `backend/attendance/checkin_discount.py`,
> `backend/attendance/recovery_service.py`,
> `backend/core/session_invariants.py`, `backend/core/overlap.py`,
> `frontend/src/pages/Activities.jsx`, `frontend/src/pages/ActivitySchedules.jsx`,
> `frontend/src/pages/ScheduleEnrollments.jsx`,
> `frontend/src/pages/MemberActivities.jsx`,
> `frontend/src/pages/member/ActivityDashboard.jsx`,
> `frontend/src/components/activities`
> Tests: `backend/activities/tests_deactivation.py`,
> `backend/activities/tests_sessions_invariants.py`,
> `backend/activities/tests_phase_g.py`,
> `backend/activities/tests_phase_k2.py`,
> `backend/activities/tests_phase_k3.py`
> Estado: verificado

> Documento descriptivo: **lo que el sistema hace hoy**, verificado contra el código.
> Está pensado para servir de base a un manual para gimnasios, por eso está escrito
> en lenguaje simple. Las referencias de código van aparte, en letra chica, para
> no ensuciar el texto.

---

## 1. Qué es una actividad y cómo se paga

- Una **actividad** es una clase que el gimnasio ofrece (funcional, zumba, rugby,
  etc.). Cada actividad pertenece a **un gimnasio** (a través de un **servicio**,
  por defecto el servicio "Actividades") y agrupa sus propios **horarios** e
  **inscripciones**.
- Los campos que importan:
  - **Nombre**: único dentro del gimnasio. No puede repetirse (ni entre
    actividades de servicios distintos del mismo gimnasio).
  - **Profesor/a**: sólo un nombre de texto libre; no es un usuario del sistema.
  - **Precio mensual**: cuánto cuesta la actividad por mes. En la modalidad
    mensual, al inscribir a un socio se crea (o reutiliza) una **línea de
    facturación** (`SubscriptionItem`) dentro de su suscripción, con el precio
    congelado. En la modalidad por sesiones se fuerza a **$0** y la oferta se
    cobra por paquete.
  - **Modalidad de cobro** (`billing_mode`): **Mensual** o **Por sesiones**.
    - **Mensual**: se factura una cuota fija por mes, como cualquier plan.
    - **Por sesiones**: al inscribir, el staff elige entre **mensual** (sin
      cargo mensual: el precio de la oferta queda en $0 y la actividad se
      considera incluida en la membresía) o **paquete de N sesiones** con un
      coseguro por sesión (ver §4).
  - **Activo**: el interruptor de publicación. Desactivarlo **también apaga
    todos sus horarios** (ver §6).
- Una actividad sólo existe si el gimnasio tiene habilitada la **feature
  "Actividades"** (`activities`). Si no, ni el staff ni el portal la ven y la
  API responde "feature deshabilitada".

### Referencia
- Modelo: `backend/activities/models.py · Activity`; modalidad y precio
  mensual en `backend/activities/models.py · Activity.billing_mode` y
  `backend/activities/models.py · Activity.monthly_price`.
- Creación con servicio del gimnasio y nombre único:
  `backend/activities/services.py · ActivityService.create_activity` y
  `backend/activities/services.py · _validate_name_unique`.
- Servicio por defecto: `backend/plans/models.py · Service.get_default_activities_service`
  (invocado desde `backend/activities/serializers.py · ActivitySerializer.create`).
- Feature: `backend/gyms/features.py · FEATURE_ACTIVITIES` y
  `backend/gyms/features.py · activities_enabled` / `require_activities`;
  catálogo en `backend/gyms/features.py · FEATURE_CATALOG`. El flag por defecto
  es `False` (se habilita al crear el gimnasio).
- Precio forzado en modo sesiones:
  `backend/core/mixins.py · BillingPriceMixin.apply_billing_price_rules`,
  aplicado desde `backend/activities/serializers.py · ActivitySerializer.validate`.

---

## 2. Los horarios de la actividad

- Cada actividad puede tener **uno o más horarios** (`ActivitySchedule`):
  **día**, **hora de inicio**, **hora de fin** y **capacidad** (cupo de socios).
- Reglas de carga:
  - La hora de fin debe ser **posterior** a la de inicio.
  - No puede haber **dos horarios activos que se superpongan** dentro de la
    misma actividad, el mismo día (ej. no se puede tener lunes 10:00–11:00 y
    lunes 10:30–11:30 a la vez).
  - No se puede repetir la misma combinación actividad + día + hora de inicio.
- El listado del staff muestra por defecto **sólo los horarios activos**; se
  pueden pedir los inactivos con `?active=false`.
- Un horario **no se borra**: se **desactiva** (baja lógica). Pero no se puede
  desactivar el **único horario activo** de una actividad activa (ver §6).

### Referencia
- Modelo: `backend/activities/models.py · ActivitySchedule`; unicidad
  actividad+día+inicio y `end > start` en `ActivitySchedule.Meta`.
- Validaciones de solapamiento y fin posterior:
  `backend/activities/serializers.py · ActivityScheduleSerializer.validate` y
  `backend/activities/serializers.py · ActivityScheduleSerializer._validate_no_overlap`.
- Filtro de activos: `backend/activities/views.py · ActivityScheduleViewSet.get_queryset`.

---

## 3. Cómo se inscribe un socio

Hay **tres caminos** para inscribir a un socio a un horario de actividad:

| Camino | Quién lo hace | Detalle |
|--------|---------------|---------|
| **Alta / onboarding** | El staff, al registrar al socio (o el admin del gimnasio) | Se eligen actividades y horarios en conjunto con el alta; sólo se saltea la elegibilidad de pago (cupo, duplicado y solapes se siguen validando) |
| **Staff** | El personal, desde la pantalla de inscripciones del horario | Puede elegir modalidad mensual o paquete y fijar el coseguro |
| **Portal del socio** | El propio socio, con su token | Sólo puede autoinscribirse a actividades con `billing_mode="monthly"`; las "por sesiones" requieren al staff |

Reglas que valida el sistema al inscribir:

- El gimnasio debe tener la feature **Actividades** habilitada.
- El socio debe poder operar (no estar bloqueado por falta de pago), salvo en el
  alta/onboarding, donde se saltea **sólo** la elegibilidad de pago.
- El horario debe tener **cupo**: se toma un bloqueo (`select_for_update`) sobre
  el horario para que dos inscripciones simultáneas no se pasen de la capacidad.
- El socio **no puede estar ya inscripto** en ese mismo horario (responde 409).
- El socio **no puede tener otro horario que se superponga** ese día, ni con su
  **horario de gimnasio**, ni con **otra actividad**, ni con una **salida**, ni
  con su **entrenamiento personal**. El bloque de gimnasio se compara con su
  duración real.
- Las actividades **por sesiones** no se pueden autoinscribir desde el portal:
  responden "Esta actividad requiere inscripción por el staff".

### Referencia
- Alta/onboarding: `backend/members/services.py · RegistrationService.register`
  (llama a `EnrollmentService.enroll_member` con `skip_eligibility_check=True`).
- Staff: `backend/activities/views.py · ScheduleEnrollmentViewSet.enroll`.
- Portal: `backend/activities/public_views.py · PublicMemberEnrollmentsView.post`
  y `backend/activities/public_views.py · PublicMemberEnrollView.post`.
- Servicio central:
  `backend/activities/enrollment_service.py · EnrollmentService.enroll_member`
  (elegibilidad, lock de capacidad y control de duplicado dentro del método).
- Solapamientos: `backend/core/overlap.py · check_member_slot` es la fuente de
  verdad; `backend/activities/overlap.py · validate_enrollment` sólo traduce el
  conflicto. La duración del bloque de gimnasio sale de
  `backend/core/times.py · slot_end`.
- Autoinscripción bloqueada para "por sesiones":
  `backend/activities/public_views.py · PublicMemberEnrollmentsView.post` y
  `backend/activities/public_views.py · PublicMemberEnrollView.post`.
- Listado de horarios con cupo para el portal:
  `backend/activities/public_views.py · PublicGymActivitiesView.get` y
  `backend/activities/public_views.py · PublicAvailableActivitiesView.get`
  (excluyen `billing_mode="sessions"` y los horarios sin cupo).

---

## 4. El cobro de actividades

- **Actividad mensual**: al inscribir se crea (o reutiliza) una línea de
  facturación de tipo `activity` en la suscripción vigente del socio. El precio
  se toma del **precio mensual actual** de la actividad y, si la suscripción
  nació prorrateada, también se prorratea. Si el socio ya tenía la línea, **no
  se actualiza el precio** salvo que sea cortesía.
- **Pase de cortesía** (`is_comp`): la línea de actividad se factura en **$0**.
- **Actividad por sesiones**: la actividad tiene `billing_mode="sessions"` y el
  staff elige al inscribir:
  - **Mensual**: no agrega un cargo mensual. El precio de la oferta está
    forzado a $0; la inscripción queda incluida en la membresía y la UI la
    muestra como "sin cargo".
  - **Paquete de N sesiones**: el staff define:
    - **Total de sesiones** del paquete.
    - **Coseguro por sesión** (`session_price`). Para socios de cortesía es $0.
    - **Sellado/coseguro** (`sellado_amount`, opcional).
    - El sistema no cobra por adelantado el paquete: se registran **pagos
      parciales** que descuentan del total (`session_price × total_sesiones`).
- **Cobro del paquete**: cada cobro crea un `Payment` con concepto `coseguro`.
  El monto acumulado (`Enrollment.amount_paid`) se sincroniza desde esos pagos,
  **excluyendo los pagos de sellado**: **los pagos son la fuente de verdad**. No
  se puede cobrar más que el total pendiente.
- **Sellado**: se registra como un `Payment` con concepto `sellado`, por el
  monto exacto configurado; no suma a `amount_paid` y se refleja en el flag
  `sellado_paid`.
- **Baja (desinscribir)**: la inscripción se marca inactiva. El ítem de
  facturación de la actividad se cancela **sólo si el socio no tiene otra
  inscripción activa de la misma actividad** (el ítem es por oferta, no por
  horario), y se cancelan las líneas del período actual y de los futuros ya
  generados; los períodos históricos no se tocan.
- **Baja desde el portal**: el socio puede darse de baja con un `DELETE` a la
  URL pública, enviando `schedule_id` en el cuerpo. No se exige elegibilidad de
  pago. Las actividades `billing_mode="sessions"` no permiten esta baja: deben
  gestionarla por el staff.

### Referencia
- Línea de actividad:
  `backend/activities/enrollment_service.py · EnrollmentService.enroll_member`
  y `backend/activities/enrollment_service.py · _ensure_activity_item`; el
  prorrateo sale de `backend/subscriptions/services.py · prorated_price_for`.
- Paquete:
  `backend/activities/enrollment_service.py · EnrollmentService.enroll_member`;
  datos del paquete en `backend/activities/models.py · Enrollment`.
- Cobro del paquete:
  `backend/activities/enrollment_service.py · EnrollmentService.record_package_payment`;
  sincronización en `backend/payments/services.py · enrollment_sessions_paid` y
  `backend/payments/services.py · sync_enrollment_paid`.
- Sellado: `backend/payments/services.py · sellado_paid_exists` y
  `backend/payments/services.py · set_sellado_paid`.
- Baja:
  `backend/activities/enrollment_service.py · EnrollmentService.unenroll_member`
  y `backend/activities/enrollment_service.py · _cancel_activity_items`.
- Baja desde el portal:
  `backend/activities/public_views.py · PublicMemberEnrollmentsView.delete`.
- Propiedades del paquete:
  `backend/activities/models.py · Enrollment.total_amount`,
  `backend/activities/models.py · Enrollment.remaining_amount` y
  `backend/activities/models.py · Enrollment.exhausted`.

---

## 5. Registrar sesiones y no asistencias

En las actividades **por sesiones**, cada clase cuenta como una sesión del
paquete. Hay cuatro formas de que se registre una sesión:

| Origen | Cuándo pasa |
|--------|-------------|
| **Automática** (`auto`) | El socio hace **check-in** y la regla ACC-08 identifica su inscripción de paquete; el sistema descuenta 1 sesión solo |
| **Manual** (`manual`) | El staff la registra a mano desde la inscripción |
| **Recuperación** (`recovery`) | El socio recupera una clase faltada en otro día (flujo de recuperaciones) |
| **No asistió** (`no_show`) | El socio **no** fue y la clase ya pasó: la tarea programada descuenta 1 sesión |

Detalles:

- El registro es **idempotente por (inscripción, fecha, horario)**: repetir el
  mismo día no duplica ni cobra dos veces.
- La sesión **automática se traga los errores**: si ya estaba registrada, la
  inscripción está inactiva o el paquete está agotado, el socio igual puede
  entrar al gimnasio.
- **Check-in automático (ACC-08)**: como el check-in sólo conoce el día y no a
  qué clase fue el socio, se descuenta sólo cuando la asistencia es
  inequívoca:
  - una sola inscripción de paquete activa ese día → se descuenta siempre,
    aunque el socio haya entrado fuera de la ventana horaria;
  - varias inscripciones ese día → se descuentan sólo las que caen dentro de
    su ventana horaria;
  - ninguna coincide con la ventana → no se descuenta ninguna;
  - el check-in de staff sin hora sólo descuenta el caso inequívoco de una
    sola inscripción.
- El **job de no-asistencia** corre junto con el mantenimiento de suscripciones
  (cada ~6 h, con el tráfico de la app o por cron):
  - sólo procesa inscripciones activas de paquete cuyo horario y actividad
    sigan activos, y socios no eliminados;
  - sólo descuenta fechas de clase **estrictamente anteriores a hoy**;
  - **saltea** los días en que el gimnasio estuvo cerrado;
  - no descuenta fechas anteriores a la inscripción ni a la creación del
    horario (ADD-07);
  - **no supera** el total del paquete (nunca deja "sesiones restantes"
    negativas);
  - cada **recuperación programada** cubre **exactamente una** falta
    (ADD-27). Las recuperaciones vencidas no cubren nada y una recuperación ya
    usada no vuelve a perdonar faltas nuevas. Si la falta ya estaba cobrada,
    otorgar la recuperación borra el `no_show` más reciente; si todavía no se
    cobró, el barrido protege la falta más reciente y la ata a la recuperación;
  - si el paquete está agotado, la falta **no se cobra ahora pero tampoco se
    pierde**: queda pendiente hasta que el staff agregue sesiones. En ese caso
    el **marcador** (`no_show_scan_until`) no avanza sobre la deuda pendiente
    (ADD-29);
  - en el caso normal, avanza el marcador para no re-procesar: si el staff
    quita una falta a mano, no se vuelve a descontar.
- El staff puede **registrar** una sesión, **quitar** una (corrección) y
  **renovar** el paquete agregando sesiones extra.
- **Renovación**: por defecto rechaza renovar si quedan sesiones sin cobrar;
  `allow_unpaid` es el override explícito del staff. No vuelve a pedir el
  sellado y, en actividades, refresca el coseguro por sesión según la obra
  social actual del socio.
- **Diferencia con entrenamiento personal (PT)**: comparten el motor de faltas
  y recuperaciones, pero el registro de PT es único por `(asignación, fecha)`
  sin horario y su renovación no actualiza el coseguro según la obra social.
- La suite verifica invariantes read-only de los paquetes: sesiones consumidas
  = registros, nunca más que el total, fechas del día correcto y posteriores a
  la creación del horario, sin sesiones en días cerrados, a lo sumo una por
  fecha y recuperaciones respaldadas por una recuperación usada (P1–P6).

### Referencia
- Modelo: `backend/activities/models.py · ActivitySessionRecord`, orígenes en
  `backend/activities/models.py · SESSION_SOURCE_CHOICES` y unicidad en
  `backend/activities/models.py · ActivitySessionRecord.Meta`.
- Registro/borrado/renovación:
  `backend/activities/session_service.py · SessionService.record_session`,
  `backend/activities/session_service.py · SessionService.record_auto`,
  `backend/activities/session_service.py · SessionService.remove_session` y
  `backend/activities/session_service.py · SessionService.renew_package`.
- Check-in automático:
  `backend/attendance/public_views.py · PublicCheckinView._handle_checkin`,
  `backend/attendance/checkin_discount.py · count_activity_sessions` y
  `backend/attendance/checkin_discount.py · _discount_candidates`.
- Acciones del staff:
  `backend/activities/views.py · EnrollmentActionViewSet.record_session`,
  `backend/activities/views.py · EnrollmentActionViewSet.remove_session` y
  `backend/activities/views.py · EnrollmentActionViewSet.renew`.
- Job de no-asistencia:
  `backend/activities/no_show_service.py · deduct_missed_activity_enrollments`,
  `backend/activities/no_show_service.py · _deduct_activity_enrollment` y
  `backend/activities/no_show_service.py · deduct_missed_sessions`; cadencia en
  `backend/subscriptions/services.py · SCHEDULED_TASKS_INTERVAL_SECONDS` y
  ejecución en `backend/subscriptions/services.py · run_scheduled_tasks`.
- Recuperación cancela la falta:
  `backend/activities/no_show_service.py · cancel_recovered_no_show`, invocada
  desde `backend/attendance/recovery_service.py · grant_scheduled`; consumo en
  `backend/attendance/recovery_service.py · use_recovery`.
- Invariantes: `backend/core/session_invariants.py · check_session_invariants`.

---

## 6. Activar, desactivar y reactivar

- **Desactivar una actividad** (desde el botón de la tarjeta, que en realidad es
  un `DELETE` lógico):
  - marca la actividad como inactiva;
  - **desactiva en cascada todos sus horarios activos** y los marca con
    `auto_deactivated=True`, para distinguirlos de los apagados a mano;
  - deja de ofrecerse en el portal y en la autoinscripción;
  - **corta el cobro**: da de baja las inscripciones activas y cancela el ítem
    de la actividad en las suscripciones no vencidas, resincronizando el saldo
    (ADD-01). Los períodos históricos no se tocan.
- **Eliminar** en la API es siempre baja lógica: nunca se borra la fila.
- **Reactivar una actividad** vuelve a activarla. El parámetro
  `restore_schedules` viene en `True` por defecto y **sólo reactiva los
  horarios que se habían apagado con la oferta** (`auto_deactivated=True`).
  Los horarios que el staff apagó a mano **siguen apagados** (ADD-04). La
  respuesta informa cuántos se restauraron en `restored_schedules`. Con
  `restore_schedules=False` no vuelve ningún horario.
- Un horario **nuevo activo** en una actividad inactiva **activa la actividad
  automáticamente** (permite el camino "crear horarios nuevos": la actividad
  queda activa al cargar el primero).
- La **baja de un horario** (botón de eliminar, `DELETE`) no permite desactivar
  el **último horario activo** de una actividad activa (responde 400). Para
  apagarla entera hay que desactivar la actividad.
- Un horario inactivo se puede **reactivar individualmente** con un `PATCH` que
  envía `active=true`; no cambia el estado de la actividad.
- No se puede guardar una actividad como activa **sin ningún horario activo**.
- En el frontend, "Restaurar horarios anteriores" llama a la reactivación con
  restauración selectiva; "Crear nuevos horarios" lleva a cargar un horario
  nuevo, que activa la actividad al guardarse. "Restaurar horarios anteriores"
  ya no revive los horarios apagados a propósito.

### Referencia
- Cascada al desactivar, marca de horarios y corte de cobro:
  `backend/activities/models.py · Activity.save`,
  `backend/activities/models.py · ActivitySchedule.auto_deactivated` y
  `backend/activities/enrollment_service.py · cut_activity_billing`.
- Baja lógica: `backend/activities/views.py · ActivityViewSet.destroy`.
- Reactivación selectiva:
  `backend/activities/views.py · ActivityViewSet.reactivate`.
- Auto-activar al crear horario:
  `backend/activities/views.py · ActivityScheduleViewSet.perform_create`.
- Último horario activo:
  `backend/activities/views.py · ActivityScheduleViewSet.destroy`.
- Activar sin horarios activos:
  `backend/activities/serializers.py · ActivitySerializer.update`.
- Listado activos/inactivos:
  `backend/activities/views.py · ActivityScheduleViewSet.get_queryset`;
  servicio frontend `frontend/src/services/activities.service.js · reactivateActivity`.
- Restauración desde la UI:
  `frontend/src/pages/Activities.jsx · handleRestoreSchedules`;
  reactivación individual en
  `frontend/src/pages/ActivitySchedules.jsx · handleReactivateSchedule`.

---

## 7. Lo que el sistema NO hace hoy (para no prometerlo en el manual)

- **No tiene lista de espera**: un horario lleno simplemente rechaza la
  inscripción; no hay cola ni aviso de cupo liberado.
- **No aprueba ni vence nada solo**: la inscripción y la baja son inmediatas; no
  hay estados intermedios ni aprobación.
- **No avisa por email ni WhatsApp**: ni alta, ni baja, ni clases, ni faltas.
- **No autoinscribe actividades "por sesiones"**: el socio nunca puede tomar un
  paquete solo; siempre lo carga el staff.
- **No cobra el paquete por adelantado**: sólo registra pagos parciales del
  coseguro; no hay pasarela ni link de pago de actividades.
- **No versiona precios de actividad**: no hay historial; el precio queda
  congelado en la línea de facturación de cada socio, no en la actividad.
- **No actualiza el precio** de los socios ya inscriptos a una actividad mensual
  cuando el gimnasio cambia el precio de la actividad.
- **No distingue roles en el backend**: cualquier usuario autenticado del
  gimnasio puede inscribir por API; la restricción de pantalla la pone el
  frontend.
- **No respeta feriados** salvo los días de cierre cargados (`GymClosedDate`) al
  descontar faltas.
- **No reserva cupo de gimnasio** más allá del chequeo de choque horario.

---

## 8. Problemas que pueden pasar

Situaciones a tener en cuenta, porque el sistema hoy se comporta así:

1. **Desactivar un horario suelto oculta la inscripción y no corta el cobro.**
   Si se desactiva un horario (no la actividad entera), la inscripción sigue
   activa y la línea de facturación de la actividad mensual **sigue
   cobrándose**. Además, el portal filtra las inscripciones por horario y
   actividad activos, así que esa inscripción desaparece de la lista: el socio
   no ve el aviso de "Horarios no disponibles" ni puede reasignarse desde esa
   pantalla. Desactivar la actividad completa sí corta el cobro (ADD-01); la
   baja de un horario suelto no.
2. **Cambiar de horario puede dejar al socio sin ninguno.** El cambio hace
   primero la baja y después la inscripción al horario nuevo. Si la inscripción
   falla (cupo lleno, choque horario), el frontend intenta restaurar el horario
   anterior; si esa restauración también falla, el socio queda sin ese horario
   hasta reasignarse.
3. **Las faltas descuentan aunque el socio nunca haya ido.** El job de
   no-asistencia toma como faltada cualquier fecha de clase sin registro; un
   feriado no cargado o una clase caída descuentan igual una sesión del paquete.
4. **El saldo del paquete se puede desincronizar por pagos generales.** El tope
   de cobro vive en `record_package_payment`; si un pago se carga por otra vía
   (pago general de suscripción), ese pago no queda asociado a la inscripción y
   no descuenta `amount_paid`, así que la sección de "saldo pendiente" del
   paquete puede quedar desincronizada.

### Referencia
- Horario suelto sin corte de cobro y oculto en el portal:
  `backend/activities/views.py · ActivityScheduleViewSet.destroy`,
  `backend/activities/public_views.py · PublicMemberEnrollmentsView.get` y
  `backend/activities/tests_deactivation.py · ActivityPortalOrphanTests`.
- Baja-antes-de-alta con rollback:
  `frontend/src/pages/MemberActivities.jsx · handleSelectSchedule`.
- Faltas por fechas sin registro:
  `backend/activities/no_show_service.py · deduct_missed_activity_enrollments`
  y `backend/activities/no_show_service.py · _deduct_activity_enrollment`.
- Saldo desincronizado por pagos generales:
  `backend/activities/enrollment_service.py · EnrollmentService.record_package_payment`,
  `backend/payments/services.py · enrollment_sessions_paid` y
  `backend/payments/services.py · sync_enrollment_paid`.

---

### Notas de entorno para leer el código

- Zona horaria: `America/Argentina/Buenos_Aires`
  (`backend/config/settings.py · TIME_ZONE`).
- Toda operación de staff se filtra automáticamente por el gimnasio del usuario
  logueado (`backend/core/mixins.py · GymQuerysetMixin`); el portal público
  entra por código del gimnasio o token del socio.
- Los endpoints de actividades exigen la feature `activities`
  (`backend/activities/views.py · ActivitiesGuardMixin` y
  `backend/gyms/features.py · require_activities`).
- Los "por sesiones" comparten motor de sesiones y de faltas con entrenamiento
  personal (`backend/activities/no_show_service.py · deduct_missed_sessions`
  también procesa `PersonalTrainingAssignment`).
- El flujo visual de esta feature vive en `frontend/src/dev/ActivitiesFlow.jsx`
  (sólo desarrollo) y se alimenta de este documento.
