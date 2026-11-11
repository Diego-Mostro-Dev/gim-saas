# Auditoría de Configuración — Qué puede configurar el gimnasio hoy

> Documento descriptivo: **lo que el sistema hace hoy**, verificado contra el código.
> Escrito en lenguaje simple para servir de base a un manual de gimnasios. Las
> referencias de código van aparte, en letra chica, para no ensuciar el texto.
> Cubre la **configuración del gimnasio** (datos básicos, reglas de pago y horarios,
> catálogos auxiliares, SEO, features y PWA). No cubre la operación diaria de cada
> módulo, que vive en su propia auditoría y se enlaza cuando hace falta.
>
> Verificado contra: `f5b4b07`
> Fecha: 2026-11-11
> Alcance: datos básicos del gimnasio, pagos, planes y horarios, recuperación,
> descuentos, obras sociales, fechas cerradas, QR, SEO, features, PWA, staff y
> comunidad. Incluye qué valor aplica cada regla y sus efectos cruzados.
> Documentos relacionados: `AUDITORIA-PAGOS.md`,
> `AUDITORIA-SUSCRIPCIONES.md`, `AUDITORIA-RECUPERACION.md`,
> `AUDITORIA-PLANES.md`, `AUDITORIA-HORARIOS.md`,
> `AUDITORIA-ASISTENCIAS.md`, `AUDITORIA-ADMIN-SAAS.md`,
> `AUDITORIA-COMUNIDAD.md`
> Código cubierto: `backend/gyms`, `backend/config`, `backend/members/models.py`,
> `backend/members/views.py`, `backend/core/permissions.py`,
> `frontend/src/pages/Settings.jsx`,
> `frontend/src/pages/AttendanceQR.jsx`, `frontend/src/pages/Registration.jsx`,
> `frontend/src/hooks/useGym.js`, `frontend/src/services/gym.service.js`
> Tests: `backend/gyms/tests.py`, `backend/gyms/tests_restore.py`
> Estado: en actualización (fases 7.1–7.6)

---

## 1. Idea general y alcance

**Configuración** es la pantalla donde el dueño del gimnasio ajusta los parámetros
que valen para todo el gimnasio: identidad visual, reglas de pago, cambios de
horario, recuperación de clases, catálogos de descuentos y obras sociales, fechas
cerradas, mensajes de QR, SEO y datos de contacto. La mayoría de los valores se
aplican **de inmediato**: no hay que guardar dos veces ni esperar un cierre de mes.

Quién la usa de verdad:

- **Dueño (`owner`)**: único rol que puede ver y guardar la pantalla. La ruta está
  bajo `ProfessorRoute`, que deja pasar owner y staff; dentro de `Settings`, si el
  rol no es `owner`, la pantalla redirige a `/dashboard`.
- **Staff, profesor y entrenador**: no operan Configuración. El staff llega a la
  ruta pero es redirigido; el profesor va a `/routines` y el entrenador a
  `/trainer-agenda` antes de entrar.
- **Admin central**: puede editar los mismos campos desde el panel de plataforma
  (wizard/edición de gimnasios), incluidas las features, que el dueño **no** puede
  cambiar desde Settings.

La pantalla se organiza en pestañas: `Información`, `Pagos`, `Planes & Horarios`,
`Obras sociales`, `Staff`, `Fechas cerradas`, `QR`, `Comunidad` (sólo si la feature
está activa) y `SEO`. La pestaña `Comunidad` se oculta y redirige a `Información`
cuando `gym.features.community` es falso.

Lo que se aplica de inmediato al guardar:

- nombre, logo, ícono, WhatsApp, teléfono y email (identidad y contacto);
- días de vencimiento y bloqueo (estado de pago de los socios);
- flags y límites de cambios de plan/horario y de recuperación;
- mensajes de los QR y datos de SEO;
- alta/edición/baja de descuentos, obras sociales y fechas cerradas (cada acción
  tiene su propio endpoint y no requiere guardar el formulario principal).

La lectura y la escritura no tienen el mismo permiso: `GET /api/gyms/me/` devuelve
toda la configuración a **cualquier usuario autenticado del gimnasio**, mientras que
`PATCH /api/gyms/me/` exige `owner`. El frontend usa esa lectura amplia para que
cualquier rol conozca features, labels y datos de contacto.

