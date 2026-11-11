# Auditoría de Comunidad — Cómo funciona hoy la comunidad de descuentos

> Documento descriptivo: **lo que el sistema hace hoy**, verificado contra el código.
> Escrito en lenguaje simple para servir de base a un manual de gimnasios. Las
> referencias de código van aparte, en letra chica, para no ensuciar el texto.
> Cubre **la comunidad de descuentos** (los locales adheridos que ofrecen beneficios a
> los socios). No confundir con las **rutinas** (ver `AUDITORIA-RUTINAS.md`) ni con el
> **portal del socio** en general (ver `AUDITORIA-MIEMBROS.md`).
>
> Verificado contra: `f5b4b07`
> Fecha: 2026-11-11
> Alcance: alta, edición y baja lógica de locales adheridos; feature flag;
> tarjeta pública del socio y sus accesos por token. No cubre cobros ni el
> resto del portal, salvo cuando impactan en la tarjeta.
> Documentos relacionados: `AUDITORIA-NUCLEO-REGLAS.md`,
> `AUDITORIA-MIEMBROS.md`, `AUDITORIA-USUARIOS-ACCESOS.md`,
> `AUDITORIA-RUTINAS.md`
> Código cubierto: `backend/community`, `backend/core/permissions.py`,
> `backend/core/admin.py`, `backend/gyms/features.py`,
> `backend/members/models.py`, `backend/subscriptions/domain.py`,
> `backend/config/api/throttles.py`,
> `frontend/src/pages/CommunityPanel.jsx`,
> `frontend/src/pages/Settings.jsx`,
> `frontend/src/pages/member/MemberCommunity.jsx`,
> `frontend/src/pages/member/CommunityPublicPage.jsx`
> Tests: `backend/community/tests.py`
> Estado: verificado

---

## 1. Qué es la comunidad de descuentos (y qué no)

La **comunidad de descuentos** es un programa del gimnasio: locales comerciales del
barrio (cafeterías, indumentaria, kinesiología, etc.) adheridos al gimnasio que ofrecen
un **beneficio** a los socios. Cada local se carga en el panel con su nombre, categoría,
dirección, contacto y el beneficio que ofrece (texto libre: "10% de descuento", "2x1",
"$500", etc.).

El socio, en su portal, ve su **tarjeta de comunidad**: un QR y la lista de locales con
sus beneficios. La muestra en el local (en el celular o impresa) y accede al beneficio
**presentando su nombre**, sin que el gimnasio tenga que emitir un cupón.

Lo que **NO** es la comunidad de descuentos:

- **No es un descuento de cobro.** El `discount` del local es informativo: no participa
  de ningún cálculo de la facturación del gimnasio. El descuento porcentual que sí
  factura es otro (`Member.discount`, un FK a `Discount`).
- **No es el portal del socio.** La tarjeta de comunidad es una parte del portal, no el
  portal entero (que incluye rutina, pagos, deuda, asistencia, etc.).
- **No es un local del gimnasio.** Son comercios externos. El gimnasio sólo mantiene el
  listado y el beneficio.

### Referencia
- App: `backend/community`, registrada en `backend/config/settings.py` y montada
  en `backend/config/urls.py` con el prefijo `api/community/`.
- Panel: `frontend/src/pages/CommunityPanel.jsx`, embebido en la pestaña
  "Comunidad" de `frontend/src/pages/Settings.jsx`.
- Portal: `frontend/src/pages/member/MemberCommunity.jsx` (tarjeta dentro del
  portal) y `frontend/src/pages/member/CommunityPublicPage.jsx` (página standalone
  `/comunidad/:token`).

---

## 2. El modelo

Una sola tabla: **`CommunityBusiness`** (local adherido).

| Campo | Qué guarda |
|-------|-----------|
| `gym` | El gimnasio dueño del listado (un local pertenece a un gimnasio). |
| `name` | Nombre del local. **Único por gimnasio entre locales activos.** |
| `category` | Categoría / tipo (texto libre, ej: "Cafetería"). |
| `address` | Dirección (texto libre). |
| `contact` | Teléfono / WhatsApp (texto libre). |
| `discount` | El beneficio. **Obligatorio, no puede estar vacío.** Texto libre. |
| `description` | Descripción / condiciones (texto libre, opcional). |
| `active` | Baja lógica: `True` mientras está adherido, `False` al darlo de baja. |

