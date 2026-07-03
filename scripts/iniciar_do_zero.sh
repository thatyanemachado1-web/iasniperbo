#!/usr/bin/env bash
# RESET TOTAL + inicio limpo. Um comando so.
set -euo pipefail

REPO="https://github.com/thatyanemachado1-web/iasniperbo.git"
ROOT="/opt/iasniperbo"
EMAIL="${SNIPER_ADMIN_EMAIL:-gabrielmendespromove@gmail.com}"
PASS="${SNIPER_ADMIN_PASSWORD:-AdminSniper2026!}"
REMOTE="https://sniperbo.com"
LOCAL="http://127.0.0.1:8787"

curl_http_code() {
  local code=""
  code="$(curl "$@" -w "%{http_code}" 2>/dev/null)" || true
  echo "${code:0:3}"
}

echo ""
echo "=============================================="
echo "  SNIPERBO — INICIAR DO ZERO"
echo "=============================================="
echo ""

# --- 1. Parar e limpar ---
echo "[1/7] Apagando fluxo antigo..."
pkill -f official_dashboard_publisher.py 2>/dev/null || true
pkill -f vps_mesa_pulse.py 2>/dev/null || true
pkill -f "wrangler dev" 2>/dev/null || true
sleep 2

# --- 2. Repo limpo ---
echo "[2/7] Codigo fresco do GitHub..."
if [[ ! -d "$ROOT/.git" ]]; then
  mkdir -p "$(dirname "$ROOT")"
  git clone "$REPO" "$ROOT"
fi
cd "$ROOT"
git fetch origin main
git reset --hard origin/main
git clean -fdx -e .venv -e node_modules 2>/dev/null || true
chmod +x scripts/*.sh 2>/dev/null || true

# --- 3. Credenciais (sem token) ---
echo "[3/7] Credenciais..."
cat > scripts/official_publisher.local.env <<EOF
SNIPER_ADMIN_EMAIL=$EMAIL
SNIPER_ADMIN_PASSWORD=$PASS
SNIPER_PUBLISH_PASSWORD_ONLY=1
SNIPER_LOCAL_DASHBOARD_URL=$LOCAL/dashboard
SNIPER_REMOTE_BASE_URL=$REMOTE
SNIPER_REMOTE_PUBLISH_URL=$REMOTE/dashboard/publish
SIGNALS_API_PORT=8787
SIGNALS_API_HOST=127.0.0.1
PUBLISHER_INTERVAL=15
SNIPER_REMOTE_TIMEOUT=90
SNIPER_LOCAL_TIMEOUT=15
EOF
cat > .dev.vars <<EOF
SNIPER_ADMIN_EMAIL=$EMAIL
SNIPER_ADMIN_PASSWORD=$PASS
SNIPER_VPS_LOCAL_OPEN_DASHBOARD=1
EOF
chmod 600 scripts/official_publisher.local.env .dev.vars

# --- 4. Dependencias ---
echo "[4/7] Dependencias..."
python3 -m venv .venv 2>/dev/null || true
.venv/bin/pip install -q -r scripts/requirements-publisher.txt
if [[ ! -d node_modules ]]; then npm install --silent; fi

# --- 5. API local ---
echo "[5/7] Signals API (8787)..."
bash scripts/start_official_signals_api.sh
sleep 10

H="$(curl_http_code -s --connect-timeout 5 --max-time 10 -o /dev/null "$LOCAL/health")"
[[ "$H" == "200" ]] && echo "  health OK" || echo "  health $H (aguardando...)"

# --- 6. Publisher (sem urgent, sniperbo.com) ---
echo "[6/7] Publisher..."
bash scripts/start_official_publisher.sh
sleep 5

# --- 7. Primeiro publish ---
echo "[7/7] Enviando sinal pro site..."
curl -sS --connect-timeout 10 --max-time 20 \
  -H "User-Agent: Mozilla/5.0 SNIPERBO-Official-Publisher/1.0" \
  -H "x-sniper-admin-email: $EMAIL" \
  -H "x-sniper-admin-password: $PASS" \
  -o /tmp/sniper_zero_local.json "$LOCAL/dashboard" 2>/dev/null || true

if [[ -s /tmp/sniper_zero_local.json ]]; then
  PUB="$(curl_http_code -s --connect-timeout 15 --max-time 90 \
    -o /tmp/sniper_zero_pub.json \
    -X POST "$REMOTE/dashboard/publish" \
    -H "Content-Type: application/json" \
    -H "User-Agent: Mozilla/5.0 SNIPERBO-Official-Publisher/1.0" \
    -H "x-sniper-admin-email: $EMAIL" \
    -H "x-sniper-admin-password: $PASS" \
    -d @/tmp/sniper_zero_local.json)"
else
  PUB="$(curl_http_code -s --connect-timeout 15 --max-time 90 \
    -o /tmp/sniper_zero_pub.json \
    -X POST "$REMOTE/dashboard/publish" \
    -H "Content-Type: application/json" \
    -H "User-Agent: Mozilla/5.0 SNIPERBO-Official-Publisher/1.0" \
    -H "x-sniper-admin-email: $EMAIL" \
    -H "x-sniper-admin-password: $PASS" \
    -d '{"probe":true}')"
fi

SITE="$(curl -sS --connect-timeout 10 --max-time 20 "$REMOTE/dashboard" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
s=d.get('currentSignal') or {}
print(s.get('side','?'), s.get('status','?'))
" 2>/dev/null || echo "? ?")"

echo ""
echo "=============================================="
echo "  PRONTO — FLUXO NOVO"
echo "=============================================="
echo "  Publish site: HTTP $PUB"
echo "  Sinal no site: $SITE"
echo "  App: https://www.sniperbo.com/app  (sem login)"
echo ""
if pgrep -f official_dashboard_publisher.py >/dev/null; then
  echo "  Publisher: RODANDO"
else
  echo "  Publisher: PARADO — tail -f $ROOT/official_dashboard_publisher.log"
fi
echo "=============================================="
echo ""
