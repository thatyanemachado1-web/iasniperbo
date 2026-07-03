#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCAL_ENV="$SCRIPT_DIR/official_publisher.local.env"
ENV_EXAMPLE="$SCRIPT_DIR/official_publisher.local.env.example"

cd "$PROJECT_ROOT"

echo ""
echo "=== SNIPERBO — Ligando motor real de sinais (Linux/VPS) ==="
echo ""

if [[ ! -f "$LOCAL_ENV" ]]; then
  if [[ ! -f "$ENV_EXAMPLE" ]]; then
    echo "Exemplo ausente: $ENV_EXAMPLE" >&2
    exit 1
  fi
  cp "$ENV_EXAMPLE" "$LOCAL_ENV"
  echo "Criado $LOCAL_ENV — preencha SNIPER_ADMIN_* e SNIPER_PUBLISHER_TOKEN, depois rode de novo."
  exit 1
fi

for key in SNIPER_ADMIN_EMAIL SNIPER_ADMIN_PASSWORD SNIPER_ADMIN_TOKEN; do
  if ! grep -q "^${key}=.\+" "$LOCAL_ENV" 2>/dev/null; then
    echo "Variavel vazia: $key em official_publisher.local.env" >&2
    exit 1
  fi
done

echo "[1/2] Signals API..."
bash "$SCRIPT_DIR/start_official_signals_api.sh"

echo "[2/2] Publisher oficial..."
bash "$SCRIPT_DIR/start_official_publisher.sh"

echo ""
echo "=== Status ==="
curl -fsS "http://127.0.0.1:${SIGNALS_API_PORT:-8787}/health" && echo || echo "Signals API offline"
echo ""
echo "Log: $PROJECT_ROOT/official_dashboard_publisher.log"
tail -n 5 "$PROJECT_ROOT/official_dashboard_publisher.log" 2>/dev/null || true
echo ""
echo "Site: https://sniperbo.com/app"
