#!/usr/bin/env bash
# Fase 4 - Re-medicion de monitoreo en produccion.
#
# Uso:
#   TOKEN=<token-prod-readonly> scripts/monitor.sh
#   (o crear scripts/prod_token.txt junto a este script con el token; gitignored)
#
# Revisa: health, latencias de endpoints clave, ultimo backup en Cloudinary,
# CI en main y runs de scheduled-tasks.

set -uo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="${REPO:-$(cd "$HERE/.." && pwd)}"
API="${API:-https://gim-saas.onrender.com}"
PY="${PY:-$REPO/backend/.venv/bin/python}"
GH_REPO="Diego-Mostro-Dev/gim-saas"
TOKEN="${TOKEN:-}"

export LC_NUMERIC=C

if [ -z "$TOKEN" ] && [ -f "$HERE/prod_token.txt" ]; then
  TOKEN="$(tr -d '[:space:]' < "$HERE/prod_token.txt")"
fi

WARN=0
note() { printf '  %-40s %s\n' "$1" "$2"; }
head2() { printf '\n== %s ==\n' "$1"; }

# ms en entero desde time_total (segundos decimales)
ms() { awk -v s="$1" 'BEGIN{printf "%d", s*1000}'; }

# ---------------------------------------------------------------- health
head2 "Health"
hc="$(curl -s -o /dev/null -w '%{http_code} %{time_total}' --max-time 120 "$API/api/health/")"
code="${hc%% *}"; tt="${hc##* }"
note "/api/health/  HTTP=$code  $(ms "$tt")ms" "$([ "$code" = 200 ] && echo OK || { echo WARN; WARN=$((WARN+1)); })"

# ------------------------------------------------------------- latencias
head2 "Latencias (prod, GET)"
# endpoint:umbral_ms
for spec in \
  "/api/members/:8000" \
  "/api/subscriptions/:8000" \
  "/api/payments/:10000" \
  "/api/dashboard/:8000"
do
  ep="${spec%:*}"; limit="${spec##*:}"
  r="$(curl -s -o /dev/null -w '%{http_code} %{time_total}' --max-time 120 \
        -H "Authorization: Token $TOKEN" -H "Accept: application/json" "$API$ep")"
  code="${r%% *}"; tt="${r##* }"; m="$(ms "$tt")"
  if [ "$code" != 200 ]; then
    note "$ep  HTTP=$code" "WARN"; WARN=$((WARN+1))
  elif [ "$m" -gt "$limit" ]; then
    note "$ep  ${m}ms" "WARN (>${limit}ms)"; WARN=$((WARN+1))
  else
    note "$ep  ${m}ms" "OK"
  fi
done

# --------------------------------------------------------------- backup
head2 "Backup mas reciente (Cloudinary)"
BACKUP_OUT="$(
  cd "$REPO/backend" 2>/dev/null && \
  env -u DATABASE_URL -u DATABASE_URL_PROD -u ENVIRONMENT \
    PYTHONPATH="$REPO/backend" "$PY" - <<'PY' 2>/dev/null
import os, django, datetime
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()
from config.api.restore import list_backups
items = list_backups()
if not items:
    print("NONE 0"); raise SystemExit
newest = max(items, key=lambda b: b.created_at)
t = datetime.datetime.fromisoformat(newest.created_at.replace("Z", "+00:00"))
age = (datetime.datetime.now(datetime.timezone.utc) - t).total_seconds() / 3600.0
print(f"{newest.created_at} {newest.bytes} {len(items)} {age:.1f}")
PY
)"
if [ -z "$BACKUP_OUT" ]; then
  note "list_backups" "SKIP (sin venv/django)"
else
  read -r btime bbytes bcount bage <<< "$BACKUP_OUT"
  if [ "$btime" = "NONE" ]; then
    note "backups" "WARN (ninguno)"; WARN=$((WARN+1))
  else
    printf '  ultimo=%s  size=%sB  total=%s  edad=%.1fh\n' "$btime" "$bbytes" "$bcount" "$bage"
    if awk -v a="$bage" 'BEGIN{exit !(a>8)}'; then
      note "edad del ultimo backup" "WARN (>8h)"; WARN=$((WARN+1))
    else
      note "edad del ultimo backup" "OK"
    fi
  fi
fi

# --------------------------------------------------------------- GitHub
gh_runs() {
  local url="$1" label="$2"
  head2 "$label"
  "$PY" - "$url" <<'PY' 2>/dev/null
import json, sys, urllib.request
url = sys.argv[1]
try:
    with urllib.request.urlopen(url, timeout=60) as r:
        d = json.load(r)
except Exception as e:
    print(f"  ERROR: {e}"); raise SystemExit
runs = d.get("workflow_runs")
if runs is None:
    print(f"  API: {d.get('message','?')}"); raise SystemExit
for run in runs[:5]:
    print(f"  {run['created_at']}  {run['name']:<22} {str(run['conclusion']):<9} {run['head_sha'][:8]}")
PY
}

gh_runs "https://api.github.com/repos/$GH_REPO/actions/runs?branch=main&per_page=8" "CI en main (ultimos)"
gh_runs "https://api.github.com/repos/$GH_REPO/actions/workflows/scheduled-tasks.yml/runs?per_page=5" "Scheduled tasks (ultimos)"

head2 "Sentry (manual)"
echo "  Confirmar 0 errores nuevos en el dashboard de Sentry."
echo "  Smoke opcional:"
echo "    curl -X POST $API/api/system/sentry-test/ -H \"X-Task-Key: <SCHEDULED_TASKS_KEY>\""

head2 "Veredicto"
if [ "$WARN" -eq 0 ]; then
  echo "  OK - sin avisos"
else
  echo "  $WARN aviso(s) - revisar arriba"
fi
exit 0
