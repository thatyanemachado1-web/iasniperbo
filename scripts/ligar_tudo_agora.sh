#!/usr/bin/env bash
# LIGA TUDO — API + pulse de rodadas + publisher + publish no site. Sem login no /app.
set -euo pipefail

ROOT="/opt/iasniperbo"
EMAIL="${SNIPER_ADMIN_EMAIL:-gabrielmendespromove@gmail.com}"
PASS="${SNIPER_ADMIN_PASSWORD:-AdminSniper2026!}"
REMOTE="https://sniperbo.com"
LOCAL="http://127.0.0.1:8787"

cd "$ROOT" 2>/dev/null || { echo "ERRO: $ROOT nao existe"; exit 1; }

echo ""
echo "=========================================="
echo "  SNIPERBO — LIGAR TUDO AGORA"
echo "=========================================="

git fetch origin 2>/dev/null && git reset --hard origin/main 2>/dev/null || true
chmod +x scripts/*.sh 2>/dev/null || true

cat > scripts/official_publisher.local.env <<EOF
SNIPER_ADMIN_EMAIL=$EMAIL
SNIPER_ADMIN_PASSWORD=$PASS
SNIPER_PUBLISH_PASSWORD_ONLY=1
SNIPER_LOCAL_DASHBOARD_URL=$LOCAL/dashboard
SIGNALS_API_PORT=8787
SIGNALS_API_HOST=127.0.0.1
PUBLISHER_INTERVAL=8
SNIPER_REMOTE_TIMEOUT=60
SNIPER_LOCAL_TIMEOUT=15
EOF
cat > .dev.vars <<EOF
SNIPER_ADMIN_EMAIL=$EMAIL
SNIPER_ADMIN_PASSWORD=$PASS
SNIPER_VPS_LOCAL_OPEN_DASHBOARD=1
EOF
chmod 600 scripts/official_publisher.local.env .dev.vars

pkill -f vps_mesa_pulse.py 2>/dev/null || true
pkill -f official_dashboard_publisher.py 2>/dev/null || true
pkill -f "wrangler dev" 2>/dev/null || true
sleep 2

python3 -m venv .venv 2>/dev/null || true
.venv/bin/pip install -q -r scripts/requirements-publisher.txt 2>/dev/null || true
[[ -d node_modules ]] || npm install --silent 2>/dev/null || true

bash scripts/start_official_signals_api.sh
sleep 8

echo ">> Primeira rodada (acorda motor)..."
.venv/bin/python scripts/vps_mesa_pulse.py --once --env-file scripts/official_publisher.local.env || true
sleep 2

echo ">> Publisher..."
bash scripts/start_official_publisher.sh
sleep 3

echo ">> Pulse continuo (rodadas a cada 35s)..."
nohup .venv/bin/python scripts/vps_mesa_pulse.py \
  --env-file scripts/official_publisher.local.env \
  --interval 35 \
  >> logs/vps-mesa-pulse.log 2>&1 &
echo $! > logs/vps-mesa-pulse.pid

sleep 5
curl -sS --connect-timeout 10 --max-time 25 \
  -H "User-Agent: Mozilla/5.0 SNIPERBO-Official-Publisher/1.0" \
  -H "x-sniper-admin-email: $EMAIL" \
  -H "x-sniper-admin-password: $PASS" \
  "$LOCAL/dashboard" | python3 -c "
import sys,json
d=json.load(sys.stdin)
s=d.get('currentSignal') or {}
print('LOCAL rounds', len(d.get('rounds',[])), 'signal', s.get('status'), s.get('side'))
" 2>/dev/null || echo "local dashboard aguardando..."

echo ""
echo "=========================================="
echo "  SITE: https://www.sniperbo.com/app"
echo "  (sem login — so abrir)"
echo ""
if pgrep -f official_dashboard_publisher.py >/dev/null; then echo "  Publisher: RODANDO"; else echo "  Publisher: PARADO"; fi
if pgrep -f vps_mesa_pulse.py >/dev/null; then echo "  Pulse mesa: RODANDO"; else echo "  Pulse mesa: PARADO"; fi
echo "=========================================="
tail -n 4 official_dashboard_publisher.log 2>/dev/null || true
echo ""
