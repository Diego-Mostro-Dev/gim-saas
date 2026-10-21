# Auditoría de Comunidad — Cómo funciona hoy la comunidad de descuentos

> Documento descriptivo: **lo que el sistema hace hoy**, verificado contra el código.
> Escrito en lenguaje simple para servir de base a un manual de gimnasios. Las
> referencias de código van aparte, en letra chica, para no ensuciar el texto.
> Cubre **la comunidad de descuentos** (los locales adheridos que ofrecen beneficios a
> los socios). No confundir con las **rutinas** (ver `AUDITORIA-RUTINAS.md`) ni con el
> **portal del socio** en general (ver `AUDITORIA-MIEMBROS.md`).

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
- App: `backend/community/` (registrada en `backend/config/settings.py:159`,
  `backend/config/urls.py:41` → prefijo `api/community/`).
- Panel (frontend): `frontend/src/pages/CommunityPanel.jsx`, embebido en la pestaña
  "Comunidad" de `frontend/src/pages/Settings.jsx:254,843`.
- Portal (frontend): `frontend/src/pages/member/MemberCommunity.jsx` (tarjeta dentro del
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

### Referencia
- Modelo: `backend/community/models.py` — `CommunityBusiness` `:6-66` (`active` `:44`,
  `constraints` `:50-56`, `delete()` soft `:58-61`).
- Constraint de unicidad: `uniq_community_business_name_per_gym` (índice único parcial
  `(gym, name) WHERE active=True`), migración `backend/community/migrations/0002_...`.
- Baja lógica: `active=False`; el `delete()` del modelo nunca borra la fila (COM-04).

---

## 3. El interruptor: la feature "Comunidad"

La comunidad es un **add-on** del gimnasio. Se habilita con el flag `community` en
`gym.features`. Si está apagada:

- El panel no muestra la pestaña "Comunidad".
- Los endpoints (`/api/community/...`) responden con un error de feature deshabilitado
  (`require_community`).

Es decir: un gimnasio que no ofrece el programa no ve nada de esto.

### Referencia
- Flag: `backend/gyms/features.py:22,98-106` (`FEATURE_COMMUNITY`, `community_enabled`,
  `require_community`).
- Guard backend: `CommunityGuardMixin.initial` (`backend/community/views.py:15-20`).
- Guard frontend: `Settings.jsx:104,254,843` (`communityEnabled`).

---

## 4. Los dos flujos

### 4.1 Gestión (el dueño) — autenticado

Sólo el **dueño** del gimnasio gestiona los locales. El staff no puede crear, editar ni
dar de baja (recibe 403).

| Acción | Endpoint | Quién |
|--------|----------|-------|
| Listar locales activos | `GET /api/community/businesses/` | Cualquier usuario autenticado del gym |
| Crear local | `POST /api/community/businesses/` | Sólo el dueño |
| Editar local | `PATCH /api/community/businesses/<id>/` | Sólo el dueño |
| Dar de baja | `DELETE /api/community/businesses/<id>/` | Sólo el dueño |

Detalles:

- El listado sólo muestra locales **activos**.
- Crear o editar con un nombre ya usado por otro local activo del mismo gimnasio
  devuelve **400** ("Ya existe un local adherido con ese nombre"). Un local dado de baja
  libera su nombre.
- Dar de baja **no borra**: marca `active=False` (baja lógica) y devuelve 204. El local
  deja de aparecer en el listado y en la tarjeta del socio. Volver a crear un local con
  el mismo nombre después de la baja funciona.

### Referencia
- Vistas: `backend/community/views.py` — `CommunityBusinessView` `:23-49`,
  `CommunityBusinessDetailView` `:52-88`.
- Permiso: `require_owner` (`backend/core/permissions.py:26-31`).
- Unicidad y carrera: constraint parcial + `transaction.atomic()` con `IntegrityError` →
  400 (`views.py:40-48,74-81`).
- Serializer: `backend/community/serializers.py` (`discount` obligatorio/no vacío).

### 4.2 Tarjeta pública (el socio) — sin login, por token

El socio accede a su tarjeta **sin usuario ni contraseña**, con el **token de su portal**
(el mismo que usa para todo el portal). La tarjeta muestra su nombre, el gimnasio y los
locales activos con sus beneficios. No expone ningún otro dato del portal.

- El endpoint es público (`permission_classes = []`) y está protegido con dos throttles:
  uno general por IP y otro por token del portal.
- El token acepta también la **generación anterior** (para no romper un QR ya impreso
  cuando el portal rota el token).
- **Un socio inactivo sigue viendo su tarjeta.** Es una decisión de negocio: todo el
  portal del socio es accesible a socios inactivos a propósito (por ejemplo, para subir un
  comprobante que destrabe un acceso suspendido). La tarjeta de comunidad no es un dato
  sensible y no se bloquea.

### Referencia
- Vista pública: `backend/community/public_views.py` — `PublicMemberCommunityView`
  `:13-41` (filtra `active=True` `:28-31`).
- Resolución del socio por token: `portal_member_or_404` /
  `resolve_public_portal_member` (`backend/members/models.py:290-314`); no filtra
  `active` (mismo criterio que el resto del portal).
- Throttles: `config/api/throttles.py` (`PublicMemberRateThrottle`,
  `MemberPortalTokenThrottle`).

---

## 5. Qué se ve en pantalla

- **Panel (dueño):** pestaña "Comunidad" de Configuración. Lista los locales activos con
  nombre, categoría, dirección, contacto y beneficio. Permite crear, editar y eliminar
  (baja lógica). Se muestra sólo si la feature está activa; la pantalla de Configuración
  es sólo para el dueño.
- **Portal del socio:** pestaña "Comunidad" con un **QR** y la lista de locales. El QR
  apunta a la página standalone `/comunidad/<token>`, que el socio puede mostrar en el
  local sin necesidad de abrir el portal.
- **Admin Django:** `CommunityBusiness` está registrado para inspección del administrador
  central.

### Referencia
- Panel: `frontend/src/pages/CommunityPanel.jsx` (`getCommunityBusinesses`,
  `create/update/deleteCommunityBusiness` en `frontend/src/services/community.service.js`).
- Portal: `frontend/src/pages/member/MemberCommunity.jsx`,
  `frontend/src/pages/member/CommunityPublicPage.jsx`.
- Rutas: `frontend/src/App.jsx:148` (`/portal/comunidad`), `:151` (`/comunidad/:token`).
- Guard de Configuración: `App.jsx:208` (`ProfessorRoute`) + `Settings.jsx:746`
  (redirect a no-owner).
- Admin: `backend/community/admin.py`.

---

## 6. Estados y casos borde

| Situación | Qué pasa hoy |
|-----------|--------------|
| Local dado de baja | No aparece en el panel ni en la tarjeta; la fila se conserva (`active=False`). |
| Nombre repetido (mismo gym, activo) | 400 con mensaje de dominio. |
| Nombre de un local dado de baja | Se puede reusar (el constraint sólo mira activos). |
| `discount` vacío o en blanco | 400 con mensaje de dominio (validado en Fase C). |
| Feature `community` apagada | El panel no aparece y los endpoints dan feature deshabilitado. |
| Staff intenta gestionar | 403 (sólo el dueño). |
| Socio inactivo abre su tarjeta | **Funciona** (decisión de negocio; como todo el portal). |
| QR viejo tras rotación de token | Funciona una generación (gracia de un token anterior). |
| Token inexistente | 404. |

---

## 7. Resumen en una frase

El gimnasio carga (sólo el dueño) una lista de locales adheridos con su beneficio; el
socio lo muestra en un QR y accede al descuento presentando su nombre. El `discount` es
informativo, no toca la facturación; los locales se dan de baja lógicamente y el nombre es
único por gimnasio entre los activos.
