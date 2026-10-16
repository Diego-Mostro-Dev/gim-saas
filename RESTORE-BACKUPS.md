# Procedimiento oficial de restauración de backups (Gym SaaS)

## Alcance v1
- Solo para base PostgreSQL temporal y vacía, creada para la ocasión.
- Solo fixtures `.json.gz` (dumpdata). `.dump.gz` (pg_dump custom) no está soportado en v1.
- No conecta a Neon, no toca producción, no modifica `.env`, `DATABASE_URL`, roles/permisos, ni PostgreSQL local existente.
- No invalida sesiones/tokens; no corrige secuencias automáticamente; no arregla el HTTP 401 de `download_url`.
- Modo diagnóstico `--check` no necesita conexión a PostgreSQL (solo archivo). Comparación con DB solo vía `--check-db`.

## Requisitos
- Acceso a Cloudinary (credenciales válidas en entorno) — no se imprimen URLs firmadas.
- Base destino: debe estar vacía (sin tablas de negocio, `django_migrations` vacío). Cualquier tabla desconocida o datos → aborta.

## Modos
- `--check` → valida gzip/JSON/conteos del fixture (solo archivo).
- `--check-db` → valida fixture + secuencias (solo lectura). Requiere `--confirm-db`.
- `--download-only` → descarga + verifica, sin escribir.
- `--restore` → requiere `--confirm-db` y base vacía. Solo base temporal.

## Guardas de señal
`profiles.signals.create_user_profile` se desconecta solo durante `loaddata`, con verificación de receptores vivos (Django 6.0.8). Cualquier receptor inesperado → aborta. Reconexión garantizada en `finally`.

## Validación posterior
Conteos vs fixture, FKs huérfanas (0), unicidad, secuencias reportadas (sin corrección automática), `manage.py check`.
