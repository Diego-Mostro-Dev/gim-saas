# Auditoría de Actividades — Cómo funciona hoy el sistema

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
  - **Precio mensual**: cuánto cuesta la actividad por mes. Al inscribir a un
    socio se crea una **línea de facturación** (`SubscriptionItem`) dentro de su
    suscripción, con el precio congelado.
  - **Modalidad de cobro** (`billing_mode`): **Mensual** o **Por sesiones**.
    - **Mensual**: se factura una cuota fija por mes, como cualquier plan.
    - **Por sesiones**: la actividad **no** se cobra por mes; el staff inscribe
      a cada socio en un **paquete de N sesiones** con un coseguro por sesión
      (ver §4).
  - **Activo**: el interruptor de publicación. Desactivarlo **también apaga
    todos sus horarios** (ver §6).
- Una actividad sólo existe si el gimnasio tiene habilitada la **feature
  "Actividades"** (`activities`). Si no, ni el staff ni el portal la ven y la
  API responde "feature deshabilitada".

### Referencia
- Modelo: `backend/activities/models.py:37-97` (`Activity`); `billing_mode`
  mensual/sesiones `:19-22,59-68`; precio congelado como `SubscriptionItem`
  `:52-58`; nombre único por servicio `:76`.
- Creación con servicio del gimnasio y nombre único:
  `backend/activities/services.py:7-12` y `_validate_name_unique` `:29-36`.
- Servicio por defecto: `backend/activities/serializers.py:76-83`
  (`PlanService.get_default_activities_service`).
- Feature: `backend/gyms/features.py:20` (`FEATURE_ACTIVITIES`) y
  `:72-82` (`activities_enabled` / `require_activities`); catálogo
  `:29-37`. El flag por defecto es `False` (se habilita al crear el gimnasio).

---

## 2. Los horarios de la actividad

- Cada actividad tiene **uno o más horarios** (`ActivitySchedule`): **día**,
  **hora de inicio**, **hora de fin** y **capacidad** (cupo de socios).
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
- Modelo: `backend/activities/models.py:100-131` (`ActivitySchedule`); único
  actividad+día+inicio `:118`; `end > start` `:119-124`.
- Validaciones de solapamiento y fin posterior: `backend/activities/serializers.py:109-156`
  (`validate` `:122-126`, `_validate_no_overlap` `:147-156`).
- Filtro de activos: `backend/activities/views.py:96-102`.

---

## 3. Cómo se inscribe un socio

Hay **tres caminos** para inscribir a un socio a un horario de actividad:

| Camino | Quién lo hace | Detalle |
|--------|---------------|---------|
| **Alta / onboarding** | El staff, al registrar al socio (o el admin del gimnasio) | Se eligen actividades y horarios en conjunto con el alta; no se re-chequea la elegibilidad de pago |
| **Staff** | El personal, desde la pantalla de inscripciones del horario | Puede elegir modalidad mensual o paquete y fijar el coseguro |
| **Portal del socio** | El propio socio, con su token | Sólo puede autoinscribirse a actividades **mensuales** (no a las "por sesiones") |

Reglas que valida el sistema al inscribir:

- El gimnasio debe tener la feature **Actividades** habilitada.
- El socio debe poder operar (no estar bloqueado por falta de pago), salvo en el
  alta/onboarding, donde se saltea el chequeo.
- El horario debe tener **cupo**: se toma un bloqueo (`select_for_update`) sobre
  el horario para que dos inscripciones simultáneas no se pasen de la capacidad.
- El socio **no puede estar ya inscripto** en ese mismo horario (responde 409).
- El socio **no puede tener otro horario que se superponga** ese día, ni con su
  **horario de gimnasio**, ni con **otra actividad**, ni con su **entrenamiento
  personal**.
- Las actividades **por sesiones** no se pueden autoinscribir desde el portal:
  responden "Esta actividad requiere inscripción por el staff".

### Referencia
- Alta/onboarding: `backend/members/services.py:184-196`
  (`EnrollmentService.enroll_member(..., skip_eligibility_check=True)`).