La unicidad de `name` **sí está en la base**: un índice único parcial
`(gym, name) WHERE active=True` (`uniq_community_business_name_per_gym`). Un
local dado de baja libera su nombre; puede haber varios locales inactivos con
el mismo nombre.

El `discount` es obligatorio y no acepta vacío ni sólo espacios. Es **texto
libre** y no se interpreta como porcentaje ni como monto: no toca la
facturación.

### Referencia
- Modelo: `backend/community/models.py · CommunityBusiness`.
- Constraint: `backend/community/models.py · CommunityBusiness.Meta`
  (`uniq_community_business_name_per_gym`), migración
  `backend/community/migrations/0002_communitybusiness_active_and_more.py`.
- Baja lógica: `backend/community/models.py · CommunityBusiness.delete`.
- Validación del beneficio: `backend/community/serializers.py · CommunityBusinessSerializer`.

---

## 3. El interruptor: la feature "Comunidad"

La comunidad es un **add-on** del gimnasio. Se habilita con el flag `community` en
`gym.features`. Si está apagada:

- El panel no muestra la pestaña "Comunidad".
- Los endpoints de gestión (`/api/community/businesses/...`) y el público
  (`/api/community/public/<token>/`) responden **403** con un error de feature
  deshabilitado (`code: FEATURE_DISABLED`).

Es decir: un gimnasio que no ofrece el programa no ve nada de esto.

### Referencia
- Flag: `backend/gyms/features.py · FEATURE_COMMUNITY`,
  `backend/gyms/features.py · community_enabled`,
  `backend/gyms/features.py · require_community`.
- Guard backend de gestión: `backend/community/views.py · CommunityGuardMixin`.
- Guard backend público: `backend/community/public_views.py · PublicMemberCommunityView`.
- Guard frontend: `frontend/src/pages/Settings.jsx` (pestaña condicionada a
  `communityEnabled`).

---

## 4. Los dos flujos

### 4.1 Gestión (el dueño) — autenticado

Sólo el **dueño** del gimnasio gestiona los locales. El staff no puede crear, editar ni
dar de baja (recibe **403**).

| Acción | Endpoint | Quién |
|--------|----------|-------|
| Listar locales activos | `GET /api/community/businesses/` | Cualquier usuario autenticado del gym |
| Crear local | `POST /api/community/businesses/` | Sólo el dueño |
| Editar local | `PATCH /api/community/businesses/<id>/` | Sólo el dueño |
| Dar de baja | `DELETE /api/community/businesses/<id>/` | Sólo el dueño |

Detalles:

- El listado sólo muestra locales **activos** y está abierto a cualquier usuario
  autenticado del gimnasio, no sólo al dueño. Es información del programa, no
  un dato sensible.
- Crear o editar con un nombre ya usado por otro local activo del mismo gimnasio
  devuelve **400** ("Ya existe un local adherido con ese nombre"). La carrera
  entre dos altas simultáneas también termina en **400**: el constraint de la
  base dispara `IntegrityError` y la vista lo traduce.
- Dar de baja **no borra**: marca `active=False` (baja lógica) y devuelve 204. El local
  deja de aparecer en el listado y en la tarjeta del socio. Volver a crear un local con
  el mismo nombre después de la baja funciona.
- El detalle de un local inactivo da **404**: la vista filtra `active=True`.

### Referencia
- Vistas: `backend/community/views.py · CommunityBusinessView`,
  `backend/community/views.py · CommunityBusinessDetailView`.
- Permiso: `backend/core/permissions.py · require_owner`.
- Unicidad y carrera: `backend/community/models.py · CommunityBusiness.Meta`,
  `backend/community/views.py · CommunityBusinessView`,
  `backend/community/views.py · CommunityBusinessDetailView`.
- Scoping por gym: `backend/core/mixins.py · GymQuerysetMixin`.
- Serializer: `backend/community/serializers.py · CommunityBusinessSerializer`.

### 4.2 Tarjeta pública (el socio) — sin login, por token

El socio accede a su tarjeta **sin usuario ni contraseña**, con el **token de su portal**
(el mismo que usa para todo el portal). La tarjeta muestra su nombre, el gimnasio y los
locales activos con sus beneficios. No expone ningún otro dato del portal: ni
teléfono, ni pagos, ni deuda.

