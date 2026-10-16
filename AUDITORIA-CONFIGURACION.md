# Auditoría de Configuración — Qué puede configurar el gimnasio hoy

> Documento descriptivo: **lo que el sistema hace hoy**, verificado contra el código.
> Está pensado para servir de base a un manual para gimnasios, por eso está escrito
> en lenguaje simple. Las referencias de código van aparte, en letra chica, para
> no ensuciar el texto.

---

## 1. Idea general

La pantalla **Configuración** (Settings) es la que usa el dueño/staff con permisos de owner para ajustar parámetros que afectan a todo el gimnasio. Muchos de esos valores se aplican **de inmediato** a lo que hacen socios y staff; otros actúan como límites/flags.

Lo que configura el gimnasio hoy:

- **Datos básicos**: nombre, WhatsApp, teléfono, email, logo e ícono de app (PWA).
- **Pagos**: `payment_due_day` (día de vencimiento) y `access_block_day` (día de bloqueo).
- **Planes & Horarios**: `allow_plan_changes`, `allow_schedule_changes`, `schedule_change_cooldown_hours`, `max_schedule_changes_per_month`, `schedule_change_notice_hours`, `allow_member_schedule_changes` (histórico) y también permite gestionar **horarios disponibles** (slots).
- **Recuperación de clases**: `allow_session_recovery`, `max_session_recoveries_per_month`.
- **Descuentos**: CRUD de `Discount` (porcentaje) para asignar a socios.
- **Obras sociales**: CRUD de `HealthInsurance` (coseguro por sesión, sellado).
- **Fechas cerradas**: `GymClosedDate` y carga masiva de feriados (AR).
- **Horarios del gimnasio**: slots diarios con capacidad opcional.
- **QR**: mensajes de QR de asistencia y registro.
- **SEO**: título, descripción, keywords, ciudad, dirección, horarios (para manifest/SEO).
- **Características (features)**: flags del gimnasio (activities, personal_training, community, salidas). Se gestionan desde admin también.

### Referencias
- Modelo: `backend/gyms/models.py:8-256` (Gym, GymClosedDate, Discount; HealthInsurance en `backend/members/models.py`).
- Serializer: `backend/gyms/serializers.py:21-124`.
- Views: `backend/gyms/views.py:1-250` (GymMeView, descuentos, fechas cerradas, feriados, PWA manifests).
- Admin: `backend/gyms/admin.py:1-160`.
- Frontend: `frontend/src/pages/Settings.jsx:1-2088`, servicio `frontend/src/services/gym.service.js`, hooks `frontend/src/hooks/useGym.js`.


---

## 2. Pagos: vencimiento y bloqueo

- **`payment_due_day`** (por defecto 10). Hasta ese día el socio sigue "pendiente de pago" pero **puede entrenar**. El cálculo de estado usa esto.
- **`access_block_day`** (por defecto 16). A partir de ahí pasa a **bloqueado** (no puede hacer casi nada). Validación: `access_block_day > payment_due_day`.
- Estos días se usan para el cálculo del estado de pago (`paid/initial_pending/pending/overdue/blocked`) y para el corte de renovación.
- **Nunca bloquea** por deuda de sesiones/paquetes/sellados: el bloqueo es **solo** por saldo de la suscripción mensual. Socios de cortesía nunca se bloquean por pago.
- Socio nuevo sin primer pago: **inicial_pending** → bloqueado desde día 1 (aunque ingrese después del due day).
- Si estaba bloqueado al cierre de mes, **no se renueva solo** hasta regularizar.

### Referencias
- Model: `backend/gyms/models.py:79-88,179-190`.
- Serializer: `backend/gyms/serializers.py:53-97`.
- Estados/bloqueo: `backend/subscriptions/services.py:1166-1190`, `backend/members/eligibility.py:55-75`.
- Corte renovación: `backend/subscriptions/services.py:1463-1555`.
- Dashboard: `backend/config/api/dashboard.py:295-316`.


---

## 19. Efectos cruzados detallados