- Staff: `backend/activities/views.py:162-224` (`ScheduleEnrollmentViewSet.enroll`).
- Portal: `backend/activities/public_views.py:39-80`
  (`PublicMemberEnrollmentsView.post`) y `:203-241`
  (`PublicMemberEnrollView.post`).
- Servicio central: `backend/activities/enrollment_service.py:23-133`;
  elegibilidad `:75-77`; lock de capacidad `:86-105`; duplicado 409 `:99-105`.
- Solapamientos: `backend/activities/overlap.py:10-102` (gimnasio `:24-37`,
  actividad `:40-58`, entrenamiento personal `:85-102`).
- Autoinscripción bloqueada para "por sesiones": `backend/activities/public_views.py:65-69,227-231`.
- Listado de horarios con cupo para el portal:
  `backend/activities/public_views.py:83-128` y `:131-200`
  (excluye `billing_mode="sessions"` y los horarios sin cupo).

---

## 4. El cobro de actividades

- **Actividad mensual**: al inscribir se crea (o reutiliza) una línea de
  facturación de tipo `activity` en la suscripción vigente del socio. El precio
  se toma del **precio mensual actual** de la actividad y, si la suscripción
  nació prorrateada, también se prorratea. Si el socio ya tenía la línea, **no
  se actualiza el precio** salvo que sea cortesía.
- **Pase de cortesía** (`is_comp`): la línea de actividad se factura en **$0**.
- **Actividad por sesiones (paquete)**: sólo se puede inscribir si la actividad
  tiene `billing_mode="sessions"`. El staff define:
  - **Total de sesiones** del paquete.
  - **Coseguro por sesión** (`session_price`). Para socios de cortesía es $0.
  - **Sellado/coseguro** (`sellado_amount`, opcional).
  - El sistema no cobra por adelantado el paquete: se registran **pagos
    parciales** que descuentan del total (`session_price × total_sesiones`).
- **Cobro del paquete**: cada cobro crea un `Payment` con concepto `coseguro`.
  El monto acumulado (`Enrollment.amount_paid`) se sincroniza desde esos pagos:
  **los pagos son la fuente de verdad**. No se puede cobrar más que el total
  pendiente.
- **Baja (desinscribir)**: la inscripción se marca inactiva y se **cancelan las
  líneas de facturación de esa actividad** en el período actual y en los
  períodos futuros ya generados (los períodos históricos no se tocan).

### Referencia
- Línea de actividad: `backend/activities/enrollment_service.py:107-119` y
  `_ensure_activity_item` `:262-299` (precio prorrateado `:293-295`; si ya
  existe no se actualiza salvo override `:281-285`).
- Paquete: `backend/activities/enrollment_service.py:35-68`; datos del paquete
  en `backend/activities/models.py:163-204`.
- Cobro del paquete: `backend/activities/enrollment_service.py:135-227`
  (`Payment(concept="coseguro")` `:210-222`); sincronización de
  `amount_paid` en `backend/payments/services.py:14-64`
  (`enrollment_sessions_paid`, `sync_enrollment_paid`).
- Baja: `backend/activities/enrollment_service.py:229-259` y
  `_cancel_activity_items` `:302-320`.
- Propiedades del paquete: `total_amount` / `remaining_amount` / `exhausted`
  `backend/activities/models.py:237-257`.

---

## 5. Registrar sesiones y no asistencias

En las actividades **por sesiones**, cada clase cuenta como una sesión del
paquete. Hay cuatro formas de que se registre una sesión:

| Origen | Cuándo pasa |
|--------|-------------|
| **Automática** (`auto`) | El socio hace **check-in** dentro de la ventana horaria de la clase; el sistema descuenta 1 sesión solo |
| **Manual** (`manual`) | El staff la registra a mano desde la inscripción |
| **Recuperación** (`recovery`) | El socio recupera una clase faltada en otro día (flujo de recuperaciones) |
| **No asistió** (`no_show`) | El socio **no** fue y la clase ya pasó: la tarea programada descuenta 1 sesión |

