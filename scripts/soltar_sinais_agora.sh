#!/usr/bin/env bash
# UM COMANDO — liga sinais no site. Cole na VPS e pronto.
set -euo pipefail

ROOT="/opt/iasniperbo"
EMAIL="${SNIPER_ADMIN_EMAIL:-gabrielmendespromove@gmail.com}"
PASS="${SNIPER_ADMIN_PASSWORD:-AdminSniper2026!}"
REMOTE="https://sniperbo.com"
LOCAL="http://127.0.0.1:8787"

curl_http_code() {
  local code=""
  code="$(curl "$@" -w "%{http_code}" 2>/dev/null)" || true
  code="${code:-000}"
  echo "${code:0:3}"
}

cd "$ROOT" 2>/dev/null || { echo "ERRO: pasta $ROOT nao existe"; exit 1; }

echo ""
echo "=============================================="
echo "  SNIPERBO — SOLTAR SINAIS AGORA"
echo "=============================================="
echo ""
echo "  Login site (navegador):"
echo "    E-mail: $EMAIL"
echo "    Senha:  $PASS"
echo "    (A maiusculo no Admin)"
echo ""

echo "[1/5] Atualizando codigo..."
git fetch origin 2>/dev/null && git reset --hard origin/main 2>/dev/null || true
curl -fsSL -o scripts/official_dashboard_publisher.py \
  "https://raw.githubusercontent.com/thatyanemachado1-web/iasniperbo/main/scripts/official_dashboard_publisher.py"
curl -fsSL -o scripts/start_official_publisher.sh \
  "https://raw.githubusercontent.com/thatyanemachado1-web/iasniperbo/main/scripts/start_official_publisher.sh"
curl -fsSL -o scripts/start_official_signals_api.sh \
  "https://raw.githubusercontent.com/thatyanemachado1-web/iasniperbo/main/scripts/start_official_signals_api.sh"
chmod +x scripts/*.sh

echo "[2/5] Credenciais..."
cat > scripts/official_publisher.local.env <<EOF
SNIPER_ADMIN_EMAIL=$EMAIL
SNIPER_ADMIN_PASSWORD=$PASS
SNIPER_PUBLISH_PASSWORD_ONLY=1
SNIPER_LOCAL_DASHBOARD_URL=$LOCAL/dashboard
SIGNALS_API_PORT=8787
SIGNALS_API_HOST=127.0.0.1
PUBLISHER_INTERVAL=5
SNIPER_REMOTE_TIMEOUT=45
SNIPER_LOCAL_TIMEOUT=10
EOF
cat > .dev.vars <<EOF
SNIPER_ADMIN_EMAIL=$EMAIL
SNIPER_ADMIN_PASSWORD=$PASS
SNIPER_VPS_LOCAL_OPEN_DASHBOARD=1
EOF
chmod 600 scripts/official_publisher.local.env .dev.vars

echo "[3/5] Parando processos antigos..."
pkill -f official_dashboard_publisher.py 2>/dev/null || true
pkill -f "wrangler dev" 2>/dev/null || true
sleep 3

echo "[4/5] Subindo API local + publisher..."
python3 -m venv .venv 2>/dev/null || true
.venv/bin/pip install -q -r scripts/requirements-publisher.txt 2>/dev/null || true
[[ -d node_modules ]] || npm install --silent 2>/dev/null || true
bash scripts/start_official_signals_api.sh
sleep 6
bash scripts/start_official_publisher.sh
sleep 8

echo "[5/5] Publicando no site..."
curl -s --connect-timeout 10 --max-time 20 \
  -H "User-Agent: Mozilla/5.0 SNIPERBO-Official-Publisher/1.0" \
  -H "x-sniper-admin-email: $EMAIL" \
  -H "x-sniper-admin-password: $PASS" \
  -o /tmp/sniper_local_dash.json \
  "$LOCAL/dashboard" >/dev/null 2>&1 || true

PUB="$(curl_http_code -s --connect-timeout 15 --max-time 60 \
  -o /tmp/sniper_force_pub.json \
  -X POST "$REMOTE/dashboard/publish" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0 SNIPERBO-Official-Publisher/1.0" \
  -H "x-sniper-admin-email: $EMAIL" \
  -H "x-sniper-admin-password: $PASS" \
  -d @/tmp/sniper_local_dash.json 2>/dev/null || echo "000")"

if [[ "$PUB" != "200" ]]; then
  PUB="$(curl_http_code -s --connect-timeout 15 --max-time 60 \
    -o /tmp/sniper_force_pub.json \
    -X POST "$REMOTE/dashboard/publish" \
    -H "Content-Type: application/json" \
    -H "User-Agent: Mozilla/5.0 SNIPERBO-Official-Publisher/1.0" \
    -H "x-sniper-admin-email: $EMAIL" \
    -H "x-sniper-admin-password: $PASS" \
    -d '{"probe":true}')"
fi

echo ""
echo "=============================================="
if pgrep -f official_dashboard_publisher.py >/dev/null; then
  echo "  PUBLISHER: RODANDO"
else
  echo "  PUBLISHER: PARADO — veja official_dashboard_publisher.log"
fi
echo "  Publish site: HTTP $PUB"
echo "  App: https://www.sniperbo.com/app"
echo ""
echo "  Login:"
echo "    $EMAIL"
echo "    $PASS"
echo "=============================================="
echo ""
tail -n 6 "$ROOT/official_dashboard_publisher.log" 2>/dev/null || true
echo ""
