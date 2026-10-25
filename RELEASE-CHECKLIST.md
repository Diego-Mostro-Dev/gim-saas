# Checklist de release

> **Estado: BORRADOR** — creado en la Fase K0 (2026-10-21). Se completa en la sub-fase K8.
> El registro de bugs es `BUGS.md`; el plan por fases es `PLAN-bugs.md`.

Objetivo: poder publicar una versión del producto **vender y cobrar** sin sorpresas. Cada
ítem es una casilla; si algo no aplica, se tacha con la razón.

---

## 0. Estado del gate (línea base del 2026-10-25, cierre de K6)

| Gate | Comando | Estado |
|---|---|---|
| Suite backend | `manage.py test <17 apps>` (ver §2) | 🟢 553 tests OK |
| Migraciones | `manage.py makemigrations --check --dry-run` | 🟢 sin cambios pendientes |
| Build de front | `pnpm build` (en `frontend/`) | 🟢 verde |
| Lint de front | `pnpm lint` (en `frontend/`) | 🔴 **88 problemas (68 errores, 20 warnings)** → `REF-05`, bloqueante (K7) |
| Auditoría de dinero | `manage.py audit_money_bugs` | 🟢 sin "armados" nuevos |
| Arnés de invariantes (I1–I8) | `check_money_invariants` sobre la copia de staging | 🟢 27 violaciones, todas de `seed/base.py` (`DIN-20`) |
| Bugs abiertos | `BUGS.md` | 🔴 4 abiertos (K7: ADD-03, ADD-19, REF-05; K8: DIN-20) |

---

## 1. Entorno de gates (local)

Neon no deja crear `test_neondb` (el rol `gim_app` no tiene `CREATEDB`) y los tests de dinero
dependen de locks reales de fila, así que el gate **no** corre contra staging ni SQLite. Se usa
el cluster Postgres 16 descartable en `/tmp`:

```bash
export PGBIN=/usr/lib/postgresql/16/bin
$PGBIN/initdb -D /tmp/opencode/pgtest -U postgres -A trust
$PGBIN/pg_ctl -D /tmp/opencode/pgtest \
  -o "-p 55432 -k /tmp/opencode/pgsock -c listen_addresses=127.0.0.1" \
  -l /tmp/opencode/pgtest.log start

cd backend
DATABASE_URL="postgres://postgres@127.0.0.1:55432/postgres" \
DB_SSLMODE=disable ENVIRONMENT=development \
.venv/bin/python manage.py test subscriptions members attendance payments plans config \
activities outings gyms admins accounts personal_training routines community profiles seed core
```

Además: `makemigrations --check --dry-run` y (en `frontend/`) `pnpm build` + `pnpm lint`.

## 2. Qué corre el CI

`.github/workflows/backend-tests.yml` (en `pull_request`, `push` a `development`/`main` y manual):

- **Job backend**: Postgres 16 de servicio y la suite completa de las 17 apps + el round-trip de
  `gyms.tests_restore`.
- **Job frontend**: `pnpm install --frozen-lockfile` + `pnpm build`.
  (El lint se vuelve **bloqueante** en K7, con `REF-05` cerrado.)

Otros workflows:

| Workflow | Qué | Cuándo |
|---|---|---|
| `scheduled-tasks.yml` | Dispara las tareas programadas (`/api/system/tasks/?force=true`) y el backup a Cloudinary | cron cada 6 h (`17 */6 * * *`) |
| `security-audit.yml` | `pip-audit` + `pnpm audit --prod` (ambos `continue-on-error`) | PR, push, lunes 03:23 |
| `sentry-smoke.yml` | Comprueba que Sentry reporta | sólo si cambia el workflow; manual |

## 3. Variables de entorno

**Obligatorias en producción:**

| Variable | Para qué |
|---|---|
| `SECRET_KEY` | clave de Django (sin default: el arranque falla) |
| `DATABASE_URL` | Postgres (Neon) — sin default |
| `SCHEDULED_TASKS_KEY` | header `X-Task-Key` de las tareas programadas y del backup ("" por default: en prod hay que ponerla) |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | fotos y adjuntos de socios (sin default) |
| `FRONTEND_URL` | origen del front para armar URLs públicas y de onboarding (default `""` desde REF-09: **sin** esta variable ya no hay 500, pero los links públicos salen vacíos) |