### Referencias
- `backend/gyms/models.py · Gym`
- `backend/gyms/views.py · GymMeView`
- `backend/core/permissions.py · require_owner`
- `frontend/src/pages/Settings.jsx · Settings`
- `frontend/src/pages/Settings.jsx · TABS`
- `frontend/src/App.jsx · ProfessorRoute`
- `frontend/src/hooks/useGym.js · useGym`
- `frontend/src/services/gym.service.js · getGym`
- `frontend/src/services/gym.service.js · updateGym`

---

## 2. Datos básicos del gimnasio

Son los campos de identidad y contacto del gimnasio. Se editan en la pestaña
**Información**, salvo `slug`, `active`, `onboarding_code` y `labels`, que no
aparecen en la pantalla.

| Campo | Default | Validación / límite | Efecto |
|---|---|---|---|
| `name` | — | obligatorio, hasta 100 caracteres | Nombre visible en el panel, portal, manifiestos PWA y SEO |
| `slug` | — | único; no se edita desde Settings | Identifica al gimnasio en rutas públicas (por ejemplo, el manifiesto PWA de staff) |
| `active` | `true` | booleano; no se edita desde Settings | Si se apaga, el gimnasio queda inactivo para los flujos públicos y el SEO |
| `whatsapp` | vacío | hasta 30 caracteres | Contacto en portal y datos públicos |
| `phone` | vacío | hasta 30 caracteres | Contacto en portal y datos públicos |
| `email` | vacío | email válido; hasta 254 caracteres | Contacto en portal y SEO |
| `logo` | vacío | imagen opcional en Cloudinary | Logo del panel, portal y SEO |
| `app_icon` | vacío | imagen opcional en Cloudinary | Ícono de instalación PWA y favicon |
| `onboarding_code` | UUID automático | único y no editable | Código de los links públicos de registro/onboarding |
| `labels` | calculadas | sólo lectura | Textos visibles según gimnasio (ver §12) |
| `created_at` | automático | sólo lectura | Fecha de alta del gimnasio |

Cómo funciona el guardado:

- La pantalla envía `multipart/form-data` cuando hay logo o ícono; si no, envía los
  campos de texto igual.
- `GymSerializer` valida el email y los largos del modelo. No valida que `logo` o
  `app_icon` sean imágenes: eso queda a cargo de Cloudinary.
- Cambiar el nombre no cambia el `slug` ni los links públicos.
- El logo y el ícono se pueden reemplazar, pero no borrar desde la pantalla.

Campos derivados (sólo lectura, los calcula el backend):

| Campo | Cómo se arma | Dónde se usa |
|---|---|---|
| `onboarding_url` | `FRONTEND_URL` + `/onboarding/<onboarding_code>` | Compartir el alta guiada del gimnasio |
| `register_url` | `FRONTEND_URL` + `/register/<onboarding_code>` | Registro público de socios y SEO |
| `logo_url` | URL de Cloudinary del logo | Pantalla y portal; `null` si no hay logo |
| `app_icon_url` | URL de Cloudinary del ícono | Ícono de instalación PWA; `null` si no hay ícono |
| `app_icon_favicon_url` | recorte de 64×64 en PNG del ícono | Favicon del navegador; `null` si no hay ícono |

Dos campos no están en la UI y se documentan como limitación en §18:

- **`active` y `slug` son escribibles por API.** `GymSerializer` los expone sin
  `read_only`; la UI no los manda, pero un cliente autenticado como owner podría
  desactivar su propio gimnasio o cambiar el slug y romper las URLs públicas y el
  manifiesto PWA de staff.
- **`allow_activity_without_membership` y `checkin_window_minutes`** no están en
  Settings: el primero es un control de plataforma y el segundo sólo se edita por
  API/admin (ver §18).

### Referencias
- `backend/gyms/models.py · Gym`
- `backend/gyms/serializers.py · GymSerializer`
- `backend/gyms/views.py · PublicGymView`
- `frontend/src/pages/Settings.jsx · Settings`
- `frontend/src/pages/Settings.jsx · buildFormDataFromGym`

---

## 3. Pagos: vencimiento y bloqueo

