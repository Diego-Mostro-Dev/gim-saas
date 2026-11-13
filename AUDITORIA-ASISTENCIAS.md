# Auditoría de asistencias — Cómo funciona hoy el sistema

> Verificado contra: `f5b4b07`
> Fecha: 2026-10-30
> Alcance: registro de asistencia (QR público vs planilla staff), reglas de acceso/pago, cupos, límite semanal, recuperaciones de clases, asistencias de actividad/PT, no-show/faltas. No cubre recuperación de suscripción (ver AUDITORIA-RECUPERACION.md).
> Documentos relacionados: `AUDITORIA-RECUPERACION.md`, `AUDITORIA-HORARIOS.md`, `AUDITORIA-ACTIVIDADES.md`, `AUDITORIA-PERSONAL-TRAINING.md`, `AUDITORIA-MIEMBROS.md`, `AUDITORIA-SUSCRIPCIONES.md`, `AUDITORIA-PAGOS.md`
> Código cubierto: `backend/attendance`, `frontend/src/pages/Attendance.jsx`, `frontend/src/pages/Checkin.jsx`, `frontend/src/pages/AttendanceQR.jsx`
> Estado: verificado

> Documento descriptivo: **lo que el sistema hace hoy**, verificado contra el código.
> Está pensado para servir de base a un manual para gimnasios, por eso está escrito
> en lenguaje simple. Las referencias de código van aparte, en letra chica, para
> no ensuciar el texto.

---

## 1. Las dos formas de registrar la asistencia

Hay **dos** caminos para registrar que un socio fue al gimnasio, y son cosas distintas:

| Camino | Qué es | Quién lo hace |
|--------|--------|---------------|
| **Check-in por QR** (público) | El socio escanea el código de su gimnasio (o abre el enlace), entra con su token y el sistema lo registra solo. | El propio socio. |
| **Planilla del día** (staff) | El personal marca "asistió" a cada socio en la planilla del día. | El staff del gimnasio. |

El check-in por QR **solo funciona si el socio tiene un horario reservado para hoy**: no
sirve para entrar "porque sí". La planilla del staff **sí** permite registrar a alguien
aunque no esté en un horario (se elige horario manualmente).

### Referencia
- Pantalla pública: `frontend/src/pages/Checkin.jsx` (`/checkin/:gymCode`, `frontend/src/App.jsx:115`).
- Genera el QR: `frontend/src/pages/AttendanceQR.jsx`.
- Endpoint público: `backend/attendance/public_views.py:105-342` (`PublicCheckinView`, **POST** `/api/attendance/checkin/<token>/`).
- Planilla: `frontend/src/pages/Attendance.jsx` + `frontend/src/components/attendance/AttendanceStatus.jsx` → `frontend/src/services/attendance.service.js:22-34` → **POST** `/api/attendance/register/` (`backend/attendance/views.py:687-693`, url `backend/attendance/urls.py:63-65`).

---

## 2. Las reglas antes de entrar (check-in del socio, en orden)

Cuando un socio hace check-in, el sistema revisa **en este orden** y corta en la primera
regla que falle (el mensaje entre comillas es lo que el socio ve):

1. **¿Existe el socio y está activo?** Si no → *"Socio no encontrado"* (error 404).
2. **¿Está al día con el pago?** Debe tener una suscripción vigente hoy y el pago sin
   bloquear (estado ni `blocked` ni pendiente inicial) → *"Acceso suspendido por falta de
   pago."* (error 403).
3. **¿El gimnasio está abierto hoy?** Si el día figura como cerrado → mensaje de cierre
   (error 403).
4. **¿Tiene una recuperación agendada para hoy?** Entra por el horario de su
   recuperación y **solo si está dentro de la ventana** de ese horario. Afuera de la hora
   → *"Tu recuperación de hoy era a las H... / recién es a las H..."* (error 403). Una
   recuperación entra como *"Asistencia (recuperación)"*, **no consume cupo ni cuota
   semanal**.
5. **¿Respetó el límite semanal del plan?** Cuenta las asistencias de la semana
   (lunes a domingo) y lo compara con las visitas semanales del plan → *"Alcanzaste el
   límite de X visitas semanales de tu plan."* (error 403). Los días en que el gimnasio no
   opera (días sin horarios, ej. domingos cerrados) **no cuentan**.
6. **¿Tiene un intercambio aprobado para hoy?** Si sí, entra directamente por el horario
   intercambiado. El cupo de ese horario se calcula **excluyendo al socio** (porque el
   intercambio aprobado ya le reservó el lugar). Si ya lo usó → *"Ya registraste asistencia
   para este intercambio hoy"*.
