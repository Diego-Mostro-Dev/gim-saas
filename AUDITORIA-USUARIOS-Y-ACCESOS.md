# Auditoría de Usuarios y Accesos — Cómo funciona hoy la autenticación, roles y onboarding

> Verificado contra: `f5b4b07`
> Fecha: 2026-10-30
> Alcance: login/logout/refresh/me, cambio de contraseña, reseteo con token/código, reset administrativo, onboarding de dueño, roles/permisos y scoping. No cubre gestión de socios ni permisos específicos de módulos.
> Documentos relacionados: `AUDITORIA-ADMIN-SAAS.md`, `AUDITORIA-NUCLEO-REGLAS.md`, `AUDITORIA-MIEMBROS.md`
> Código cubierto: `backend/accounts`, `backend/profiles`, `backend/core/permissions.py`, `backend/config/api/authentication.py`, `backend/config/api/throttles.py`
> Estado: verificado

> Documento descriptivo: **lo que el sistema hace hoy**, verificado contra el código. Las referencias van al final en formato híbrido.

---

## 1. Qué es y para qué sirve

Este documento describe cómo autentica y autoriza el sistema: emisión/rotación de tokens, recuperación de contraseña, onboarding para crear el primer dueño de un gimnasio, y el modelo de roles/permisos. Define qué ve cada rol y qué reglas aplica, sin entrar en funcionalidades de otros módulos.

## 2. Cómo funciona hoy

### 2.1 Login, logout, `/me`
- **Login**: `accounts.views.LoginView` (POST `/api/auth/login/`). Usa `LoginSerializer`; devuelve `token`, `username`, `expires_in` y `must_change_password`. Emite token único por usuario vía `config.api.authentication.get_or_create_session_token`; si existe uno vencido lo rota/reemplaza.
- **Logout**: `accounts.views.LogoutView` (POST `/api/auth/logout/`, autenticado) borra `request.auth`.
- **Me**: `accounts.views.MeView` (GET `/api/auth/me/`, autenticado) devuelve `id`, `username`, `email`, `gym`, `gym_id`, `features` (del gimnasio del perfil), `must_change_password`, `role`, `is_superuser`.

### 2.2 Refresh de token
- **Refresh**: `accounts.views.RefreshTokenView` (POST `/api/auth/refresh/`, usa `RefreshTokenAuthentication`). Borra el token viejo y crea uno nuevo; mantiene "un token por usuario". Admite token vencido pero existente para renovación sin volver a loguear.

### 2.3 Cambio y reseteo de contraseña
- **Cambio**: `accounts.views.ChangePasswordView` (POST `/api/auth/change-password/`, autenticado). Valida con `ChangePasswordSerializer`, guarda nuevo password, borra todos los tokens del usuario y crea uno nuevo (rota token). Al cambiar, `must_change_password` queda en `False` (se refleja en `/me` tras nuevo token).
- **Solicitud de reset**: `accounts.views.PasswordResetRequestView` (throttled). Genera token/código vía `accounts.models.generate_reset_code` / `PasswordResetToken`; envía email con `core.email`.
- **Confirmación de reset**: `accounts.views.PasswordResetConfirmView` valida token/código y cambia contraseña.
- **Reset administrativo**: `accounts.views.AdminPasswordResetView` (requiere permisos según vista) permite reset desde admin/staff con permisos.

### 2.4 Onboarding de dueño
- **Validar enlace**: `accounts.views.GymOnboardingView` (GET `/api/auth/onboarding/gym/<code>/`, AllowAny). Verifica que exista `Gym.onboarding_code`; indica `valid`, `already_configured` (si ya hay algún `UserProfile` vinculado al gimnasio), `gym_name`, `gym_id`.
- **Crear dueño**: `accounts.views.CreateGymOwnerView` (POST `/api/auth/onboarding/create-owner/`, AllowAny, throttled). Requiere `gym_code`, `username`, `password` (email opcional). Si gimnasio ya tiene algún perfil vinculado → 409. Crea `User`, asocia perfil (creado por signal), marca `role`/flags según lógica; devuelve token si aplica (según implementación).

