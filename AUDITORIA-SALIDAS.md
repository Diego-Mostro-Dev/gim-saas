# Auditoría de Salidas (Running grupal) — Cómo funciona hoy el sistema

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
    sistema** con rol trainer del gimnasio (no texto libre).
  - **Precio mensual**: cuánto cuesta la salida por mes. Al inscribir a un socio
    se crea una **línea de facturación** (`SubscriptionItem`) dentro de su
    suscripción, con el precio congelado.
  - **Modalidad de cobro** (`billing_mode`): **Mensual** o **Por sesiones**.
    - **Mensual**: se factura una cuota fija por mes, como cualquier plan.
    - **Por sesiones**: la salida **no** se cobra por mes; el staff inscribe a
      cada socio en un **paquete de N sesiones** con un precio por sesión (ver §5).
  - **Punto de encuentro**: dónde arranca la salida (texto libre).
  - **Recorrido y distancia**: el staff puede dibujar el recorrido en el mapa
    (`route_polyline`); la **distancia en km se calcula sola** (fórmula haversine)
    y no se edita a mano.
  - **Duración**: cuántos minutos dura la salida (por defecto 60).
  - **Activo**: el interruptor de publicación. Desactivarlo **también apaga
    todos sus horarios** (ver §7).
- Una salida sólo existe si el gimnasio tiene habilitada la **feature "Running
  grupal"** (`salidas`). Si no, ni el staff ni el portal la ven y la API responde
  "feature deshabilitada". El flag por defecto es `False`.

### Referencia
- Modelo: `backend/outings/models.py:39-154` (`Outing`); modalidad de cobro
  `:23-26,95-104`; entrenador como usuario `:56-63`; punto de encuentro y
  recorrido `:64-83`; distancia haversine `:115-133`; cascada de horarios `:135-151`;
  nombre único por gimnasio `:112`.
- Servicio por defecto: `backend/plans/models.py:66-77`
  (`PlanService.get_default_outings_service`, slug `running_grupal`); asignación
  al crear `backend/outings/serializers.py:121-128`.
- Feature: `backend/gyms/features.py:23` (`FEATURE_OUTINGS = "salidas"`) y
  `:111-121` (`outings_enabled` / `require_outings`); catálogo `:56-64`.

---

## 2. Los horarios de la salida

- Cada salida tiene **uno o más horarios** (`OutingSchedule`): **día**, **hora de
  inicio**, **hora de fin** y **capacidad** (cupo de socios).
- Reglas de carga:
  - La hora de fin debe ser **posterior** a la de inicio.
  - No puede haber **dos horarios activos que se superpongan** dentro de la
    **misma salida**, el mismo día.
  - No se puede repetir la misma combinación salida + día + hora de inicio.
- El listado del staff muestra por defecto **sólo los horarios activos**; se
  pueden pedir los inactivos con `?active=false`.
- Un horario **no se borra**: se **desactiva** (baja lógica). Pero no se puede
  desactivar el **único horario activo** de una salida activa (ver §7).
- **Importante**: a diferencia de las actividades, una salida **no** valida que
  el horario choque con el horario de gimnasio del socio, con otra actividad ni
  con su entrenamiento personal. Ese control no existe acá (ver §8).

### Referencia
- Modelo: `backend/outings/models.py:157-188` (`OutingSchedule`); único
  salida+día+inicio `:175`; `end > start` `:176-181`.
- Validaciones de solapamiento y fin posterior: `backend/outings/serializers.py:157-204`
  (`validate` `:170-174`, `_validate_no_overlap` `:195-204`).
- Filtro de activos: `backend/outings/views.py:132-145`.
- Ausencia de solapamiento con gimnasio/actividades/PT: el módulo de salidas no
  importa ningún helper de `overlap` (comparar con `backend/activities/overlap.py`,
  que sí lo hace).

---

## 3. Cómo se inscribe un socio

Hay **dos caminos** para inscribir a un socio a un horario de salida. A diferencia
de las actividades, **el alta/onboarding no inscribe salidas**:

