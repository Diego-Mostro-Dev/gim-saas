# Auditoría de cambios de horario — Cómo funciona hoy el sistema

> Documento descriptivo: **lo que el sistema hace hoy**, verificado contra el código.
> Está pensado para servir de base a un manual para gimnasios, por eso está escrito
> en lenguaje simple. Las referencias de código van aparte, en letra chica, para
> no ensuciar el texto.

---

## 1. Los dos tipos de cambio

Hay **dos** formas de cambiar el horario de un socio, y son cosas distintas:

| Tipo | Qué es | Cuándo se aplica |
|------|--------|------------------|
| **Cambio permanente** | El socio cambia su **horario fijo** (ej. pasa de lunes/miércoles a martes/jueves). | **En el momento** en que el staff lo aprueba. |
| **Intercambio puntual** | El socio cambia un **solo día** (ej. este jueves entrena el lunes). | En el **check-in de ese día**. Hasta que no hace check-in, no pasa nada. |

El cambio permanente reemplaza el horario habitual. El intercambio es una "excepción de un día" sobre el horario que ya tiene.

### Referencia
- Modelos: `backend/attendance/models.py` — `ScheduleChangeRequest` (:163) y `ScheduleSwapRequest` (:246).
- Endpoints: `backend/attendance/urls.py` — `/schedule-change-requests/` y `/schedule-swap-requests/`.

---

## 2. Las reglas que define el gimnasio

El gimnasio configura el comportamiento desde **Configuración** (y, al crear el gimnasio, desde el admin central). Por defecto:

| Regla | Valor por defecto | Qué significa |
|-------|-------------------|---------------|
| Cambios de horario habilitados | **Sí** (`allow_schedule_changes`) | Si está apagado, el socio no ve la opción ni puede pedir nada. |
| Anticipación mínima | **24 horas** (`schedule_change_notice_hours`) | Hay que pedir el cambio por lo menos 24 h antes de la próxima clase del horario pedido. |
| Espera entre solicitudes (cooldown) | **7 días** (`schedule_change_cooldown_hours`) | Desde su última solicitud (aprobada **o no**) el socio debe esperar antes de pedir otro cambio. |
| Máximo por mes | **4 cambios** (`max_schedule_changes_per_month`) | Cuenta cambios permanentes e intercambios pedidos desde el día 1 del mes. |
| Capacidad del horario | Por slot, o valor general (`default_schedule_capacity`) | Un horario lleno no acepta más solicitudes. |

Detalles que conviene saber:

- El **cooldown cuenta cualquier solicitud**, incluso las rechazadas o canceladas: si un cambio fue rechazado por el staff, igual hay que esperar los 7 días.
- Los **intercambios puntuales no disparan el cooldown**, pero sí consumen del límite mensual.
- El socio **bloqueado por falta de pago no puede pedir** cambios ni intercambios (el sistema responde "Acceso suspendido por falta de pago").

### Referencia
- Config en el modelo: `backend/gyms/models.py:68-103` (`allow_member_schedule_changes`, `schedule_change_notice_hours`, `allow_schedule_changes`, `schedule_change_cooldown_hours=168`, `max_schedule_changes_per_month=4`, `default_schedule_capacity`).
- Validaciones del pedido: `backend/attendance/serializers.py:645-727` (público) y `:443-515` (staff).
- Contador mensual: `backend/attendance/utils.py:374-402` (`count_schedule_changes_used_this_month`).
- Gate de pago: `backend/members/eligibility.py:32-46`; responde 403 en `backend/attendance/public_views.py:407,430,475,498`.
- Configuración en pantalla: `frontend/src/pages/Settings.jsx` y admin central `frontend/src/pages/admin/AdminGymEdit.jsx`.

---

## 3. Cómo lo pide el socio