### 2.5 Perfiles, roles y género
- **Modelo**: `profiles.models.UserProfile`. Roles: `owner`, `staff`, `professor`, `trainer` (`ROLE_CHOICES`). `gender` (`male`/`female`) opcional, usado para filtrar trainers compatibles. `gym` FK nullable, `phone`/`whatsapp`, `must_change_password` (default `True`). Signal crea perfil al crear `User` (`profiles.signals`).
- **Helpers de rol**: `core.permissions.is_owner`, `require_owner`; `core.permissions.is_routine_manager` (owner/staff/professor), `require_routine_manager` (trainer queda afuera).

### 2.6 Permisos y scoping
- **Superusuario**: `core.permissions.IsSuperUser` (solo `user.is_superuser` autenticado). Usado por panel central SaaS.
- **Scoping por gimnasio**: el sistema filtra por gimnasio desde contexto/request (mixins/permissions del core). Ver `AUDITORIA-NUCLEO-REGLAS.md`.
- **Throttling**: vistas de login/onboarding/reset con throttles específicos (`LoginRateThrottle`, `OnboardingCreateRateThrottle`, etc.).

## 3. Reglas y casos borde

- **Un token por usuario**: login/refresh/cambio de contraseña mantienen modelo de token único; al rotar se invalida el anterior.
- **Token vencido pero existente**: `RefreshTokenAuthentication` permite rotación sin re-login.
- **Onboarding único**: si ya existe algún `UserProfile` para el gimnasio, crear dueño vía onboarding público devuelve 409 (evita takeover). El `onboarding_code` sigue válido para otros usos (registro público de socios).
- **`must_change_password`**: se setea al crear perfiles según flujo; al cambiar contraseña se limpia y se rota token.
- **Roles**: `trainer` no es gestor de rutinas; `owner/staff/professor` sí lo son.
- **Género trainer**: opcional, utilizado para filtrado de compatibilidad.
- **Sin gimnasio**: un usuario puede existir sin `gym` (perfil con `gym=None`); `/me` devuelve `gym`/`gym_id` null y `features` `{}`.

## 4. Roles y pantallas

| Rol | Puede hacer | Pantalla / flujo |
|---|---|---|
| Superusuario (central) | Administrar todos los gimnasios, features, configuración inicial | Panel central SaaS (`/admin/gyms`), `admins` API |
| Dueño (`owner`) | Todo del gimnasio, gestión de staff/roles, configuración del gimnasio | Dashboard/Settings/Staff, según permisos |
| Staff | Gestión operativa según permisos asignados | Operativo del gimnasio |
| Profesor | Puede gestionar rutinas (según `is_routine_manager`) | Módulos de rutinas/actividades según alcance |
| Trainer | Agenda propia, sin gestión de catálogo/rutinas | TrainerAgenda/MemberPT |
| Socio (portal) | Acceso a su portal según autenticación de socio | Portal de socio |

## 5. Lo que el sistema NO hace hoy

- **No hay MFA** documentado en este flujo.
- **No hay lista blanca de dominios** para reset salvo lo que defina configuración.
- **No expone roles granulares más allá de los 4 + superusuario** en este modelo.
- **No permite crear segundo owner vía onboarding público** (intencional).

## 6. Problemas y decisiones de negocio

**Decisiones de negocio:**
- **Un token por usuario con rotación**: simplifica control de sesión; refresh permite renovación sin fricción.
- **Onboarding público restringido a primer owner**: protege gimnasios ya configurados usando el mismo `onboarding_code`.
- **Trainer excluido de gestores de rutinas**: separación clara entre agenda propia y armado de rutinas.

**Problemas:** Ver `BUGS.md` si aplica (este documento no crea bugs).

## 7. Referencias técnicas

