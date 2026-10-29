#!/usr/bin/env bash
# Postgres local de desarrollo.
#
# Es un clon de la branch de staging (schema + datos) con las migraciones
# aplicadas. Vive fuera del repo (~/.local/share/gymsaas/pg) para no ensuciar
# el arbol de git ni que /tmp lo borre al reiniciar.
#
# Uso:
#   scripts/dev-db.sh start
#   scripts/dev-db.sh stop
#   scripts/dev-db.sh status
#   scripts/dev-db.sh psql        # abre una consola en gymsaas_dev

set -uo pipefail

PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
PGDATA="${PGDATA:-$HOME/.local/share/gymsaas/pg}"
PGSOCK="${PGSOCK:-$HOME/.local/share/gymsaas/pgsock}"
PGPORT="${PGPORT:-55432}"
PGLOG="${PGLOG:-$HOME/.local/share/gymsaas/pg.log}"
DBNAME="${DBNAME:-gymsaas_dev}"
DBUSER="${DBUSER:-postgres}"

export PGSSLMODE=disable

start() {
  if "$PGBIN/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
    echo "Postgres local ya esta corriendo en $PGPORT."
    return 0
  fi
  mkdir -p "$PGSOCK"
  "$PGBIN/pg_ctl" -D "$PGDATA" \
    -o "-p $PGPORT -k $PGSOCK -c listen_addresses=127.0.0.1" \
    -l "$PGLOG" start
}

stop() {
  "$PGBIN/pg_ctl" -D "$PGDATA" stop
}

status() {
  "$PGBIN/pg_ctl" -D "$PGDATA" status || true
  psql -h 127.0.0.1 -p "$PGPORT" -U "$DBUSER" -d "$DBNAME" \
    -t -c "select 'gyms=' || (select count(*) from gyms_gym) || ' members=' || (select count(*) from members_member);" 2>/dev/null \
    || echo "No se pudo consultar la base."
}

case "${1:-status}" in
  start)  start ;;
  stop)   stop ;;
  status) status ;;
  psql)   exec psql -h 127.0.0.1 -p "$PGPORT" -U "$DBUSER" -d "$DBNAME" ;;
  *)      echo "Uso: $0 {start|stop|status|psql}"; exit 2 ;;
esac