La configuración de pagos define **cuándo vence** la cuota y **desde cuándo** el
socio queda bloqueado. No crea suscripciones ni cobra: sólo mueve las fechas que
usan Pagos, Suscripciones y el control de acceso.

| Campo | Default | Validación | Efecto |
|---|---|---|---|
| `payment_due_day` | `10` | entero 1–31 | Hasta ese día el socio sigue `pending` pero puede entrenar |
| `access_block_day` | `16` | entero 1–31 y **mayor** que `payment_due_day` | Desde ese día pasa a `blocked` |

La regla `access_block_day > payment_due_day` se valida en tres capas:

- **modelo:** `Gym.clean` levanta `ValidationError` con los dos valores en el
  mensaje;
- **serializer del gimnasio:** `GymSerializer.validate` corta el `PATCH` con un
  `400` claro;
- **admin central:** `AdminGymUpdateSerializer.validate` repite la regla para el
  wizard/edición de plataforma;
- **pantalla:** `Settings.validate` muestra el error antes de enviar y no permite
  guardar.

Efectos (sin repetir las reglas de cada módulo):

- El estado de pago (`paid`, `initial_pending`, `pending`, `overdue`, `blocked`) y
  el bloqueo de acceso se calculan con estos días. Ver `AUDITORIA-PAGOS.md`.
- Un socio nuevo sin primer pago queda en `initial_pending` y bloqueado desde el
  día 1, aunque el alta ocurra después del vencimiento (CFG-03).
- Si estaba bloqueado al cierre del mes, no se renueva solo hasta regularizar. Ver
  `AUDITORIA-SUSCRIPCIONES.md`.
- El bloqueo es **sólo por saldo de suscripción mensual**: nunca por sesiones,
  paquetes o sellados. La cortesía no se bloquea por pago.
- La recuperación de clases no se habilita ni se bloquea por estos días; depende de
  `allow_session_recovery` (§5) y del estado del socio en
  `AUDITORIA-RECUPERACION.md`.

### Referencias
- `backend/gyms/models.py · Gym`
- `backend/gyms/serializers.py · GymSerializer`
- `backend/admins/serializers.py · AdminGymUpdateSerializer`
- `frontend/src/pages/Settings.jsx · validate`
- `frontend/src/pages/Settings.jsx · buildFormDataFromGym`

---

## 4. Planes y horarios

Desde Configuración se gobiernan los **permisos y límites** de los cambios, no el
catálogo de planes ni la grilla de actividades.

| Campo | Default | Unidad | Efecto |
|---|---|---|---|
| `allow_plan_changes` | `true` | booleano | Habilita el pedido de cambio de plan del portal y el flujo de staff |
| `allow_schedule_changes` | `true` | booleano | Habilita cambios permanentes e intercambios de horario |
| `schedule_change_cooldown_hours` | `168` | horas | Espera mínima entre cambios |
| `max_schedule_changes_per_month` | `4` | cambios/mes | Límite mensual **combinado** de permanentes e intercambios |
| `schedule_change_notice_hours` | `24` | horas | Anticipación mínima para pedir un cambio |
| `allow_member_schedule_changes` | `false` | booleano | Campo legacy que ya no gobierna ninguna regla (CFG-02) |

Qué se edita en cada pantalla:

- **Settings → Información**: `default_schedule_capacity`, la capacidad propuesta
  para los slots nuevos.
- **Settings → Planes & Horarios**: los flags y límites de arriba, más el alta,
  edición y borrado de los horarios del gimnasio (slots) con su capacidad.
- **`Plans.jsx`**: catálogo de planes, precios, visitas semanales y servicios. No se
  edita desde Configuración.
- **`Activities.jsx` y `ActivitySchedules.jsx`**: actividades y sus horarios. No se
  editan desde Configuración.
- **`ScheduleChangeRequests.jsx` y `ScheduleSwapRequests.jsx`**: aprobación y
  rechazo de los pedidos; usan los límites configurados acá.

Los límites se aplican igual al socio y al staff: cooldown, anticipación, cupo y
conteo combinado de permanentes (`pending`/`approved`/`executed`) más intercambios
(`pending`/`approved`) del mes calendario. El detalle de las reglas y el conteo
compartido están en `AUDITORIA-HORARIOS.md`; el efecto sobre el cobro y el cambio de
plan, en `AUDITORIA-PLANES.md` y `AUDITORIA-SUSCRIPCIONES.md`.