| Camino | Quién lo hace | Detalle |
|--------|---------------|---------|
| **Solicitud del socio** | El propio socio, con su token, y el staff la aprueba | Sólo salidas **mensuales**. El staff aprueba o rechaza (ver §4) |
| **Staff** | El personal, desde la pantalla de inscripciones del horario | Es el **único** camino para las salidas "por sesiones"; puede elegir mensual o paquete |

Reglas que valida el sistema al inscribir (por staff) o al crear la solicitud:

- El gimnasio debe tener la feature **Running grupal** habilitada.
- El socio debe poder operar (no estar bloqueado por falta de pago).
- El horario debe tener **cupo**: se toma un bloqueo (`select_for_update`) sobre
  el horario para que dos inscripciones simultáneas no se pasen de la capacidad.
- El socio **no puede estar ya inscripto** en ese mismo horario (responde 409).
- Las salidas **por sesiones** no se pueden solicitar desde el portal: responden
  "Esta salida requiere inscripción por el staff" (403).
- El socio **no puede tener otra solicitud de inscripción pendiente** (una a la
  vez; responde 409).

### Referencia
- Modelo de solicitud y estados: `backend/outings/models.py:349-453`.
- Staff: `backend/outings/views.py:207-256`
  (`ScheduleOutingEnrollmentViewSet.enroll`).
- Servicio central: `backend/outings/enrollment_service.py:19-122`;
  elegibilidad `:70-72`; lock de capacidad `:76-87`; duplicado 409 `:89-95`.
- Portal (crear solicitud): `backend/outings/public_views.py:66-97` y
  `:98-121`; reglas y elegibilidad `backend/outings/enrollment_request_service.py:17-62`;
  bloqueo de "por sesiones" `:27-31`.
- Alta/onboarding **sí** inscribe actividades y PT, pero **no** salidas:
  `backend/members/services.py:184-196`.

---

## 4. El flujo de solicitudes del socio

La inscripción del socio al portal no es inmediata: es una **solicitud** que el
staff revisa.

- El socio **crea** una solicitud desde su portal, de dos tipos:
  - **Inscripción** (`enroll`): a un horario con cupo.
  - **Baja** (`unenroll`): de una inscripción activa propia.
- La solicitud nace **pendiente** y puede terminar en:
  - **aprobada** (`approved`): el staff la ejecuta (crea o cancela la inscripción),
  - **rechazada** (`rejected`): el staff la descarta,
  - **cancelada por el socio** (`cancelled_by_member`),
  - **cancelada por el staff** (`cancelled_by_staff`).
- Sólo puede haber **una solicitud pendiente por tipo** y socio: no se puede
  tener dos inscripciones pendientes ni dos bajas pendientes a la vez.
- Al **aprobar una inscripción** se crea la inscripción y, si es mensual, se
  genera el cobro. La aprobación **saltea** el chequeo de elegibilidad de pago
  (el staff ya lo evaluó). Si el horario o la salida se desactivaron mientras
  tanto, responde "La salida ya no está activa" (410).
- Al **aprobar una baja** se cancela la inscripción y su facturación.

### Referencia
- Modelo: `backend/outings/models.py:363-453`; tipos `:349-352`; estados
  `:354-360`; única solicitud pendiente por tipo `:441-447`.
- Crear: `backend/outings/enrollment_request_service.py:17-62` (inscripción) y
  `:64-94` (baja).
- Aprobar/ejecutar: `:96-137` (saltea elegibilidad `:114-119`; valida salida
  activa `:108-113`); rechazar `:139-153`; cancelar `:155-162`.
- Staff: `backend/outings/views.py:325-372` (`approve`, `reject`, `cancel`).
- Portal: `backend/outings/public_views.py:42-46` (listar) y `:131-154`
  (cancelar por el socio, `cancelled_by_member`).

---

## 5. El cobro de salidas

- **Salida mensual**: al inscribir se crea (o reutiliza) una línea de
  facturación de tipo `outing` en la suscripción vigente del socio. El precio se
  toma del **precio mensual actual** de la salida y, si la suscripción nació
  prorrateada, también se prorratea. Si el socio ya tenía la línea, **no se
  actualiza el precio** salvo que sea cortesía.
