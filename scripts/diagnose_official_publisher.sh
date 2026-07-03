#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCAL_ENV="$SCRIPT_DIR/official_publisher.local.env"
PUBLISHER_LOG="$PROJECT_ROOT/official_dashboard_publisher.log"
RESTART=false
RUN_SMOKE=false

for arg in "$@"; do
  case "$arg" in
    --restart) RESTART=true ;;
    --smoke) RUN_SMOKE=true ;;
  esac
done

# shellcheck source=scripts/lib/read_local_env.sh
source "$SCRIPT_DIR/lib/read_local_env.sh"
read_local_env "$LOCAL_ENV"

SIGNALS_API_PORT="${SIGNALS_API_PORT:-8787}"
SIGNALS_API_HOST="${SIGNALS_API_HOST:-127.0.0.1}"

section() { echo; echo "=== $1 ==="; }

section "1) Processos official_dashboard_publisher.py"
if pgrep -af "official_dashboard_publisher.py" >/dev/null 2>&1; then
  count="$(pgrep -fc "official_dashboard_publisher.py" || echo 0)"
  if [[ "$count" -eq 1 ]]; then
    echo "OK 1 instancia"
    pgrep -af "official_dashboard_publisher.py"
  else
    echo "WARN $count instancias (duplicata)"
    pgrep -af "official_dashboard_publisher.py"
  fi
else
  echo "FAIL nenhum publisher rodando"
fi

section "2) Ultimas 60 linhas do log"
if [[ -f "$PUBLISHER_LOG" ]]; then
  tail -n 60 "$PUBLISHER_LOG"
  if tail -n 60 "$PUBLISHER_LOG" | grep -Eiq "Publish HTTP 401|Publish HTTP 403|Nao autorizado"; then
    echo "Detectado possivel erro de auth (401/403)."
  fi
else
  echo "Log ausente: $PUBLISHER_LOG"
fi

section "3) Variaveis em scripts/official_publisher.local.env"
check_var() {
  local name="$1"
  local value="${!name:-}"
  if [[ -n "$value" && ${#value} -ge 16 ]]; then
    echo "  OK  $name (${#value} chars)"
  elif [[ -n "$value" ]]; then
    echo "  WARN $name curto (${#value} chars)"
  else
    echo "  FAIL $name ausente"
  fi
}
if [[ -f "$LOCAL_ENV" ]]; then
  check_var SNIPER_ADMIN_EMAIL
  check_var SNIPER_ADMIN_PASSWORD
  check_var SNIPER_ADMIN_TOKEN
  check_var SNIPER_LOCAL_DASHBOARD_TOKEN
  check_var SNIPER_PUBLISHER_TOKEN
  check_var SNIPER_REMOTE_DASHBOARD_TOKEN
else
  echo "Arquivo ausente: $LOCAL_ENV"
fi

section "4) Signals API local (:${SIGNALS_API_PORT})"
if curl -fsS "http://${SIGNALS_API_HOST}:${SIGNALS_API_PORT}/health" 2>/dev/null; then
  echo "OK signals-api online"
else
  echo "FAIL signals-api offline — rode: bash scripts/start_official_signals_api.sh"
fi

section "5) Producao diagnostics"
TOKEN="${SNIPER_ADMIN_TOKEN:-${SNIPER_PUBLISHER_TOKEN:-}}"
if [[ -n "$TOKEN" ]]; then
  curl -fsS "https://sniperbo.com/telegram/v2/diagnostics" \
    -H "Accept: application/json" \
    -H "Authorization: Bearer $TOKEN" | head -c 2000 || echo "diagnostics falhou"
else
  echo "Sem token local para testar diagnostics"
fi

if [[ "$RESTART" == true ]]; then
  section "6) Reiniciando"
  pkill -f "official_dashboard_publisher.py" 2>/dev/null || true
  bash "$SCRIPT_DIR/start_official_publisher.sh"
  bash "$SCRIPT_DIR/watch_sniperbo_official.sh" --once
  sleep 10
  section "7) Log apos reinicio"
  tail -n 20 "$PUBLISHER_LOG" 2>/dev/null || true
fi

if [[ "$RUN_SMOKE" == true ]]; then
  section "8) Smoke test"
  export SNIPER_ADMIN_TOKEN="${SNIPER_ADMIN_TOKEN:-$SNIPER_PUBLISHER_TOKEN}"
  node "$SCRIPT_DIR/telegram-v2-prod-smoke.mjs"
fi

section "Comando VPS completo"
echo "  bash scripts/diagnose_official_publisher.sh --restart --smoke"
