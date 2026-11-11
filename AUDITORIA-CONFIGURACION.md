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

- **`payment_due_day`** (default `10`): día del mes hasta el cual el socio sigue
  "pendiente de pago" pero puede entrenar.
- **`access_block_day`** (default `16`): día desde el cual pasa a bloqueado.
- Ambos se validan entre 1 y 31 en el modelo, y la regla
  `access_block_day > payment_due_day` se valida en el modelo, en el serializer y
  en la pantalla antes de enviar.
- El bloqueo es **sólo por saldo de suscripción mensual**: nunca por sesiones,
  paquetes o sellados. La cortesía no se bloquea por pago.
- Un socio nuevo sin primer pago queda en `initial_pending` y bloqueado desde el
  día 1, aunque el alta ocurra después del día de vencimiento (CFG-03).
- Si el socio estaba bloqueado al cierre del mes, no se renueva solo hasta
  regularizar.

El detalle de estados, deuda y renovación vive en `AUDITORIA-PAGOS.md` y
`AUDITORIA-SUSCRIPCIONES.md`; acá sólo se documenta el valor configurable y su
efecto.

### Referencias
- `backend/gyms/models.py · Gym`
- `backend/gyms/serializers.py · GymSerializer`
- `frontend/src/pages/Settings.jsx · validate`

---

## 4. Planes y horarios

Desde Configuración se gobiernan los **permisos y límites** de los cambios, no el
catálogo de planes:

- **`allow_plan_changes`** (default `true`): habilita el pedido de cambio de plan
  del portal y el flujo de staff.
- **`allow_schedule_changes`** (default `true`): habilita los cambios permanentes y
  los intercambios de horario.
- **`schedule_change_cooldown_hours`** (default `168`): espera mínima entre cambios,
  en horas.
- **`max_schedule_changes_per_month`** (default `4`): límite mensual combinado de
  cambios permanentes e intercambios.
- **`schedule_change_notice_hours`** (default `24`): anticipación mínima para pedir
  un cambio.
- **`allow_member_schedule_changes`** (default `false`): campo legacy que ya no
  gobierna ninguna regla (CFG-02).

El alta de planes y precios vive en `Plans.jsx`; los horarios disponibles (slots) y
su capacidad se gestionan en la pestaña **Planes & Horarios** de Settings y en el
módulo de horarios. El detalle de las reglas de cambio —cooldown, anticipación,
cupo y conteo combinado— está en `AUDITORIA-HORARIOS.md`.

### Referencias
- `backend/gyms/models.py · Gym`
- `backend/gyms/serializers.py · GymSerializer`
- `frontend/src/pages/Settings.jsx · Settings`

---

## 5. Recuperación de clases

La recuperación permite que un socio compensa una clase perdida dentro del mismo
mes, según cupo disponible. Configuración sólo define si está habilitada y cuántas
veces por mes:

- **`allow_session_recovery`** (default `false`): habilita el pedido de recuperación.
- **`max_session_recoveries_per_month`** (default `2`): máximo de recuperaciones por
  mes calendario.

La regla de negocio —qué faltas son recuperables, cómo se aplica el cupo y qué pasa
con el no-show— vive en `AUDITORIA-RECUPERACION.md` y en
`AUDITORIA-ASISTENCIAS.md`. Configuración no otorga ni ejecuta recuperaciones.

### Referencias
- `backend/gyms/models.py · Gym`
- `frontend/src/pages/Settings.jsx · Settings`

---

## 6. Descuentos

Un **descuento** es un porcentaje que el gimnasio asigna a un socio para que pague
menos en su suscripción. Se gestiona desde la pestaña **Pagos**.

- **`name`**: nombre visible del descuento.
- **`discount_percent`**: entero entre 1 y 100; se valida en el modelo y en el
  serializer.
- **`active`**: si se inactiva, deja de aplicarse a los socios asignados y éstos
  vuelven a pagar el precio completo. Los períodos ya emitidos conservan el
  porcentaje con el que se facturaron (cada suscripción guarda su snapshot).

El descuento no se aplica solo: hay que asignarlo en la ficha del socio. El cálculo
del cobro y el snapshot viven en `AUDITORIA-PAGOS.md` y
`AUDITORIA-SUSCRIPCIONES.md`.

**Problema vigente (CFG-16):** la pantalla es owner-only, pero el
`DiscountViewSet` sólo exige autenticación. Cualquier usuario del gimnasio podría
hacer CRUD por API. Se documenta en §18 y se da de alta en `BUGS.md`.

### Referencias
- `backend/gyms/models.py · Discount`
- `backend/gyms/serializers.py · DiscountSerializer`
- `backend/gyms/views.py · DiscountViewSet`
- `frontend/src/pages/Settings.jsx · Settings`

---

## 7. Obras sociales

Una **obra social** (o seguro médico) define cuánto paga el socio por sesión y si
hay un sellado único al inscribirse en un paquete. Se gestiona desde la pestaña
**Obras sociales**.

- **`name`**: nombre de la obra social; único por gimnasio.
- **`session_price`**: coseguro por sesión; `0` significa que la obra social cubre
  la sesión.
- **`sellado_amount`**: monto único opcional al inscribirse en un paquete.
- **`active`**: al inactivarla, se oculta de los selectores y se desvincula al
  volver a cargar la ficha del socio.

En el alta del socio, la obra social se enlaza por nombre; si no hay coincidencia,
queda sin obra social (ver `AUDITORIA-MIEMBROS.md`). El uso en el cobro de sesiones
está en `AUDITORIA-PAGOS.md` y `AUDITORIA-PERSONAL-TRAINING.md`.

**Problema vigente (CFG-16):** igual que en descuentos, el
`HealthInsuranceViewSet` sólo exige autenticación. La restricción de dueño vive
sólo en la UI.

### Referencias
- `backend/members/models.py · HealthInsurance`
- `backend/members/views.py · HealthInsuranceViewSet`
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