### Referencias
- `backend/gyms/models.py · Gym`
- `backend/gyms/serializers.py · GymSerializer`
- `backend/attendance/utils.py · check_schedule_change_limits`
- `backend/attendance/utils.py · count_schedule_changes_used_this_month`
- `frontend/src/pages/Settings.jsx · validate`
- `frontend/src/pages/Settings.jsx · TABS`

---

## 5. Recuperación de clases

La recuperación permite que un socio compense una clase perdida dentro del mismo
mes, según cupo disponible. Configuración sólo define si está habilitada y cuántas
veces por mes:

| Campo | Default | Unidad | Efecto |
|---|---|---|---|
| `allow_session_recovery` | `false` | booleano | Habilita el pedido y la ejecución de recuperaciones |
| `max_session_recoveries_per_month` | `2` | recuperaciones/mes | Tope por socio y mes calendario |

Reglas que se aplican al ejecutar:

- Si `allow_session_recovery` está apagado, el servicio rechaza la recuperación con
  un mensaje de dominio, aunque el socio tenga una falta recuperable.
- El tope mensual se cuenta sobre las recuperaciones ya otorgadas en el mes; al
  llegar al límite, el pedido se rechaza.
- La recuperación consume cupo del horario de destino y no puede caer en una fecha
  cerrada ni superponerse con otra clase del socio.
- Los cupos y la grilla de destinos son los de los horarios del gimnasio; su
  administración está en la pestaña **Planes & Horarios**.

El detalle de qué falta es recuperable, cómo se otorga y qué pasa con el no-show
vive en `AUDITORIA-RECUPERACION.md` y `AUDITORIA-ASISTENCIAS.md`. Configuración no
otorga ni ejecuta recuperaciones.

### Referencias
- `backend/gyms/models.py · Gym`
- `backend/attendance/recovery_service.py · grant_scheduled`
- `backend/attendance/recovery_service.py · use_recovery`
- `frontend/src/pages/Settings.jsx · Settings`

---

## 6. Descuentos

Un **descuento** es un porcentaje que el gimnasio asigna a un socio para que pague
menos en su suscripción. Se gestiona desde la pestaña **Pagos**: listar, crear,
editar y borrar.

| Campo | Default | Validación | Efecto |
|---|---|---|---|
| `name` | — | obligatorio, hasta 100 caracteres | Nombre visible del descuento |
| `discount_percent` | — | entero 1–100 (modelo y serializer) | Porcentaje que se resta al precio del socio |
| `active` | `true` | booleano | Si se inactiva, se desvincula de los socios asignados |

Cómo se usa en el cobro:

- El descuento no se aplica solo: hay que asignarlo en la ficha del socio.
- El porcentaje vigente se lee al emitir el período y se guarda como
  `discount_percent_snapshot` en la suscripción. Por eso, inactivar o cambiar el
  porcentaje **no reescribe** los períodos ya emitidos.
- Al inactivar, los socios asignados vuelven a pagar el precio completo en el
  próximo período; los períodos anteriores conservan su snapshot.
- El descuento aplica sobre el total de la suscripción (incluido el prorrateo).
  El detalle de cálculo y deuda está en `AUDITORIA-PAGOS.md` y
  `AUDITORIA-SUSCRIPCIONES.md`.

**Problema vigente (CFG-16):** la pantalla es owner-only, pero el
`DiscountViewSet` sólo exige autenticación (el filtro por gimnasio lo pone
`GymQuerysetMixin`). Cualquier usuario del gimnasio podría hacer CRUD por API. Se
documenta en §18 y se da de alta en `BUGS.md`.

### Referencias
- `backend/gyms/models.py · Discount`
- `backend/gyms/serializers.py · DiscountSerializer`
- `backend/gyms/views.py · DiscountViewSet`
- `backend/subscriptions/services.py · member_discount_percent`
- `frontend/src/pages/Settings.jsx · Settings`

---

## 7. Obras sociales

Una **obra social** (o seguro médico) define cuánto paga el socio por sesión y si
hay un sellado único al inscribirse en un paquete. Se gestiona desde la pestaña
**Obras sociales**: listar, crear, editar y borrar.