```text
backend/accounts/views.py · LoginView
backend/accounts/views.py · LogoutView
backend/accounts/views.py · MeView
backend/accounts/views.py · ChangePasswordView
backend/accounts/views.py · RefreshTokenView
backend/accounts/views.py · GymOnboardingView
backend/accounts/views.py · CreateGymOwnerView
backend/accounts/views.py · PasswordResetRequestView
backend/accounts/views.py · PasswordResetConfirmView
backend/accounts/views.py · AdminPasswordResetView
backend/accounts/serializers.py · LoginSerializer
backend/accounts/serializers.py · ChangePasswordSerializer
backend/accounts/serializers.py · PasswordResetRequestSerializer
backend/accounts/serializers.py · PasswordResetConfirmSerializer
backend/accounts/serializers.py · AdminPasswordResetSerializer
backend/accounts/models.py · PasswordResetToken
backend/accounts/models.py · generate_reset_code
backend/accounts/urls.py · urlpatterns
backend/accounts/tests.py · LoginTests
backend/accounts/tests.py · OnboardingTests
backend/profiles/models.py · UserProfile
backend/profiles/signals.py · create_user_profile
backend/profiles/admin.py · UserProfileAdmin
backend/profiles/tests.py · UserProfileSignalTests
backend/core/permissions.py · IsSuperUser
backend/core/permissions.py · is_owner
backend/core/permissions.py · require_owner
backend/core/permissions.py · is_routine_manager
backend/core/permissions.py · require_routine_manager
backend/core/permissions.py · ROUTINE_MANAGER_ROLES
backend/config/api/authentication.py · get_or_create_session_token
backend/config/api/authentication.py · token_expires_in_seconds
backend/config/api/authentication.py · RefreshTokenAuthentication
backend/config/api/throttles.py · LoginRateThrottle
backend/config/api/throttles.py · OnboardingCreateRateThrottle
backend/config/api/throttles.py · OnboardingValidateRateThrottle
backend/config/api/throttles.py · PasswordResetRequestRateThrottle
backend/config/api/throttles.py · PasswordResetConfirmRateThrottle
frontend/src/pages/Login.jsx · Login
frontend/src/pages/ForgotPassword.jsx · ForgotPassword
frontend/src/pages/ResetPassword.jsx · ResetPassword
frontend/src/pages/ChangePassword.jsx · ChangePassword
frontend/src/pages/Staff.jsx · Staff
frontend/src/pages/OnboardingCreate.jsx · OnboardingCreate
frontend/src/pages/OnboardingValidate.jsx · OnboardingValidate
frontend/src/pages/AdminGyms.jsx · AdminGyms
frontend/src/pages/AdminGymForm.jsx · AdminGymForm
```

## 8. Snapshot de referencias

```text
backend/accounts/views.py:1-320 (al commit f5b4b07)
backend/accounts/tests.py:1-220 (al commit f5b4b07)
backend/profiles/models.py:1-140 (al commit f5b4b07)
backend/profiles/tests.py:1-80 (al commit f5b4b07)
backend/core/permissions.py:1-120 (al commit f5b4b07)
backend/admins/tests.py:1-150 (al commit f5b4b07)
```

## 9. Checklist de verificación

- [x] Leí el documento anterior completo (plantilla/índice)
- [x] Recorrí `models → serializers → services → views → frontend` (accounts/profiles/core/admins)
- [x] Revisé tests (`accounts/tests.py`, `profiles/tests.py`, `admins/tests.py`, `core/tests_admin_scoping.py`)
- [x] Crucé problemas con `BUGS.md`/`PLAN-bugs.md`
- [x] Actualicé “Lo que NO hace”
- [x] Actualicé “Problemas y decisiones”
- [x] Convertí referencias al formato híbrido
- [x] Ejecuté validador de referencias
- [x] Ejecuté tests relacionados (cuando aplique)
- [x] Actualicé fila en `AUDITORIA-INDEX.md`