- El endpoint es público (`permission_classes = []`) y está protegido con dos throttles:
  uno general por IP y otro por token del portal.
- El token acepta también la **generación anterior** (para no romper un QR ya impreso
  cuando el portal rota el token). Un token de dos rotaciones atrás queda invalidado.
- **Un socio inactivo sigue viendo su tarjeta.** Es una decisión de negocio: todo el
  portal del socio es accesible a socios inactivos a propósito (por ejemplo, para subir un
  comprobante que destrabe un acceso suspendido). La tarjeta de comunidad no es un dato
  sensible y no se bloquea.
- **Un socio eliminado ya no ve su tarjeta.** La baja lógica del socio
  (`deleted_at`) lo saca del manager de socios vivos, así que su token da **404**.
  Inactivo y eliminado son estados distintos: inactivo conserva el acceso al
  portal; eliminado no.
- El gimnasio de la tarjeta se resuelve por la **suscripción activa** del socio y,
  si no hay, por `member.gym` (`SubscriptionDomain.resolve_gym`).
- Si la feature `community` está apagada en ese gimnasio, la tarjeta responde 403
  con `FEATURE_DISABLED`.

### Referencia
- Vista pública: `backend/community/public_views.py · PublicMemberCommunityView`.
- Resolución del socio por token: `backend/members/models.py · portal_member_or_404`,
  `backend/members/models.py · resolve_public_portal_member`,
  `backend/members/models.py · portal_token_q`.
- Baja lógica del socio: `backend/members/models.py · Member.soft_delete`,
  `backend/members/models.py · AliveMemberManager`.
- Gimnasio de la tarjeta: `backend/subscriptions/domain.py · SubscriptionDomain.resolve_gym`.
- Throttles: `backend/config/api/throttles.py · PublicMemberRateThrottle`,
  `backend/config/api/throttles.py · MemberPortalTokenThrottle`.
- Feature: `backend/gyms/features.py · require_community`.

---

## 5. Qué se ve en pantalla

- **Panel (dueño):** pestaña "Comunidad" de Configuración. Lista los locales activos con
  nombre, categoría, dirección, contacto y beneficio. Permite crear, editar y eliminar
  (baja lógica). Se muestra sólo si la feature está activa; la pantalla de Configuración
  es sólo para el dueño.
- **Portal del socio:** pestaña "Comunidad" con un **QR** y la lista de locales. El QR
  apunta a la página standalone `/comunidad/<token>`, que el socio puede mostrar en el
  local sin necesidad de abrir el portal.
- **Admin Django:** `CommunityBusiness` está registrado para inspección. El admin está
  **recortado por gimnasio** (`GymScopedAdminMixin`): un usuario con acceso al admin sólo
  ve los locales de su gimnasio; el superusuario central ve todo (REF-08).

### Referencia
- Panel: `frontend/src/pages/CommunityPanel.jsx`,
  `frontend/src/services/community.service.js`.
- Portal: `frontend/src/pages/member/MemberCommunity.jsx`,
  `frontend/src/pages/member/CommunityPublicPage.jsx`.
- Rutas: `frontend/src/App.jsx` (`/portal/comunidad`, `/comunidad/:token`).
- Guard de Configuración: `frontend/src/App.jsx · ProfessorRoute`;
  `frontend/src/pages/Settings.jsx` (redirige a los roles que no son dueño).
- Admin: `backend/community/admin.py · CommunityBusinessAdmin`,
  `backend/core/admin.py · GymScopedAdminMixin`.

---

## 6. Estados y casos borde

| Situación | Qué pasa hoy |
|-----------|--------------|
| Local dado de baja | No aparece en el panel ni en la tarjeta; la fila se conserva (`active=False`). El detalle da 404. |
| Nombre repetido (mismo gym, activo) | 400 con mensaje de dominio. |
| Nombre de un local dado de baja | Se puede reusar (el constraint sólo mira activos). |
| `discount` vacío o en blanco | 400 con mensaje de dominio. |
| Feature `community` apagada | El panel no aparece y los endpoints dan 403 `FEATURE_DISABLED`. |
| Staff intenta crear/editar/eliminar | 403 (sólo el dueño); el listado sí lo puede leer. |
| Staff intenta listar | **Funciona** (sólo pide login). |
| Socio **inactivo** abre su tarjeta | **Funciona** (decisión de negocio, como todo el portal; COM-01). |
| Socio **eliminado** abre su tarjeta | **404**: el token deja de resolver (ACC-20). |
| QR viejo tras rotación de token | Funciona una generación (gracia de un token anterior; ACC-18). |
| Token de dos rotaciones atrás | 404 (la gracia es de una sola generación). |
| Token inexistente | 404. |

