# Auditoría de Operaciones — Cómo funcionan hoy la configuración, CI, tareas y despliegue

> Verificado contra: `f5b4b07`
> Fecha: 2026-10-30
> Alcance: configuración por entorno, URLs/middleware/throttles, tareas programadas, backup/restore, CI/workflows, scripts, despliegue. No cubre infraestructura cloud específica más allá de lo versionado.
> Documentos relacionados: `AUDITORIA-NUCLEO-REGLAS.md`, `AUDITORIA-SEED-DEMO.md`, `RESTORE-BACKUPS.md`, `RELEASE-CHECKLIST.md`
> Código cubierto: `backend/config`, `.github/workflows`, `scripts`, `Procfile`, `backend/requirements.txt`
> Estado: verificado

> Documento descriptivo: **lo que el sistema hace hoy**.

---

## 1. Qué es y para qué sirve

Describe cómo se configura, despliega y opera el sistema: variables de entorno, middleware, rate limiting, endpoints operativos, tareas programadas, backups/restore, CI y comandos de desarrollo.

## 2. Cómo funciona hoy

### 2.1 Configuración
- **`backend/config/settings.py`**: configura apps, middleware, DRF, auth tokens, throttles, CORS/CSRF, email (Resend), base de datos, etc. Usa `os.getenv` con defaults.
- **Variables relevantes**: `RESEND_API_KEY`, `DEFAULT_FROM_EMAIL`, configuración de DB, DEBUG, ALLOWED_HOSTS.

### 2.2 URLs, middleware, throttles
- **`backend/config/urls.py`**: rutas principales (`/admin/`, `/api/health/`, `/api/system/tasks/`, `/api/system/backup/`, `/api/system/sentry-test/`, APIs por app, `/api/admin/`).
- **Middleware**: `MIDDLEWARE` definido en settings (incluye seguridad, sesión, auth, etc.).
- **Throttles**: DRF throttles configurados en settings y en vistas específicas (`LoginRateThrottle`, `Onboarding*`, `PasswordReset*` en `config.api.throttles`).

### 2.3 Endpoints operativos
- **Health**: `config.api.health.health_check`
- **Tareas programadas**: `config.api.tasks.scheduled_tasks_endpoint`
- **Backup**: `config.api.backup.backup_endpoint`
- **Sentry test**: `config.api.sentrytest.sentry_test_endpoint`

### 2.4 CI/CD y workflows
- **`.github/workflows/backend-tests.yml`**: tests backend
- **`.github/workflows/scheduled-tasks.yml`**: tareas programadas
- **`.github/workflows/security-audit.yml`**: auditoría de seguridad
- **`.github/workflows/sentry-smoke.yml`**: smoke tests/sentry
- **`.github/dependabot.yml`**: actualizaciones de dependencias

### 2.5 Scripts y despliegue
- **`Procfile`**: `web: python manage.py migrate && gunicorn config.wsgi:application --workers=1 --timeout=120 --max-requests=1000 --max-requests-jitter=50 --log-level=info`
- **`scripts/dev-db.sh`**: levanta Postgres local para desarrollo (fuera del repo)
- **`scripts/monitor.sh`**: monitoreo
- **`scripts/check_audit_refs.py`**: validador de referencias de auditorías
- **`backend/requirements.txt`**: dependencias Python
- **Backups/restore**: documentado en `RESTORE-BACKUPS.md`

## 3. Reglas y casos borde

- **Migrations en despliegue**: Procfile ejecuta `migrate` antes de gunicorn.
- **Workers limitados**: configuración conservadora de gunicorn.
- **Throttling por endpoint**: login/onboarding/reset con throttles específicos.
- **Health/operativos**: endpoints para monitoreo/tareas/backup.
- **Desarrollo aislado**: DB local fuera del repo.

## 4. Roles y pantallas

Orientado a operadores/devops. No forma parte del UI de gimnasio.

## 5. Lo que el sistema NO hace hoy

- **No hay pipeline complejo multi-stage** documentado aquí.
- **No hay auto-scaling** configurado explícitamente.
- **No hay rollback automatizado** visible en estos archivos.

## 6. Problemas y decisiones de negocio

**Decisiones de negocio:**
- **Migrate en Procfile**: asegura schema actualizado al desplegar.
- **Throttling granular**: protege endpoints sensibles.
- **Scripts locales separados**: evita ensuciar repo.

**Problemas:** Ver `BUGS.md` si aplica.

## 7. Referencias técnicas

```text
backend/config/settings.py · MIDDLEWARE
backend/config/settings.py · REST_FRAMEWORK
backend/config/urls.py · urlpatterns
backend/config/api/health.py · health_check
backend/config/api/tasks.py · scheduled_tasks_endpoint
backend/config/api/backup.py · backup_endpoint
backend/config/api/sentrytest.py · sentry_test_endpoint
backend/config/api/throttles.py · LoginRateThrottle
backend/config/api/throttles.py · OnboardingCreateRateThrottle
backend/config/api/throttles.py · OnboardingValidateRateThrottle
backend/config/api/throttles.py · PasswordResetRequestRateThrottle
backend/config/api/throttles.py · PasswordResetConfirmRateThrottle
.github/workflows/backend-tests.yml · *
.github/workflows/scheduled-tasks.yml · *
.github/workflows/security-audit.yml · *
.github/workflows/sentry-smoke.yml · *
.github/dependabot.yml · *
Procfile · web
scripts/dev-db.sh · *
scripts/monitor.sh · *
scripts/check_audit_refs.py · *
backend/requirements.txt · *
RESTORE-BACKUPS.md · *
RELEASE-CHECKLIST.md · *
```

## 8. Snapshot de referencias

```text
backend/config/settings.py:1-250 (al commit f5b4b07)
backend/config/urls.py:1-120 (al commit f5b4b07)
Procfile:1-5 (al commit f5b4b07)
scripts/check_audit_refs.py:1-50 (al commit f5b4b07)
```

## 9. Checklist de verificación

- [x] Revisé settings/urls/middleware/throttles
- [x] Revisé endpoints operativos
- [x] Revisé workflows/scripts/Procfile
- [x] Revisé docs de backup/release
- [x] Actualicé “Lo que NO hace”
- [x] Referencias híbridas
- [x] Validador OK
- [x] Índice actualizado