- **Pase de cortesía** (`is_comp`): la línea de salida se factura en **$0**.
- **Salida por sesiones (paquete)**: sólo se puede inscribir si la salida tiene
  `billing_mode="sessions"`. El staff define:
  - **Total de sesiones** del paquete.
  - **Precio por sesión** (`session_price`). Para socios de cortesía es $0.
  - El sistema no cobra por adelantado el paquete: se registran **pagos
    parciales** que descuentan del total (`session_price × total_sesiones`).
- **Cobro del paquete**: cada cobro crea un `Payment` con concepto `outing`. El
  monto acumulado (`OutingEnrollment.amount_paid`) se sincroniza desde esos
  pagos: **los pagos son la fuente de verdad**. No se puede cobrar más que el
  total pendiente. A los socios de cortesía no se les cobra.
- **Deuda del paquete**: el saldo pendiente de los paquetes de salida se suma a
  la deuda del socio y del gimnasio (aparece en el portal y en Pagos).
- **Baja (desinscribir)**: la inscripción se marca inactiva y se **cancelan las
  líneas de facturación de esa salida** en el período actual y en los períodos
  futuros ya generados (los períodos históricos no se tocan).

### Referencia
- Línea de salida: `backend/outings/enrollment_service.py:97-109` y
  `_ensure_outing_item` `:251-283` (prorrateo `:277-279`; cortesía en 0 `:266-268`);
  tipos de ítem en `backend/subscriptions/models.py:206,250-306`.
- Paquete: datos en `backend/outings/models.py:220-296`; propiedades
  `total_amount` / `remaining_amount` / `exhausted` `:276-296`.
- Cobro del paquete: `backend/outings/enrollment_service.py:156-248`
  (`Payment(concept="outing")` `:230-243`; tope del saldo `:222-228`; cortesía
  `:190-193`); sincronización en `backend/payments/services.py:36-43,81-88`
  (`outing_sessions_paid`, `sync_outing_paid`).
- Deuda: `backend/subscriptions/services.py:849-958`
  (`member_outing_package_debt`, `gym_outing_package_debt`, entradas
  `type="outing_package"`); se suma al listado general `:1102`.
- Continuidad entre períodos/renovaciones: `backend/subscriptions/services.py:187-241`
  (`_copy_outing_items`), `:1349,1453,1832`; reactivación del cobro mensual en
  `backend/subscriptions/domain.py:220,262-269,377-380`.
- Baja: `backend/outings/enrollment_service.py:124-154` y
  `_cancel_outing_items` `:286-303`.

---

## 6. Registrar sesiones (y por qué acá NO hay faltas)

En las salidas **por sesiones**, cada salida cuenta como una sesión del paquete.
Hay **dos formas** de que se registre una sesión:

| Origen | Cuándo pasa |
|--------|-------------|
| **Automática** (`auto`) | El socio hace **check-in** dentro de la ventana horaria de la salida; el sistema descuenta 1 sesión solo |
| **Manual** (`manual`) | El staff la registra a mano desde la inscripción |

Detalles:

- El registro es **idempotente por (inscripción, fecha, horario)**: repetir el
  mismo día no duplica ni cobra dos veces.
- La sesión **automática se traga los errores**: si ya estaba registrada o el
  paquete está agotado, el socio igual puede entrar al gimnasio.
- El staff puede **quitar** una sesión (corrección) y **renovar** el paquete
  agregando sesiones extra (no se puede renovar si hay sesiones sin cobrar).
- **A diferencia de las actividades, acá NO existe el job de no-asistencia**: si
  el socio falta, **no se le descuenta ninguna sesión**. Tampoco existen las
  **recuperaciones** para salidas. El paquete sólo baja con check-in en ventana o
  con carga manual del staff.

### Referencia
- Modelo: `backend/outings/models.py:299-346` (`OutingSessionRecord`), orígenes
  `:33-36`, unicidad `:338-343`.
- Registro/borrado/renovación: `backend/outings/session_service.py:15-131`
  (`record_session` `:16-49`, `record_auto` `:51-65`, `remove_session` `:67-82`,
  `renew_package` `:84-131`; bloqueo por saldo sin cobrar `:105-113`).