Detalles:

- El registro es **idempotente por (inscripción, fecha, horario)**: repetir el
  mismo día no duplica ni cobra dos veces.
- La sesión **automática se traga los errores**: si ya estaba registrada o el
  paquete está agotado, el socio igual puede entrar al gimnasio.
- El **job de no-asistencia** corre junto con el mantenimiento de suscripciones
  (cada ~6 h, con el tráfico de la app o por cron):
  - Sólo descuenta fechas de clase **estrictamente anteriores a hoy**.
  - **Saltea** los días en que el gimnasio estuvo cerrado.
  - **No supera** el total del paquete (nunca deja "sesiones restantes"
    negativas).
  - Las **recuperaciones pendientes** cubren las faltas más recientes (una
    falta + su recuperación cuesta 1 sesión, no 2).
  - Avanza un **marcador** (`no_show_scan_until`) para no re-procesar: si el
    staff quita una falta a mano, no se vuelve a descontar.
- El staff puede **quitar** una sesión (corrección) y **renovar** el paquete
  agregando sesiones extra.

### Referencia
- Modelo: `backend/activities/models.py:260-307` (`ActivitySessionRecord`),
  orígenes `:29-34`, unicidad `:299-304`.
- Registro/borrado/renovación: `backend/activities/session_service.py:16-133`
  (`record_session` `:17-49`, `record_auto` `:51-65`, `remove_session`
  `:67-82`, `renew_package` `:84-133`).
- Check-in automático: `backend/attendance/public_views.py:55-77`.
- Acciones del staff: `backend/activities/views.py:270-340`
  (`record_session`, `remove_session`, `renew`) y `record_payment` `:342-360`.
- Job de no-asistencia: `backend/activities/no_show_service.py:1-22`
  (reglas) y `:152-256` (`deduct_missed_activity_enrollments`,
  `deduct_missed_sessions`); cadencia ~6 h en
  `backend/subscriptions/services.py:1982-2012`
  (`SCHEDULED_TASKS_INTERVAL_SECONDS`, corre en `run_scheduled_tasks` `:2061-2062`).
- Recuperación cancela la falta: `backend/activities/no_show_service.py:259-280`
  (`cancel_recovered_no_show`), invocada desde
  `backend/attendance/recovery_service.py:479`.

---

## 6. Activar, desactivar y reactivar

- **Desactivar una actividad** (desde el botón de la tarjeta, que en realidad es
  un `DELETE` lógico):
  - marca la actividad como inactiva,
  - **desactiva en cascada todos sus horarios activos**,
  - deja de ofrecerse en el portal y en la autoinscripción,
  - **no toca las inscripciones ni la facturación** de los socios que ya estaban
    anotados (ver §8).
- **Eliminar** en la API es siempre baja lógica: nunca se borra la fila.
- **Reactivar una actividad** vuelve a activarla y **reactiva TODOS sus
  horarios**, incluidos los que se habían desactivado a mano antes. El portal y
  el staff tienen dos caminos visuales ("Restaurar horarios anteriores" vs
  "Crear nuevos horarios"), pero el backend **siempre restaura todos**.
- Un horario **nuevo activo** en una actividad inactiva **activa la actividad
  automáticamente** (permite el camino "crear horarios nuevos": la actividad
  queda activa al cargar el primero).
- **No se puede desactivar el último horario activo** de una actividad activa
  (responde 400). Para apagarla entera hay que desactivar la actividad.
- No se puede guardar una actividad como activa **sin ningún horario activo**.

### Referencia
- Cascada al desactivar: `backend/activities/models.py:79-94`
  (`Activity.save` — `schedules.filter(active=True).update(active=False)`).
- Baja lógica: `backend/activities/views.py:65-69` (`destroy`).
- Reactivar todos los horarios: `backend/activities/views.py:71-80`
  (`reactivate`).
- Auto-activar al crear horario: `backend/activities/views.py:108-116`
  (`perform_create`).