- **Cambios de plan**: gated por `allow_plan_changes`. Afecta portal "Solicitar cambio de plan" y flujo staff. Fecha de efecto: hoy si no hay ciclo vigente, sino 1er día del mes siguiente. Ver `AUDITORIA-PLANES.md:§3`, `AUDITORIA-SUSCRIPCIONES.md:§3`.
- **Cambios de horario (permanentes + intercambios)**: `allow_schedule_changes` global. Validan cooldown, anticipación (`notice_hours`), cupo/capacidad y **límite mensual combinado** (`max_schedule_changes_per_month`) contando permanentes (`pending/approved/executed`) + swaps (`pending/approved`) por mes calendario. Conteo vía `attendance/utils.py:count_schedule_changes_used_this_month`.
- **Recuperación de clases**: requiere `allow_session_recovery`. Límite `max_session_recoveries_per_month` aplicado al otorgar/usar recuperos. Ver `attendance/recovery_service.py`.
- **Control de acceso / elegibilidad**: `payment_due_day`/`access_block_day` definen estados. Bloqueo **solo** por saldo de suscripción mensual. Cortesía nunca bloqueado por pago. Socio con `initial_pending` bloqueado desde día 1.
- **Renovación**: si estaba bloqueado al cierre de mes **no se renueva solo** hasta regularizar (`subscriptions/services.py` corte renovación).
- **Fechas cerradas**: afectan mensajes/ocupación/asistencia (staff/portal). Carga de feriados solo futuros, evita duplicados.
- **Características (features)**: `activities/personal_training/community/salidas` habilitan/deshabilitan módulos UI (rutas, pestañas, avisos). También impactan manifiestos/labels.
- **Labels/SEO/PWA**: personalizan textos visibles (`labels.py`, `get_gym_labels`) y manifiestos dinámicos member/staff.

### Referencias cruzadas
- Planes/cambios: `backend/plans/views.py`, `backend/subscriptions/domain.py`, `AUDITORIA-PLANES.md`, `AUDITORIA-SUSCRIPCIONES.md`.
- Horarios/cambios: `backend/attendance/serializers.py`, `backend/attendance/utils.py:374-403`, `backend/attendance/models.py`.
- Elegibilidad: `backend/members/eligibility.py:55-75`.
- Renovación/corte: `backend/subscriptions/services.py:1166-1190,1463-1555`.

---

## 20. Lo que NO hace

- **No gestiona planes ni precios**: CRUD de planes está en módulo Planes (`backend/plans/*`, `frontend/src/pages/Plans.jsx`).
- **No gestiona suscripciones/cobros**: eso es Pagos/Suscripciones (`backend/subscriptions/*`, `backend/payments/*`).
- **No gestiona asistencia/check-in**: corresponde a Asistencias (`backend/attendance/*`, `frontend/src/pages/Attendance*.jsx`).
- **No gestiona actividades/salidas/PT agenda**: módulos específicos (Activities/Outings/PersonalTraining).
- **No es config global**: toda la config es **por gimnasio** (`gym_id`).
- **No bloquea por sesiones/paquetes/sellados**: solo por saldo de suscripción mensual.
- **No crea suscripciones**: solo flags/reglas que las afectan.

---

## 21. Bugs/edge cases a vigilar

- **Unidades mixtas**: frontend muestra "días" para cooldown/notice (`schedule_change_cooldown_days`, `schedule_change_notice_days`) mientras backend guarda horas (`schedule_change_cooldown_hours`, `schedule_change_notice_hours`). Hay mapeo en Settings.jsx; mantener coherencia.
- **Campo legacy**: `allow_member_schedule_changes` existe en modelo/migraciones/serializer pero no se ve con uso activo obvio en reglas actuales – documentar tal cual hoy.
- **initial_pending vs bloqueo**: socio nuevo sin primer pago queda bloqueado desde día 1 (aunque llegue después de `payment_due_day`).
- **Conteo combinado**: cambios permanentes+swaps comparten límite mensual – validaciones deben usar mismo conteo (`count_schedule_changes_used_this_month`).
- **Feriados**: `GymClosedDateHolidaysView` trae solo futuros y evita duplicados; si falla API externa puede dar error.
- **PWA manifests**: `resolveManifestHref` hace fetch y cae a fallback si no OK/JSON inválido – comportamiento robusto.
- **Cache gym**: tras `PATCH /api/gyms/me/` se refresca `gym` cache + evento `features:updated` (evita leer payload pre-PATCH).
- **Acceso bloqueado > vencimiento**: validación presente; UI puede mostrar error si inválido.

---

## 22. Mejoras sugeridas

- **Clarificar unidades**: mostrar tooltip "horas" vs "días" según origen, o unificar a una unidad.
- **Validación UI**: reforzar `access_block_day > payment_due_day` con mensaje claro en pestaña Pagos.
- **Documentar `allow_member_schedule_changes`**: confirmar si sigue en uso o marcar legacy.
- **Tooltips explicativos**: aclarar "bloqueo solo por saldo de suscripción mensual", "conteo combinado permanentes+swaps", "fecha de efecto cambios de plan".
- **Consistencia nombres**: mantener mapeo días<->horas explícito en código/comentarios.

