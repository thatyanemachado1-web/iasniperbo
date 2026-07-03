#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCAL_ENV="$SCRIPT_DIR/official_publisher.local.env"
LOG_FILE="$PROJECT_ROOT/official_dashboard_publisher.log"
PID_FILE="$PROJECT_ROOT/logs/official-publisher.pid"

# shellcheck source=scripts/lib/read_local_env.sh
source "$SCRIPT_DIR/lib/read_local_env.sh"

read_local_env "$LOCAL_ENV"

PYTHON_BIN="${PYTHON_EXE:-python3}"
SIGNALS_API_PORT="${SIGNALS_API_PORT:-8787}"
SIGNALS_API_HOST="${SIGNALS_API_HOST:-127.0.0.1}"
PUBLISHER_INTERVAL="${PUBLISHER_INTERVAL:-10}"
REMOTE_TIMEOUT="${SNIPER_REMOTE_TIMEOUT:-45}"
LOCAL_TIMEOUT="${SNIPER_LOCAL_TIMEOUT:-10}"
LOCAL_DASHBOARD_URL="${SNIPER_LOCAL_DASHBOARD_URL:-http://${SIGNALS_API_HOST}:${SIGNALS_API_PORT}/dashboard}"
SOURCE_ENV_FILE="${SNIPER_SOURCE_ENV_FILE:-$LOCAL_ENV}"

mkdir -p "$PROJECT_ROOT/logs"

if [[ ! -f "$LOCAL_ENV" ]]; then
  echo "Missing $LOCAL_ENV — copy scripts/official_publisher.local.env.example" >&2
  exit 1
fi

for key in SNIPER_ADMIN_EMAIL SNIPER_ADMIN_PASSWORD; do
  if [[ -z "${!key:-}" ]]; then
    echo "Missing $key in $LOCAL_ENV" >&2
    exit 1
  fi
done

if pgrep -f "official_dashboard_publisher.py" >/dev/null 2>&1; then
  pkill -f "official_dashboard_publisher.py" || true
  sleep 1
fi

if [[ -x "$PROJECT_ROOT/.venv/bin/python" ]]; then
  PYTHON_BIN="$PROJECT_ROOT/.venv/bin/python"
elif [[ -x "$PROJECT_ROOT/.venv/Scripts/python.exe" ]]; then
  PYTHON_BIN="$PROJECT_ROOT/.venv/Scripts/python.exe"
fi

"$PYTHON_BIN" -m pip install -q -r "$SCRIPT_DIR/requirements-publisher.txt"

export SNIPER_ADMIN_EMAIL SNIPER_ADMIN_PASSWORD
export SNIPER_PUBLISH_PASSWORD_ONLY="${SNIPER_PUBLISH_PASSWORD_ONLY:-1}"
export SNIPER_LOCAL_DASHBOARD_TOKEN="${SNIPER_LOCAL_DASHBOARD_TOKEN:-}"
export SNIPER_PUBLISHER_TOKEN="${SNIPER_PUBLISHER_TOKEN:-}"
export SNIPER_REMOTE_DASHBOARD_TOKEN="${SNIPER_REMOTE_DASHBOARD_TOKEN:-}"
export SIGNALS_API_PORT FRONTEND_PORT="${FRONTEND_PORT:-5175}"

cd "$PROJECT_ROOT"

nohup "$PYTHON_BIN" "$SCRIPT_DIR/official_dashboard_publisher.py" \
  --env-file "$SOURCE_ENV_FILE" \
  --local-url "$LOCAL_DASHBOARD_URL" \
  --interval "$PUBLISHER_INTERVAL" \
  --remote-timeout "$REMOTE_TIMEOUT" \
  --local-timeout "$LOCAL_TIMEOUT" \
  --no-urgent-signal \
  --log-file "$LOG_FILE" \
  >>"$LOG_FILE" 2>&1 &

echo $! >"$PID_FILE"
sleep 2

if pgrep -f "official_dashboard_publisher.py" >/dev/null; then
  echo "official publisher started pid=$(cat "$PID_FILE")"
  echo "log: $LOG_FILE"
else
  echo "publisher failed to start; see $LOG_FILE" >&2
  tail -n 20 "$LOG_FILE" >&2 || true
  exit 1
fi