---

## 7. Lo que el sistema NO hace hoy (para no prometerlo en el manual)

- **Decisión: no emite cupones ni códigos.** El socio accede al beneficio
  presentando su tarjeta y su nombre; no hay código de descuento ni canje
  registrado.
- **Decisión: el `discount` es informativo.** No participa de la facturación ni
  se convierte en un descuento de cobro (COM-02).
- **Limitación: el `discount` es texto libre.** Acepta cualquier frase de hasta
  120 caracteres; no se valida que sea un porcentaje, un monto o un formato
  concreto.
- **Limitación: el QR viejo caduca tras una rotación.** La gracia es de una
  generación; un QR impreso con un token anterior a la última rotación deja de
  funcionar.
- **Decisión: no hay métricas de uso.** No se registra cuántos socios vieron la
  tarjeta ni cuántos usaron un beneficio.
- **Decisión: no hay alta de locales por parte del socio.** Sólo el dueño carga
  y mantiene el listado.
- **Limitación: el listado de gestión no es exclusivo del dueño.** Cualquier
  usuario autenticado del gimnasio puede leer los locales activos por API; sólo
  las escrituras están reservadas al dueño.

---

## 8. Problemas que pueden pasar

Hoy no hay un problema funcional abierto en este módulo. Los puntos que pueden
sorprender son decisiones o limitaciones ya documentadas:

1. **Un socio inactivo sigue viendo la tarjeta** (Decisión, COM-01). Es
   intencional: el portal completo funciona para socios inactivos.
2. **El `discount` no es un descuento de cobro** (Decisión, COM-02). Es sólo el
   texto que el socio muestra en el local.
3. **El QR puede quedar viejo** (Limitación). Si el portal rota el token dos
   veces, el QR impreso deja de resolver; hay que volver a compartirlo.
4. **Un staff puede leer el listado de locales** (Limitación). No puede crear,
   editar ni dar de baja.

Cualquier bug nuevo debe registrarse en `BUGS.md`; este documento no lo arregla.

---

## 9. Notas de entorno para leer el código

- La app **no tiene** `services.py` ni `permissions.py` propios: la lógica vive
  en las vistas y el permiso de dueño en `backend/core/permissions.py`.
- Migraciones: `backend/community/migrations/0001_initial.py` (modelo) y
  `backend/community/migrations/0002_communitybusiness_active_and_more.py`
  (`active` + índice único parcial).
- Tests: `backend/community/tests.py` (15 tests: beneficio obligatorio, baja
  lógica, unicidad de nombre, guard de rol y visibilidad pública). El CI corre
  la app `community`.
- Admin: `backend/community/admin.py · CommunityBusinessAdmin` usa
  `GymScopedAdminMixin` (REF-08).
- El módulo depende del **feature flag** `community` tanto en gestión como en
  el endpoint público (`backend/gyms/features.py · require_community`).
- Los endpoints públicos entran por el token del socio y no por login: la
  gracia de un token anterior y el 404 del socio eliminado son los mismos que
  en el resto del portal (`backend/members/models.py · portal_member_or_404`).
- El gimnasio de la tarjeta se resuelve por la suscripción activa, con caída a
  `member.gym` (`backend/subscriptions/domain.py · SubscriptionDomain.resolve_gym`).
- No existe un `CommunityFlow.jsx` de desarrollo; el flujo visual de este
  módulo no está cubierto por una página dev (a diferencia de rutinas).

---

## 10. Resumen en una frase

El gimnasio carga (sólo el dueño) una lista de locales adheridos con su beneficio; el
socio lo muestra en un QR y accede al descuento presentando su nombre. El `discount` es
informativo, no toca la facturación; los locales se dan de baja lógicamente y el nombre es
único por gimnasio entre los activos.