- El socio entra a su **portal con token** (el enlace que recibe por mail/whatsapp), sección **Horarios**, y elige entre "Cambio permanente" o "Intercambio".
- Elije el **horario nuevo** (solo puede pedir otro horario de la misma actividad) y confirma.
- La solicitud queda en estado **Pendiente** (`pending`) y el staff la ve en el panel ("Cambios" / "Intercambios" con contador).
- El socio **no puede pedir**:
  - si el gimnasio tiene los cambios apagados,
  - si no pasó la anticipación de 24 h,
  - si no pasó la espera de 7 días desde su último pedido,
  - si ya usó los 4 cambios del mes,
  - si el horario pedido está completo,
  - si el horario pedido es el mismo que ya tiene, o ya lo tiene asignado,
  - si está bloqueado por falta de pago.
- Una solicitud pendiente **solo puede cancelarla el socio mientras esté pendiente**.

### Referencia
- Pantalla del socio: `frontend/src/pages/PublicRoutine.jsx` (lista de cambios, contador del mes, botones y modales).
- Creación y cancelación públicas: `backend/attendance/public_views.py:388-453` (cambios) y `:456-521` (intercambios).
- URLs públicas: `backend/attendance/urls.py:112-136` (`public/slots`, `public/schedule-change-requests`, `public/schedule-swap-requests`).

---

## 4. Quién lo aprueba

- **El personal del gimnasio** desde el panel (pestañas "Cambios" y "Intercambios"). No lo puede aprobar el socio.
- Al aprobar:
  - un **cambio permanente** pasa directamente a estado **Ejecutado** (`executed`): el horario nuevo queda activo **de inmediato**.
  - un **intercambio** pasa a estado **Aprobado** (`approved`) y recién se concreta cuando el socio hace check-in el día acordado.
- El staff puede también **Rechazar** (con una nota) o **Cancelar** una solicitud.
- **Ojo:** el sistema no distingue roles en el backend (no hay "solo el dueño"). Cualquier usuario autenticado del gimnasio podría aprobar por API; la restricción de pantalla la pone el frontend.

### Referencia
- Vistas staff: `backend/attendance/views.py:845-911` (`approve`/`reject`/`cancel`) y `:1022-1071` (swaps: aprobar deja `approved`).
- Permiso: `DEFAULT_PERMISSION_CLASSES = IsAuthenticated` (`backend/config/settings.py:215-220`); `require_owner` existe pero no se usa acá (`backend/core/permissions.py`).
- Panel staff: `frontend/src/pages/ScheduleChangeRequests.jsx` y `frontend/src/pages/ScheduleSwapRequests.jsx`.

---

## 5. Qué pasa cuando se aprueba

**Cambio permanente (el efecto es inmediato):**
- El horario viejo se desactiva y el nuevo se activa **el mismo día**, sin esperar a una fecha futura.
- No toca ni la suscripción, ni el plan, ni el precio, ni el día de pago: solo cambia a qué clases asiste.

**Intercambio puntual:**
- Aprobar no hace nada todavía: el sistema lo tiene en cuenta recién en el **check-in** del día pedido. Si ese día el socio va, registra asistencia en el horario intercambiado. Si ya registró asistencia ese día para el intercambio, se lo avisa.

**Dato importante — el cambio de plan:**
- Un socio que pidió un **cambio de plan** no puede tener cambios de horario pendientes: al aprobarse el cambio de plan, el sistema **cancela automáticamente** todas las solicitudes de cambio e intercambio pendientes del socio (quedan como "canceladas por el staff").

### Referencia
- Aprobar cambio permanente: `backend/attendance/views.py:893-904` — `current_schedule.active = False` + `ScheduleDomain.activate_schedule(...)`.
- Swap en el check-in: `backend/attendance/public_views.py:209-268`.
- Cambio de plan cancela pendientes: `backend/subscriptions/views.py:446-453` (`_cancel_pending_schedule_requests`).

---

## 6. Lo que el sistema NO hace hoy