| Campo | Default | Validación | Efecto |
|---|---|---|---|
| `name` | — | obligatorio, hasta 120 caracteres, **único por gimnasio** | Nombre que se muestra y se enlaza en la ficha del socio |
| `session_price` | `0` | decimal ≥ 0 | Coseguro que paga el socio por cada sesión |
| `sellado_amount` | vacío | decimal ≥ 0 opcional | Monto único al inscribirse en un paquete de sesiones |
| `active` | `true` | booleano | Al inactivarla se oculta de los selectores y se desvincula |

Cómo se usa:

- El alta del socio guarda el **nombre** de la obra social en el campo de texto
  `Member.health_insurance`; el vínculo con el catálogo es por nombre normalizado.
- Si el nombre no coincide con ninguna obra social activa, el socio queda con el
  texto cargado pero sin obra social vinculada.
- Al renombrar una obra social, una señal actualiza el texto de los socios que
  tenían el nombre anterior; al inactivarla, los socios se desvinculan al volver a
  guardar su ficha.
- `session_price` y `sellado_amount` se usan en el cobro de actividades y paquetes
  en modo sesiones (incluido personal training). El detalle de precios y sellados
  está en `AUDITORIA-PAGOS.md` y `AUDITORIA-PERSONAL-TRAINING.md`.

**Problema vigente (CFG-16):** igual que en descuentos, el
`HealthInsuranceViewSet` sólo exige autenticación. La restricción de dueño vive
sólo en la UI.

### Referencias
- `backend/members/models.py · HealthInsurance`
- `backend/members/serializers.py · HealthInsuranceSerializer`
- `backend/members/views.py · HealthInsuranceViewSet`
- `backend/members/insurance.py · relink_members_for_insurance`
- `backend/members/signals.py · _relink_members_on_insurance_save`
- `frontend/src/pages/Settings.jsx · Settings`

---

## 8. Fechas cerradas y feriados

Una **fecha cerrada** es un día en el que el gimnasio no abre. Se usa para bloquear
asistencia, recuperaciones e intercambios y para mostrar avisos en el portal.

- La unicidad es `(gym, date)`: no se puede cargar dos veces la misma fecha.
- Se pueden cargar fechas puntuales con un motivo libre.
- La carga masiva de **feriados de Argentina** trae el año pedido (o el actual si no
  se envía), agrega sólo fechas **futuras**, saltea las que ya existen y devuelve
  `502` si la API externa falla. La respuesta informa cuántas se crearon y cuántas
  se saltearon por pasadas o duplicadas.
- Los días cerrados se excluyen de la asistencia y de la recuperación; el portal
  muestra el próximo cierre con labels por gimnasio.

### Referencias
- `backend/gyms/models.py · GymClosedDate`
- `backend/gyms/views.py · GymClosedDateListCreateView`
- `backend/gyms/views.py · GymClosedDateDetailView`
- `backend/gyms/views.py · GymClosedDateHolidaysView`
- `backend/gyms/holidays.py · fetch_argentina_holidays`
- `frontend/src/pages/Settings.jsx · Settings`

---

## 9. Horarios del gimnasio y cupos

Los **horarios del gimnasio** (slots) son los bloques semanales a los que el socio
se anota para asistir. Se gestionan en la pestaña **Planes & Horarios** y en la
pantalla de asistencia.

- Cada slot tiene día, hora, duración y capacidad opcional.
- **`default_schedule_capacity`** (default vacío): capacidad que se propone al crear
  un slot; si queda vacía, el slot no tiene cupo definido.
- El cupo real se controla al asignar horarios, al cambiar de horario y al registrar
  asistencia.
- Los slots no tienen un gate de rol propio: los endpoints de `ScheduleSlot` sólo
  exigen autenticación. El detalle y el hueco de permisos están en
  `AUDITORIA-HORARIOS.md` §4.

### Referencias
- `backend/gyms/models.py · Gym`
- `backend/attendance/models.py · ScheduleSlot`
- `backend/attendance/views.py · ScheduleSlotListCreateView`
- `backend/attendance/views.py · ScheduleSlotDetailView`
- `backend/attendance/views.py · ScheduleSlotBulkCreateView`
- `frontend/src/pages/Settings.jsx · Settings`

---

## 10. QR y mensajes

Configuración permite personalizar los dos carteles que el gimnasio imprime y pega
en recepción. Cada uno acompaña a un código QR distinto:

- **`qr_attendance_message`** (default "Marcá tu asistencia escaneando este código"):
  texto del cartel de asistencia. Se muestra en la pantalla de asistencia QR del
  gimnasio (`/attendance-qr`) y en la vista pública de check-in.
- **`qr_registration_message`** (default "Registrate como socio escaneando este
  código"): texto del cartel de registro. Se muestra en la pantalla de registro
  (`/registration`) y en el alta pública.

Ambos son `CharField` de hasta 120 caracteres y aceptan vacío (si se borra el texto,
el cartel queda sin mensaje). No dependen de ninguna feature: están siempre
disponibles para el owner. El QR en sí lo genera el frontend; Configuración sólo
guarda el texto.

La pestaña **QR** también ofrece dos accesos directos: "Registro de miembros" y
"Asistencia QR", que navegan a esas pantallas. No generan ni descargan el código.

### Referencias
- `backend/gyms/models.py · Gym`
- `backend/gyms/serializers.py · GymSerializer`
- `frontend/src/pages/Settings.jsx · Settings`
- `frontend/src/pages/AttendanceQR.jsx · AttendanceQR`
- `frontend/src/pages/Registration.jsx · Registration`

---

## 11. SEO

Cada gimnasio puede completar datos para aparecer mejor en Google y en las
vistas previas al compartir su link de registro. Se editan en la pestaña **SEO**:

- `seo_title`, `seo_description`, `seo_keywords`, `seo_city`, `seo_address` y
  `seo_hours`.
- Si `seo_title` o `seo_description` están vacíos, el endpoint público arma un
  título y una descripción por defecto con el nombre del gimnasio.
- El endpoint público `GET /api/gyms/public/seo/<onboarding_code>/` devuelve nombre,
  logo, imagen Open Graph, título, descripción, keywords, ciudad, dirección,
  horarios, contacto, link de registro, canonical y estado `active`.
- El HTML indexable lo sirve la función serverless de Vercel que consume ese
  endpoint.

El detalle de plataforma está en `AUDITORIA-ADMIN-SAAS.md`.

### Referencias
- `backend/gyms/models.py · Gym`
- `backend/gyms/views.py · GymSeoView`
- `frontend/src/pages/Settings.jsx · Settings`

---

## 12. Features

Las **features** son banderas de negocio por gimnasio que habilitan o deshabilitan
módulos completos. El catálogo y la regla de comunidad viven en
`backend/gyms/features.py`.

- `FEATURE_CATALOG` define las features disponibles.
- `require_community` protege las acciones de comunidad cuando la feature está
  apagada.
- Las features condicionan rutas, pestañas y avisos del frontend, además de los
  manifiestos y labels.

**Importante:** `GymSerializer.features` es **read-only**. El dueño no puede
cambiarlas desde Settings ni desde el panel del gimnasio: sólo las modifica el admin
central a través de `AdminGymUpdateSerializer` y el wizard de gimnasios. La pestaña
**Comunidad** aparece sólo cuando `gym.features.community` es verdadero.

Las **labels** (`DEFAULT_LABELS` + `SINKRO_LABELS`) son textos visibles calculados
por gimnasio; tampoco se editan desde Settings.

### Referencias
- `backend/gyms/features.py · FEATURE_CATALOG`
- `backend/gyms/features.py · require_community`
- `backend/gyms/labels.py · DEFAULT_LABELS`
- `backend/gyms/labels.py · SINKRO_LABELS`
- `backend/gyms/labels.py · get_gym_labels`
- `backend/gyms/serializers.py · GymSerializer`
- `frontend/src/pages/Settings.jsx · TABS`

---

## 13. PWA

El gimnasio tiene dos manifiestos de aplicación instalable:

- **Socio:** `GET /api/gyms/pwa/member/<token>/manifest/`. Usa el nombre del
  gimnasio, un `short_name` recortado, la descripción "Portal del socio de …" y el
  ícono del gimnasio (o los íconos genéricos de la plataforma).
- **Staff:** `GET /api/gyms/pwa/staff/<slug>/manifest/`. Usa el nombre del gimnasio,
  la descripción "Sistema de gestión para gimnasios" y `start_url` en `/`.

Ambos son públicos, devuelven `application/manifest+json`, comparten scope `/`,
`display: standalone`, colores y orientación. El ícono se recorta a 192×192 y
512×512; si el gimnasio no cargó `app_icon`, se usan los PNG genéricos de la
plataforma.

### Referencias
- `backend/gyms/views.py · PwaMemberManifestView`
- `backend/gyms/views.py · PwaStaffManifestView`
- `backend/gyms/views.py · _build_pwa_manifest`
- `backend/gyms/urls.py · urlpatterns`

---

## 14. Staff

La pestaña **Staff** permite al dueño dar de alta usuarios del gimnasio, cambiarles
el rol y eliminarlos. No crea socios: eso es el alta de miembros.

- Roles que se pueden asignar: `staff`, `professor` y `trainer`. El rol `owner` no
  se asigna desde acá.
- El alta exige usuario y contraseña; el email, teléfono, WhatsApp y género son
  opcionales (el WhatsApp es obligatorio para entrenadores).
- No se puede eliminar ni cambiar el rol del dueño, ni eliminarse a sí mismo.
- Todas las acciones de escritura exigen `require_owner`; la lectura de la lista
  está disponible para cualquier autenticado del gimnasio.

### Referencias
- `backend/gyms/views.py · GymStaffView`
- `backend/gyms/views.py · GymStaffDetailView`
- `backend/core/permissions.py · require_owner`
- `frontend/src/pages/Settings.jsx · Settings`

---

## 15. Comunidad

La pestaña **Comunidad** aparece sólo si `gym.features.community` está activa. Desde
ahí el owner gestiona los locales adheridos y sus beneficios. Configuración no
define el beneficio ni lo aplica a un cobro: eso vive en el módulo de comunidad.

Si la feature se apaga, la pestaña desaparece y un acceso directo con
`?tab=comunidad` vuelve a `Información`. El backend protege las acciones con
`require_community`.

### Referencias
- `backend/gyms/features.py · require_community`
- `frontend/src/pages/Settings.jsx · TABS`
- `frontend/src/pages/CommunityPanel.jsx · CommunityPanel`

---

## 16. Efectos cruzados

| Valor de Configuración | Módulo afectado | Efecto |
|---|---|---|
| `payment_due_day`, `access_block_day` | Pagos, Suscripciones, Asistencias | Definen `pending`/`blocked`, el bloqueo de acceso y el corte de renovación |
| `allow_plan_changes` | Planes, Suscripciones, portal | Habilita el pedido de cambio de plan y su aprobación |
| `allow_schedule_changes`, `schedule_change_*`, `max_schedule_changes_per_month` | Horarios, Asistencias | Habilitan y limitan cambios permanentes e intercambios |
| `allow_session_recovery`, `max_session_recoveries_per_month` | Recuperación, Asistencias | Habilitan y limitan recuperaciones |
| `default_schedule_capacity` | Horarios, Asistencias | Capacidad propuesta y control de cupo |
| `Discount` | Pagos, Suscripciones | Porcentaje que se aplica al precio de la suscripción |
| `HealthInsurance` | Pagos, Personal Training | Coseguro por sesión y sellado del paquete |
| `GymClosedDate` | Asistencias, Recuperación, portal | Bloquea asistencia, intercambios y avisos de cierre |
| `features` | Rutinas, Actividades, PT, Salidas, Comunidad | Habilitan o apagan módulos, rutas y pestañas |
| `labels` | Todo el frontend | Vocabulario visible por gimnasio |
| `seo_*` | SEO público | HTML indexable y vista previa al compartir |
| `logo`, `app_icon`, `name` | PWA, SEO, panel, portal | Identidad visual e íconos de instalación |
| `qr_*_message` | Asistencia QR, Registro | Texto de los carteles imprimibles |

Las reglas completas de cada destino están en las auditorías enlazadas en la
cabecera; esta tabla sólo resume qué valor toca qué módulo.

### Referencias
- `backend/gyms/models.py · Gym`
- `backend/gyms/features.py · FEATURE_CATALOG`
- `backend/gyms/labels.py · get_gym_labels`

---

## 17. Lo que el sistema NO hace

- **No gestiona planes ni precios**: el CRUD vive en el módulo Planes.
- **No gestiona suscripciones, cobros ni pagos**: eso es Pagos/Suscripciones.
- **No registra asistencia ni check-in**: eso es Asistencias.
- **No gestiona actividades, salidas ni agenda de personal training**: cada módulo
  tiene su pantalla.
- **No crea socios**: el alta está en Miembros/Registro.
- **No activa ni desactiva features**: eso lo hace el admin central.
- **No edita labels**: se calculan por gimnasio.
- **No edita `slug`, `active`, `onboarding_code` ni `created_at` desde la UI**.
- **No bloquea por sesiones, paquetes o sellados**: el bloqueo es sólo por saldo de
  suscripción mensual.
- **No reembolsa, no cobra online ni manda recordatorios**: ver `AUDITORIA-PAGOS.md`.

---

## 18. Problemas y limitaciones

Problemas vigentes que se documentan sin arreglar en esta fase:

- **CFG-16 (MEDIO): descuentos y obras sociales sin gate de rol en el backend.**
  La UI es owner-only, pero `DiscountViewSet` y `HealthInsuranceViewSet` sólo exigen
  autenticación. Cualquier usuario del gimnasio podría hacer CRUD por API. Se da de
  alta en `BUGS.md`.
- **CFG-17 (BAJO): `active` y `slug` son escribibles por API.** `GymSerializer` no
  los marca como `read_only`. La UI no los envía, pero un cliente podría
  auto-desactivar el gimnasio o cambiar el slug y romper URLs públicas y el
  manifiesto PWA de staff. Se da de alta en `BUGS.md`.
- **Campos fuera de la UI.** `allow_activity_without_membership` es un control de
  plataforma que el owner igual podría cambiar por API vía `GymMeView.patch`;
  `checkin_window_minutes` sólo se edita por API/admin.
- **Lectura amplia de la configuración.** `GymMeView.get` devuelve toda la
  configuración a cualquier autenticado del gimnasio. Es intencional para que el
  frontend conozca features y labels, pero incluye datos que no todos los roles
  necesitan.
- **Slots sin gate de rol.** Los endpoints de `ScheduleSlot` sólo exigen
  autenticación; el caso está documentado en `AUDITORIA-HORARIOS.md` §4.
- **Unidades en horas.** El backend guarda cooldown y anticipación en horas; la UI
  también. No quedan conversiones a días (CFG-01 cerrado).
- **Feriados dependientes de una API externa.** Si la API de feriados falla, la carga
  masiva devuelve `502` con mensaje y no crea fechas.

---

## 19. Decisiones de negocio

- **CFG-02:** `allow_member_schedule_changes` sigue existiendo como campo legacy pero
  ya no gobierna ninguna regla. No se elimina en esta fase.
- **CFG-03:** un socio nuevo sin primer pago queda en `initial_pending` y bloqueado
  desde el día 1. Es una decisión de negocio, no un bug.
- **Bloqueo sólo por suscripción mensual:** la deuda de sesiones, paquetes o
  sellados no bloquea el acceso.
- **Cortesía sin bloqueo por pago:** los socios de cortesía no se bloquean por falta
  de pago.
- **`session_price = 0` permitido:** una obra social puede cubrir la sesión.
- **Features sólo desde el admin central:** el gimnasio no puede auto-habilitarse
  módulos.
- **Labels sólo por configuración de plataforma:** el gimnasio no edita sus textos.

---

## 20. Notas de entorno

- `backend/gyms` tiene migraciones `0001` a `0032`; la última incorpora
  `checkin_window_minutes`.
- La suite propia vive en `backend/gyms/tests.py` y `backend/gyms/tests_restore.py`
  (restauración de backups). No hay tests en `backend/config`: ese paquete sólo
  contiene settings, URLs y utilidades de API.
- El seed de demo crea gimnasios, planes, socios y configuración; ver
  `AUDITORIA-SEED-DEMO.md`.
- `frontend/src/dev/SettingsFlow.jsx` es una pantalla de desarrollo para recorrer el
  flujo; no se usa en producción. Se actualiza en la fase 7.5.
- La validación de referencias se corre con
  `python3 scripts/check_audit_refs.py AUDITORIA-*.md`.

### Referencias
- `backend/gyms/migrations/0032_gym_checkin_window_minutes.py`
- `backend/gyms/tests.py`
- `backend/gyms/tests_restore.py`