7. **¿Ya entró hoy?** El socio solo puede registrarse **una vez por día** (sin importar el
   horario) → *"Ya registraste asistencia hoy"*.
8. **¿Tiene horario reservado para hoy?** Se busca su horario activo para ese día de la
   semana. Si no tiene → *"No tienes un horario reservado para hoy."* (error 403). Aquí
   es donde se frustra el "walk-in" por QR.
9. **¿Hay cupo en el horario?** Si la ocupación del horario alcanzó su capacidad →
   *"El horario está completo."* (error 400).

Si pasa todas, crea la asistencia y responde *"✓ Asistencia registrada"`*, y el socio pasa
directo a su portal (ruta `/routine/<token>`).

### Referencia
- Vista pública completa: `backend/attendance/public_views.py:109-342`. El orden real es: socio (114-126) → pago (128-135) → cerrado (140-147) → recuperación (149-194) → límite semanal (196-207) → swap (209-268) → ya registrado (270-285) → horario de hoy (287-311) → cupo (313-323) → crear (325-330).
- Definición de "puede operar": `backend/members/eligibility.py:31-77` (`can_operate`/`block_reason`).
- Conteo semanal: `backend/attendance/utils.py:295-324` (`count_member_week_attendances`; excluye `is_recovery`).
- Límite y días sin horario: `MemberEligibility.get_schedule_limit` + días con slot (`utils.py:304-306`).
- Cierre del gimnasio: modelo `GymClosedDate` (`backend/gyms/models.py`).
- Cupo: `compute_effective_occupancy` en `backend/attendance/utils.py:28-97`.

---

## 3. Cómo lo marca el staff (la planilla)

- En la pestaña **Asistencia** el staff elige día y horario y marca "Registrar asistencia"
  a cada socio.
- Del lado del servidor se validan (repitiendo varias reglas del camino público):
  - Si viene con un **intercambio**: que sea del mismo gimnasio, esté aprobado, sea **de
    hoy** y no se haya registrado ya.
  - Que **haya horario** seleccionado y sea del mismo gimnasio.
  - Que **no esté ya registrado** ese socio en ese horario hoy.
  - Que haya **cupo** en el horario.
  - Que esté **al día con el pago**.
  - Que respete el **límite semanal**.
- Diferencias con el camino del socio:
  - El staff **no verifica si el gimnasio está cerrado** ese día.
  - El staff **no valida la hora**: se puede marcar una asistencia de un horario del
    mediodía a las 3 de la mañana.
  - El staff **no tiene límite por IP** (el socio sí, ver sección 7) y **cualquier usuario
    autenticado** del gimnasio puede marcar (el backend no distingue roles).

### Referencia
- Serializer staff: `backend/attendance/serializers.py:219-306` (`AttendanceSerializer.validate`); creación en `:308-322`.
- Permiso base: `DEFAULT_PERMISSION_CLASSES = IsAuthenticated` (`backend/config/settings.py:215-220`); la vista es un `CreateAPIView` genérico (`backend/attendance/views.py:687-693`).

---

## 4. Recuperaciones, intercambios y sesiones de actividad

- **Recuperación:** cuando el socio entra dentro de la ventana de su recuperación
  agendada, la asistencia queda marcada como *recuperación* y **no consume ni cupo ni
  cuota semanal**. Es la única asistencia con ventana horaria estricta.
- **Intercambio puntual:** el socio entra por el horario destino del intercambio. Como el
  swap aprobado ya "reserva" el lugar, el cálculo de cupo **excluye al socio**.
- **Sesiones de paquete (auto-conteo):** si el check-in cae **dentro de la ventana horaria**
  de una actividad o salida tipo "paquete" a la que el socio está inscripto, se descuenta
  automáticamente **1 sesión** del paquete. Si cae afuera de la ventana, la sesión **no**
  se descuenta: el socio entra igual pero su paquete queda igual (ver problema 8).

### Referencia
- Recuperación: `backend/attendance/public_views.py:149-194`; servicio `backend/attendance/recovery_service.py:303-390`.
- Swap en el check-in: `backend/attendance/public_views.py:209-268` (cupo con `exclude_member` en `:231-246`).
- Auto-conteo: `backend/attendance/public_views.py:54-77` (actividades) y `:80-100` (salidas), llamado en `:332-335`.

---

## 5. Quién puede hacer qué

| Acción | Quién | Notas |
|--------|-------|-------|
| Entrar por QR | El socio, con su token en la URL | Endpoint público (`permission_classes = []`), sin sesión. Throttle 30/h por IP + 600/h por token. |
| Marcar en la planilla | Cualquier usuario autenticado del gimnasio | Sin verificación de rol en el backend; la pantalla solo se muestra a ciertos roles. |
| Ver/consultar asistencias | Usuarios del gimnasio (staff) | Todo autenticado se filtra por el gimnasio del usuario. |

### Referencia
- Públicos: `backend/attendance/public_views.py:106-107` (`permission_classes = []` + throttles).
- Filtro por gimnasio: `backend/core/mixins.py:4-19`.

---

## 6. Lo que el sistema NO hace hoy

- **No marca ausencias**: no hay "no vino" ni "llegó tarde". La asistencia es solo
  positiva: o hay registro, o no hay nada. No hay tarea programada que marque faltas.
- **No permite walk-in por QR**: sin un horario reservado para hoy, el socio no entra
  (403). El staff sí puede marcarlo eligiendo un horario.
- **No exige exactamente el horario del bloque**: la ventana es configurable por
  gimnasio (`checkin_window_minutes`); con `0` no hay restricción horaria. Cuando existe,
  va desde el inicio menos N minutos hasta el fin real del bloque.
- **No permite que el mismo QR registre dos horarios el mismo día**: el camino público
  acepta una sola asistencia por (socio, fecha) y responde 409 al segundo escaneo. El
  staff sí puede registrar una asistencia por cada horario.

---

## 7. Problemas y decisiones vigentes

No quedan problemas abiertos en esta área: **ACC-01 a ACC-08 están cerrados** y el
detalle de cada resolución vive en `BUGS.md`. Lo que sigue son comportamientos
intencionales que conviene conocer antes de escribir el manual:

- **Un QR, una asistencia por día.** Si el socio tiene dos horarios el mismo día, el
  segundo escaneo responde **409**; el staff puede marcarlo dos veces (una por horario).
  Es la regla de ACC-07.
- **El descuento del paquete es conservador cuando hay varias inscripciones.** Con una
  sola inscripción de paquete activa ese día, la sesión se descuenta aunque el check-in
  caiga fuera de la ventana. Con varias, sólo se descuentan las que caen dentro de la
  ventana; si el check-in no tiene hora, no se descuenta ninguna y la sesión queda
  pendiente de carga manual (ACC-08).
- **La ventana de check-in es opcional.** Cada gimnasio decide cuántos minutos antes del
  inicio se habilita el ingreso; `0` significa sin ventana (ACC-02).
- **El cupo descuenta al socio que entra.** `compute_effective_occupancy` lo excluye, así
  que un horario lleno no se le cierra a sus propios inscriptos (ACC-01).

### Referencia
- Cupo: `backend/attendance/utils.py` · `compute_effective_occupancy`.
- Ventana: `backend/attendance/utils.py` · `within_checkin_window` y
  `checkin_window_bounds`; campo `backend/gyms/models.py` · `Gym.checkin_window_minutes`.
- Día cerrado: `backend/attendance/serializers.py` · `AttendanceSerializer` y
  `backend/attendance/public_views.py` · `PublicCheckinView`.
- Duplicado: `backend/attendance/public_views.py` · `PublicCheckinView` (409) y
  `backend/attendance/serializers.py` · `AttendanceSerializer` (400).
- Descuento de paquete: `backend/attendance/checkin_discount.py` ·
  `count_activity_sessions` y `count_outing_sessions`.
- Unicidad de asistencia: `backend/attendance/models.py` · `Attendance.Meta`
  (`unique_together = ("gym", "schedule", "date")`).
- Throttle del portal: `backend/config/api/throttles.py` · `MemberPortalTokenThrottle`.

---

### Notas de entorno para leer el código
- Zona horaria: `America/Argentina/Buenos_Aires` (`backend/config/settings.py:461`).
- Los endpoints públicos usan el token del socio en la URL (sin sesión): `permission_classes = []` en `backend/attendance/public_views.py:106-107`.
- Toda operación autenticada se filtra por el gimnasio del usuario (`backend/core/mixins.py:4-19`).
- La única restricción de base sobre asistencias es `unique_together ("gym", "schedule", "date")` (`backend/attendance/models.py:151-157`); la validación por "(socio, fecha)" existe solo en el paso público 7.
- No hay tarea programada que marque ausencias ni que venza una asistencia del día.