- Último horario activo: `backend/activities/views.py:118-129` (`destroy`).
- Activar sin horarios activos: `backend/activities/serializers.py:85-90`
  (`update`).
- Listado activos/inactivos: `backend/activities/views.py:53-59`;
  servicio frontend `frontend/src/services/activities.service.js:41-49`.

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

1. **Desactivar una actividad no corta el cobro.** La cascada sólo apaga los
   horarios: las inscripciones siguen activas y la línea de facturación de la
   actividad **sigue cobrándose**. Para que deje de facturar hay que
   desinscribir a cada socio.
2. **Inscripciones huérfanas en el portal.** Si se desactiva un horario o una
   actividad, el socio la sigue viendo (secciones "Horarios no disponibles" /
   "Actividades no disponibles") y, en actividades mensuales, puede reasignarse
   a otro horario. Las "por sesiones" sólo ven el aviso "consultá en recepción".
3. **Cambiar de horario puede dejar al socio sin ninguno.** El cambio hace
   primero la baja y después la inscripción al horario nuevo. Si la inscripción
   falla (cupo lleno, choque horario), la baja **ya se hizo** y el socio queda
   sin ese horario hasta reasignarse.
4. **"Restaurar horarios" es engañoso.** La pantalla ofrece restaurar o crear
   horarios nuevos, pero reactivar la actividad **siempre revive todos los
   horarios**, incluso los que el staff había apagado a propósito.
5. **El chequeo de choque de gimnasio asume bloques de 1 hora.** El solapamiento
   con el horario de gimnasio se calcula como "hora + 1 h", así que un bloque de
   más de una hora puede no detectarse bien.
6. **El portal del socio puede romperse al mostrar una actividad desactivada.**
   El bloque "Actividades no disponibles" usa `gym` y `txt(...)` que **no están
   definidos en ese componente** (`MemberActivities.jsx:338`): al renderizar
   ese caso, el socio ve un error en lugar del aviso.
7. **Las faltas descuentan aunque el socio nunca haya ido.** El job de
   no-asistencia toma como asistida cualquier fecha sin registro; un feriado no
   cargado o una clase caída descuentan igual una sesión del paquete.
8. **El paquete se puede cobrar de más por fuera del flujo.** El tope de cobro
   vive en `record_package_payment`; si un pago se carga por otra vía (pago
   general de suscripción), la sección de "saldo pendiente" del paquete puede
   quedar desincronizada.

### Referencia
- Cascada que no toca inscripciones ni facturación: `backend/activities/models.py:90-93`.
- Estado de las inscripciones por actividad desactivada en el portal:
  `frontend/src/pages/MemberActivities.jsx:157-353`.
- Baja-antes-de-alta: `frontend/src/pages/MemberActivities.jsx:98-113`.
- Reactivar todo: `backend/activities/views.py:71-80`; el parámetro
  `restore_schedules` que manda el frontend no se usa
  `frontend/src/services/activities.service.js:45-49`.
- Choque de gimnasio = 1 hora: `backend/activities/overlap.py:29-30,143-145`.
- `gym`/`txt` sin definir: `frontend/src/pages/MemberActivities.jsx:338`.
- Faltas por fechas sin registro: `backend/activities/no_show_service.py:61-107`.

---

### Notas de entorno para leer el código

- Zona horaria: `America/Argentina/Buenos_Aires` (`backend/config/settings.py:461`).
- Toda operación de staff se filtra automáticamente por el gimnasio del usuario
  logueado (`backend/core/mixins.py:4-19`); el portal público entra por código
  del gimnasio o token del socio.
- Los endpoints de actividades exigen la feature `activities`
  (`backend/activities/views.py:28-31` y `require_activities` en
  `backend/activities/public_views.py`).
- Los "por sesiones" comparten motor de sesiones y de faltas con entrenamiento
  personal (`backend/activities/no_show_service.py` también procesa
  `PersonalTrainingAssignment`).
- El flujo visual de esta feature vive en `frontend/src/dev/ActivitiesFlow.jsx`
  (sólo desarrollo) y se alimenta de este documento.
