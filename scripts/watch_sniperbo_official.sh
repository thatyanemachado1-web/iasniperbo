#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"
WATCH_LOG="$LOG_DIR/sniperbo_official_watchdog.log"
PUBLISHER_LOG="$PROJECT_ROOT/official_dashboard_publisher.log"
INTERVAL_SECONDS=15
ONCE=false

for arg in "$@"; do
  case "$arg" in
    --once) ONCE=true ;;
    [0-9]*) INTERVAL_SECONDS="$arg" ;;
  esac
done

# shellcheck source=scripts/lib/read_local_env.sh
source "$SCRIPT_DIR/lib/read_local_env.sh"
read_local_env "$SCRIPT_DIR/official_publisher.local.env"

SIGNALS_API_PORT="${SIGNALS_API_PORT:-8787}"
SIGNALS_API_HOST="${SIGNALS_API_HOST:-127.0.0.1}"

mkdir -p "$LOG_DIR"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$WATCH_LOG"
}

signals_ok() {
  curl -fsS "http://${SIGNALS_API_HOST}:${SIGNALS_API_PORT}/health" 2>/dev/null |
    grep -q '"service"[[:space:]]*:[[:space:]]*"signals-api"'
}

publisher_ok() {
  pgrep -f "official_dashboard_publisher.py" >/dev/null 2>&1
}

publisher_log_fresh() {
  [[ -f "$PUBLISHER_LOG" ]] || return 1
  local age
  age=$(( $(date +%s) - $(stat -c %Y "$PUBLISHER_LOG" 2>/dev/null || stat -f %m "$PUBLISHER_LOG") ))
  [[ "$age" -le 45 ]]
}

tick() {
  if ! signals_ok; then
    log "signals-api down; starting port=$SIGNALS_API_PORT"
    bash "$SCRIPT_DIR/start_official_signals_api.sh" || log "signals-api start failed"
  else
    log "signals-api ok port=$SIGNALS_API_PORT"
  fi

  if publisher_ok; then
    log "publisher ok"
  elif publisher_log_fresh; then
    log "publisher ok log-fresh"
  else
    log "publisher down; starting"
    bash "$SCRIPT_DIR/start_official_publisher.sh" || log "publisher start failed"
  fi
}

log "official watchdog started signals=$SIGNALS_API_PORT interval=${INTERVAL_SECONDS}s"

if [[ "$ONCE" == "--once" ]]; then
  tick
  exit 0
fi

while true; do
  tick || log "watchdog tick error"
  sleep "$INTERVAL_SECONDS"
done