- **No aprueba solo**: no hay auto-aprobación ni vencimiento de solicitudes. Una solicitud queda `pending` hasta que un humano actúe.
- **No respeta una fecha futura** para el cambio permanente: lo aplica apenas se aprueba.
- **No distingue roles en el backend**: la seguridad por "staff" es solo de interfaz.
- **No tiene un estado "Aprobado"** para los cambios permanentes: pasa directo de Pendiente a Ejecutado (el estado "approved" existe en el código pero no se usa en este flujo).
- **No informa bien al staff** en el panel: al aprobar un cambio, los demás usuarios ven el aviso como "cambio cancelado" (bug de etiquetas, ver sección 7).
- **No avisa al socio por mail/whatsapp**: los cambios se ven solo dentro del portal.

---

## 7. Problemas que pueden pasar

Situaciones a tener en cuenta, porque el sistema hoy se comporta así:

1. **El panel marca mal las aprobadas.** Las solicitudes aprobadas muestran la etiqueta cruda "executed" y el filtro "Aprobadas" **nunca muestra nada**. Al aprobar una, los otros usuarios ven el aviso "Cambio permanente cancelado" (porque el sistema solo reconoce "approved/rejected/cancelled" como estados).
2. **El socio pierde días de la semana actual.** La pantalla dice "Vigente: <fecha futura>", pero al aprobar el sistema desactiva el horario viejo **ya**: si el socio tenía clases esta misma semana, las pierde hasta su próxima clase en el horario nuevo.
3. **La espera de 7 días cuenta hasta los rechazados.** Una solicitud rechazada o cancelada por el staff igual bloquea al socio 7 días antes de pedir otro. Los intercambios no disparan esta espera: es asimétrico.
4. **Posible error del servidor por doble pedido.** No hay verificación previa de "ya hay una solicitud pendiente para ese horario" (solo una regla de base de datos sin manejo de error), así que en un caso límite el socio puede ver un error 500.
5. **El staff puede crear cambios sin límites.** Del lado del personal no se validan ni la espera de 7 días ni el máximo mensual (aunque al aprobar sí se re-chequea la capacidad del horario).
6. **El horario puede quedar duplicado.** Si el staff edita a mano los horarios del socio mientras hay una solicitud pendiente, al aprobar no se vuelve a verificar que el horario viejo siga activo: el socio puede quedar con dos horarios.
7. **Demasiadas solicitudes desde la misma IP.** Los pedidos públicos del socio están limitados a 30/hora **por IP**: varios socios detrás de la misma conexión (gimnasio o datos móviles) pueden recibir un error de límite 429.
8. **Un cambio de plan barre los cambios pendientes.** Si el socio tenía un cambio de horario pendiente y aprueban su cambio de plan, el cambio de horario se cancela en silencio (con nota en inglés) y el socio tiene que pedirlo de nuevo.

### Referencia
- Etiquetas del panel (no cubren `executed`): `frontend/src/pages/ScheduleChangeRequests.jsx:16-21`; filtro "Aprobadas" que nunca matchea `:26`; toast invertido `frontend/src/hooks/useScheduleChangeWatcher.js:65-70`.
- "Vigente" es solo informativo: `backend/attendance/serializers.py:517-524`.
- Duplicado sin manejo de `IntegrityError`: `backend/attendance/models.py:227-233` (constraint) vs manejo en `backend/subscriptions/serializers.py:52-64`.
- Sin validación staff de cooldown/límite: `backend/attendance/serializers.py:443-515`.
- Throttle: `backend/config/api/throttles.py:27-29` (`PublicAttendanceRateThrottle = 30/h`).

---

### Notas de entorno para leer el código
- Zona horaria: `America/Argentina/Buenos_Aires` (`backend/config/settings.py:461`).
- Los pedidos públicos usan el token del socio en la URL (sin sesión): `permission_classes = []` en `backend/attendance/public_views.py`.
- Toda operación autenticada se filtra por el gimnasio del usuario (`backend/core/mixins.py:4-19`).
- No hay tarea programada que apruebe o venza solicitudes de horario.