**Opcionales (con default):** `ENVIRONMENT` · `DEBUG` · `SECURE_SSL_REDIRECT` (prod) ·
`SECURE_HSTS_SECONDS` · `TOKEN_EXPIRY_HOURS` (168) · `MEMBER_ACCESS_TOKEN_TTL_DAYS` (30) ·
`AXES_FAILURE_LIMIT` (5) · `SCHEDULED_TASKS_ENABLED` (true) · `SCHEDULED_TASKS_INTERVAL_SECONDS`
(21600) · `BACKUP_RETENTION` (14) · `PASSWORD_RESET_TOKEN_TTL_SECONDS` (3600) ·
`PASSWORD_RESET_REQUEST_COOLDOWN_SECONDS` (60) · `RESEND_API_KEY` (reset de contraseña) ·
`DEFAULT_FROM_EMAIL` · `SENTRY_DSN` + `SENTRY_TRACES_SAMPLE_RATE` (0.25) ·
`CORS_ALLOWED_ORIGINS` · `NUM_PROXIES` · `DB_SSLMODE` (require) ·
`NEON_ENDPOINT_STAGING` / `NEON_ENDPOINT_PRODUCTION`.

> `.env.example` es la lista de referencia. Ojo: `BACKUP_RETENTION` se usa en
> `backend/config/api/backup.py` y **no** estaba documentada en `.env.example` (K8: agregarla).

## 4. Antes de mergear a `main`

- [ ] Suite completa verde en el CI de la PR (17 apps + `gyms.tests_restore`).
- [ ] `pnpm build` verde y `pnpm lint` **sin errores** (K7).
- [ ] `makemigrations --check --dry-run` limpio y migraciones aplicadas en staging.
- [ ] K5 en staging: `members/0019` limpió los teléfonos duplicados antes de crear el índice
      (verificar en el log: `K5 · ACC-19: ...` renombrados) y `subscriptions/0024` creó el ítem
      de las filas legacy con `price_snapshot = 0` (log: `K5 · DIN-17: ...`). Ambos comandos son
      idempotentes y corren dentro de `migrate` (el `Procfile` migra antes de `gunicorn`).
- [ ] K6 en staging: `members/0020` agrega `deleted_at` y reemplaza el constraint de teléfono
      por uno parcial (sólo socios vivos). Verificar que los socios existentes quedan con
      `deleted_at = NULL` y que la pestaña "Dados de baja" arranca vacía.
- [ ] `BUGS.md` sin 🔴 y `PLAN-bugs.md` con la fase actual marcada como hecha.
- [ ] `audit_money_bugs` sin "armados" nuevos y el arnés de invariantes (I1–I8) verde.
- [ ] Sin secretos en el diff: `scripts/prod_token.txt` está ignorado por git (permisos 600).

## 5. Deploy

- [ ] Merge `development` → `main` (Render). El `Procfile` corre
      `python manage.py migrate && gunicorn config.wsgi:application --workers=1 --timeout=120 --max-requests=1000 --max-requests-jitter=50 --log-level=info`.
- [ ] Verificar que las migraciones corrieron bien en el log de arranque.
- [ ] `FRONTEND_URL` y `SCHEDULED_TASKS_KEY` están seteadas **antes** del deploy.

## 6. Post-deploy

- [ ] `scripts/monitor.sh` (necesita `TOKEN` en el env o en `scripts/prod_token.txt`, permisos 600):
      health, latencias con token, backup más reciente en Cloudinary, estado del CI en `main` y
      del workflow de tareas programadas, y recordatorio de Sentry.
- [ ] Cron de tareas programadas: una corrida con `last_status = "ok"` y
      `last_duration_seconds < 15` (este es el pendiente #11 de `PLAN-dinero.md`).
- [ ] Backup reciente en Cloudinary (retención 14 días por default).
- [ ] Sentry sin alertas nuevas.

## 7. Antes de vender (lo que hay que saber y comunicar)

- [ ] Las **13 decisiones de negocio** de `BUGS.md` → "Pendientes" están escritas para el
      comercial: prorrateo, crédito al recuperar, salidas sin no-show, etc.
- [ ] No hay pago online: el cobro es manual (transferencia/comprobante).
- [ ] No hay recordatorios por email/WhatsApp.
- [ ] Los precios viejos no se propagan a los socios ya inscriptos.
- [ ] El portal del socio se accede por link mágico con token de 30 días (1 generación de
      gracia).

## 8. Cobertura de tests

Apps con tests (todas corren en el CI): `accounts` · `activities` · `admins` · `attendance` ·
`community` · `config` · `core` · `gyms` · `members` · `outings` · `payments` ·
`personal_training` · `plans` · `profiles` · `routines` · `seed` · `subscriptions`.

Sin tests: **el frontend** (no hay script `test`; sólo `lint` y `build`). Los bugs de render
del portal (`ADD-06`, `ACC-04`, `ADD-18`) se verifican a mano o con el lint.