- Check-in automático: `backend/attendance/public_views.py:80-102`
  (`_count_outing_sessions_if_in_window`), invocado en `:259-261` y `:333-335`.
- Acciones del staff: `backend/outings/views.py:392-462`
  (`record_session`, `remove_session`, `renew`, `record_payment`).
- Faltas/reuperaciones **no** aplican a salidas: `backend/activities/no_show_service.py`
  y `backend/attendance/recovery_service.py` no mencionan salidas.
- Vista del socio: `backend/outings/serializers.py:385-397`
  (`sessions_total`, `sessions_used`, `exhausted`).

---

## 7. Activar, desactivar y reactivar

- **Desactivar una salida** (desde el botón de la tarjeta, que en realidad es un
  `DELETE` lógico):
  - marca la salida como inactiva,
  - **desactiva en cascada todos sus horarios activos**,
  - deja de ofrecerse en el portal y en la autoinscripción,
  - **no toca las inscripciones ni la facturación** de los socios que ya estaban
    anotados (ver §8).
- **Eliminar** en la API es siempre baja lógica: nunca se borra la fila.
- **Reactivar una salida** vuelve a activarla y **reactiva TODOS sus horarios**,
  incluidos los que se habían desactivado a mano antes. El portal y el staff
  tienen dos caminos visuales ("Restaurar horarios anteriores" vs "Crear nuevos
  horarios"), pero el backend **siempre restaura todos**.
- Un horario **nuevo activo** en una salida inactiva **activa la salida
  automáticamente** (permite el camino "crear horarios nuevos": la salida queda
  activa al cargar el primero).
- **No se puede desactivar el último horario activo** de una salida activa
  (responde 400). Para apagarla entera hay que desactivar la salida.
- No se puede guardar una salida como activa **sin ningún horario activo**.

### Referencia
- Cascada al desactivar: `backend/outings/models.py:135-151` (`Outing.save`).
- Baja lógica: `backend/outings/views.py:81-85` (`destroy`).
- Reactivar todos los horarios: `backend/outings/views.py:87-96` (`reactivate`).
- Auto-activar al crear horario: `backend/outings/views.py:147-159` (`perform_create`).
- Último horario activo: `backend/outings/views.py:161-172` (`destroy`).
- Activar sin horarios activos: `backend/outings/serializers.py:130-138` (`update`).
- Dos caminos visuales: `frontend/src/pages/Outings.jsx:453-518`.

---

## 8. Lo que el sistema NO hace hoy (para no prometerlo en el manual)

- **No tiene lista de espera**: un horario lleno simplemente rechaza la
  inscripción o la solicitud; no hay cola ni aviso de cupo liberado.
- **No inscribe en el alta/onboarding**: a diferencia de las actividades, las
  salidas sólo se cargan por el staff o por una solicitud aprobada.
- **No autoinscribe salidas "por sesiones"**: el socio nunca puede tomar un
  paquete solo; siempre lo carga el staff.
- **No descuenta faltas**: no hay tarea de no-asistencia para salidas; el
  paquete no se agota por inasistencia.
- **No tiene recuperaciones**: no existe el concepto de recuperar una salida
  faltada.
- **No valida solapamiento** del horario con el gimnasio, otras actividades o el
  entrenamiento personal del socio (sí valida choques internos de la misma salida).
- **No cobra el paquete por adelantado**: sólo registra pagos parciales del
  precio por sesión; no hay pasarela ni link de pago de salidas.
- **No versiona precios de salida**: el precio se congela en la línea de
  facturación (`SubscriptionItem`) o en el paquete, no en la salida.
- **No actualiza el precio** de los socios ya inscriptos a una salida mensual
  cuando el gimnasio cambia el precio.
- **No avisa por email ni WhatsApp** (aunque el portal muestra el teléfono y el
  WhatsApp del entrenador para contactarlo).
- **No distingue roles en el backend**: cualquier usuario autenticado del
  gimnasio puede inscribir por API; la restricción de pantalla la pone el
  frontend.
- **No reserva cupo de gimnasio**: sólo controla el cupo del horario de salida.

---

## 9. Problemas que pueden pasar

Situaciones a tener en cuenta, porque el sistema hoy se comporta así:

1. **Desactivar una salida no corta el cobro.** La cascada sólo apaga los
   horarios: las inscripciones siguen activas y la línea de facturación de la
   salida **sigue cobrándose**. Para que deje de facturar hay que desinscribir a
   cada socio.
2. **Inscripciones huérfanas en el portal.** Si se desactiva un horario o una
   salida, el socio sigue viendo su grupo en el portal (el serializer lee el
   horario aunque la salida esté inactiva), pero no puede solicitar altas nuevas
   de esa salida.
3. **Faltar no descuenta sesión.** A diferencia de las actividades, un socio que
   nunca asiste a una salida **no consume el paquete**: no hay job de
   no-asistencia. El saldo del paquete queda intacto y el socio puede no agotarlo
   nunca.
4. **El auto-conteo depende del check-in en ventana.** Si el socio llega fuera
   de la ventana del horario, la sesión **no** se descuenta sola: queda
   pendiente hasta que el staff la cargue a mano.
5. **El paquete se puede cobrar de más por fuera del flujo.** El tope de cobro
   vive en `record_package_payment`; si un pago se carga por otra vía (pago
   general de suscripción), la sección de "saldo pendiente" del paquete puede
   quedar desincronizada.
6. **Renovar el paquete puede quedar bloqueado.** Si el socio tiene sesiones sin
   cobrar, la renovación se rechaza hasta que se cobre el saldo.
7. **Reactivar es engañoso.** La pantalla ofrece restaurar o crear horarios
   nuevos, pero reactivar la salida **siempre revive todos los horarios**,
   incluso los que el staff había apagado a propósito.
8. **No hay control de choques.** Como no se valida solapamiento con gimnasio,
   actividades ni PT, el socio puede quedar anotado en dos cosas a la misma hora,
   o en dos salidas que se superponen en salidas distintas.
9. **El portal no ofrece salidas por sesiones.** Las salidas `billing_mode="sessions"`
   se excluyen de las disponibles para solicitar; el socio sólo ve el aviso de
   consultar en recepción.

### Referencia
- Cascada que no toca inscripciones ni facturación: `backend/outings/models.py:142-150`.
- Grupo visible aunque la salida esté inactiva: `backend/outings/serializers.py:340-366`
  (lee `obj.schedule.outing`) y `backend/outings/public_views.py:34-40`.
- Sin job de faltas para salidas: `backend/activities/no_show_service.py` (sólo
  actividades y PT; `backend/attendance/recovery_service.py` sólo actividades).
- Auto-conteo sólo dentro de la ventana: `backend/attendance/public_views.py:99-102`.
- Tope de cobro sólo en el flujo: `backend/outings/enrollment_service.py:222-228`.
- Renovación bloqueada por saldo: `backend/outings/session_service.py:105-113`.
- Reactivar todo: `backend/outings/views.py:87-96`.
- Exclusión de "por sesiones" del portal: `backend/outings/public_views.py:172-180`.

---

### Notas de entorno para leer el código

- Zona horaria: `America/Argentina/Buenos_Aires` (`backend/config/settings.py:461`).
- Toda operación de staff se filtra automáticamente por el gimnasio del usuario
  logueado (`backend/core/mixins.py:4-19`); el portal público entra por el token
  del socio.
- Los endpoints de salidas exigen la feature `salidas`
  (`backend/outings/views.py:44-47` y `require_outings` en
  `backend/outings/public_views.py`).
- Las salidas comparten el motor de paquetes y de pagos con actividades y
  entrenamiento personal (mismo `Payment` con distintos conceptos), pero **no**
  comparten el motor de faltas ni el de recuperaciones.
- La asistencia del gimnasio lista a los socios de salidas como ítems propios
  (IDs negativos en un rango distinto al de las clases), tanto por día como por
  estado: `backend/attendance/views.py:98-140` y `:202-241`.
- El flujo visual de esta feature vive en `frontend/src/dev/OutingsFlow.jsx`
  (sólo desarrollo) y se alimenta de este documento.
