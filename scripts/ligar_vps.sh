#!/usr/bin/env bash
# Bootstrap completo na VPS Hostinger (Ubuntu) — signals API + publisher + systemd.
set -euo pipefail

REPO_URL="${SNIPER_REPO_URL:-https://github.com/thatyanemachado1-web/iasniperbo.git}"
REPO_BRANCH="${SNIPER_REPO_BRANCH:-main}"
INSTALL_DIR="${SNIPER_INSTALL_DIR:-/opt/iasniperbo}"
RUN_USER="${SNIPER_RUN_USER:-sniper}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo ""
echo "=== SNIPERBO VPS — bootstrap (${INSTALL_DIR}) ==="
echo ""

need_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    echo "Execute como root: sudo bash scripts/ligar_vps.sh" >&2
    exit 1
  fi
}

ensure_user() {
  if ! id "$RUN_USER" &>/dev/null; then
    useradd -m -s /bin/bash "$RUN_USER"
    echo "Usuário criado: $RUN_USER"
  fi
}

ensure_repo() {
  if [[ ! -d "$INSTALL_DIR/.git" ]]; then
    mkdir -p "$(dirname "$INSTALL_DIR")"
    git clone --branch "$REPO_BRANCH" "$REPO_URL" "$INSTALL_DIR"
  else
    cd "$INSTALL_DIR"
    git fetch origin "$REPO_BRANCH"
    git checkout "$REPO_BRANCH" 2>/dev/null || git checkout -b "$REPO_BRANCH" "origin/$REPO_BRANCH"
    git pull origin "$REPO_BRANCH"
  fi
  chown -R "$RUN_USER:$RUN_USER" "$INSTALL_DIR"
}

ensure_env() {
  local env_file="$INSTALL_DIR/scripts/official_publisher.local.env"
  local example="$INSTALL_DIR/scripts/official_publisher.local.env.example"
  if [[ -f "$env_file" ]]; then
    echo "Env OK: $env_file"
    return
  fi
  if [[ -f "$example" ]]; then
    cp "$example" "$env_file"
    chown "$RUN_USER:$RUN_USER" "$env_file"
    echo ""
    echo "CRIADO $env_file — preencha SNIPER_ADMIN_EMAIL, SNIPER_ADMIN_PASSWORD e SNIPER_ADMIN_TOKEN."
    echo "Depois rode de novo: sudo bash scripts/ligar_vps.sh"
    exit 1
  fi
  echo "Faltando $example" >&2
  exit 1
}

ensure_python() {
  apt-get update -qq
  apt-get install -y -qq git curl python3 python3-venv python3-pip lsof ca-certificates
  sudo -u "$RUN_USER" bash -lc "
    cd '$INSTALL_DIR'
    if [[ ! -d .venv ]]; then python3 -m venv .venv; fi
    .venv/bin/pip install -q -r scripts/requirements-publisher.txt
  "
}

ensure_node() {
  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
  fi
  sudo -u "$RUN_USER" bash -lc "
    cd '$INSTALL_DIR'
    if [[ ! -d node_modules ]]; then npm install; fi
  "
}

install_systemd() {
  mkdir -p "$INSTALL_DIR/logs"
  chown -R "$RUN_USER:$RUN_USER" "$INSTALL_DIR/logs"
  cp "$INSTALL_DIR/deploy/systemd/"*.service /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable sniper-signals-api sniper-publisher sniper-watchdog
  systemctl restart sniper-signals-api
  sleep 5
  systemctl restart sniper-publisher
  systemctl restart sniper-watchdog
}

show_status() {
  echo ""
  echo "=== Serviços ==="
  systemctl is-active sniper-signals-api sniper-publisher sniper-watchdog || true
  echo ""
  echo "=== Health local ==="
  curl -fsS "http://127.0.0.1:8787/health" && echo || echo "signals-api offline"
  echo ""
  echo "=== Publisher log (últimas linhas) ==="
  tail -n 8 "$INSTALL_DIR/official_dashboard_publisher.log" 2>/dev/null || true
  echo ""
  echo "Site: https://www.sniperbo.com/app"
  echo "Diagnóstico: sudo -u $RUN_USER bash $INSTALL_DIR/scripts/diagnose_official_publisher.sh --restart --smoke"
}

if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
  need_root
  ensure_user
  ensure_repo
  ensure_env
  ensure_python
  ensure_node
  install_systemd
  show_status
else
  # Já dentro do repo como usuário sniper — só liga processos.
  cd "$PROJECT_ROOT"
  bash "$SCRIPT_DIR/ligar_sinais.sh"
  bash "$SCRIPT_DIR/watch_sniperbo_official.sh" --once
  show_status() {
    curl -fsS "http://127.0.0.1:${SIGNALS_API_PORT:-8787}/health" && echo || echo "signals-api offline"
    tail -n 5 "$PROJECT_ROOT/official_dashboard_publisher.log" 2>/dev/null || true
  }
  show_status
fi
