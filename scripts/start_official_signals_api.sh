#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCAL_ENV="$SCRIPT_DIR/official_publisher.local.env"
LOG_DIR="$PROJECT_ROOT/logs"
LOG_FILE="$LOG_DIR/signals-api.log"
PID_FILE="$LOG_DIR/signals-api.pid"

# shellcheck source=scripts/lib/read_local_env.sh
source "$SCRIPT_DIR/lib/read_local_env.sh"

read_local_env "$LOCAL_ENV"

SIGNALS_API_PORT="${SIGNALS_API_PORT:-8787}"
SIGNALS_API_HOST="${SIGNALS_API_HOST:-127.0.0.1}"

# wrangler dev le credenciais admin de .dev.vars
if [[ -n "${SNIPER_ADMIN_EMAIL:-}" && -n "${SNIPER_ADMIN_PASSWORD:-}" ]]; then
  cat > "$PROJECT_ROOT/.dev.vars" <<EOF
SNIPER_ADMIN_EMAIL=$SNIPER_ADMIN_EMAIL
SNIPER_ADMIN_PASSWORD=$SNIPER_ADMIN_PASSWORD
SNIPER_VPS_LOCAL_OPEN_DASHBOARD=1
EOF
  chmod 600 "$PROJECT_ROOT/.dev.vars"
fi

mkdir -p "$LOG_DIR"

if [[ -f "$PID_FILE" ]]; then
  old_pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [[ -n "${old_pid:-}" ]] && kill -0 "$old_pid" 2>/dev/null; then
    if curl -fsS "http://${SIGNALS_API_HOST}:${SIGNALS_API_PORT}/health" >/dev/null 2>&1; then
      echo "signals-api already running pid=$old_pid port=$SIGNALS_API_PORT"
      exit 0
    fi
    kill "$old_pid" 2>/dev/null || true
    sleep 1
  fi
fi

if command -v lsof >/dev/null 2>&1; then
  while read -r pid; do
    [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true
  done < <(lsof -tiTCP:"$SIGNALS_API_PORT" -sTCP:LISTEN 2>/dev/null || true)
fi

cd "$PROJECT_ROOT"

if [[ ! -d node_modules ]]; then
  echo "Installing npm dependencies..."
  npm install
fi

export SIGNALS_API_PORT
export FRONTEND_PORT="${FRONTEND_PORT:-5175}"
export SNIPER_ADMIN_EMAIL="${SNIPER_ADMIN_EMAIL:-}"
export SNIPER_ADMIN_PASSWORD="${SNIPER_ADMIN_PASSWORD:-}"

nohup npx wrangler dev \
  --port "$SIGNALS_API_PORT" \
  --ip "$SIGNALS_API_HOST" \
  --local-protocol http \
  >>"$LOG_FILE" 2>&1 &

echo $! >"$PID_FILE"
sleep 4

if curl -fsS "http://${SIGNALS_API_HOST}:${SIGNALS_API_PORT}/health" >/dev/null; then
  echo "signals-api started pid=$(cat "$PID_FILE") http://${SIGNALS_API_HOST}:${SIGNALS_API_PORT}"
else
  echo "signals-api failed health check; see $LOG_FILE" >&2
  tail -n 30 "$LOG_FILE" >&2 || true
  exit 1
fi
