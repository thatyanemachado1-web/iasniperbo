#!/usr/bin/env bash
# Um comando só — liga sinais na VPS (sem token, só e-mail+senha).
set -euo pipefail

ROOT="/opt/iasniperbo"
cd "$ROOT"

echo ""
echo "=== SNIPERBO LIGAR AGORA ==="
echo ""

echo "[1/6] Parando processos antigos..."
pkill -f official_dashboard_publisher.py 2>/dev/null || true
sleep 2

echo "[2/6] Baixando scripts atualizados..."
curl -fsSL -o scripts/official_dashboard_publisher.py \
  https://raw.githubusercontent.com/thatyanemachado1-web/iasniperbo/main/scripts/official_dashboard_publisher.py
curl -fsSL -o scripts/start_official_publisher.sh \
  https://raw.githubusercontent.com/thatyanemachado1-web/iasniperbo/main/scripts/start_official_publisher.sh
curl -fsSL -o scripts/start_official_signals_api.sh \
  https://raw.githubusercontent.com/thatyanemachado1-web/iasniperbo/main/scripts/start_official_signals_api.sh
chmod +x scripts/*.sh

echo "[3/6] Criando .env (sem token)..."
cat > scripts/official_publisher.local.env << 'EOF'
SNIPER_ADMIN_EMAIL=gabrielmendespromove@gmail.com
SNIPER_ADMIN_PASSWORD=AdminSniper2026!
SNIPER_PUBLISH_PASSWORD_ONLY=1
SNIPER_VPS_LOCAL_OPEN_DASHBOARD=1
SNIPER_LOCAL_DASHBOARD_URL=http://127.0.0.1:8787/dashboard
SIGNALS_API_PORT=8787
SIGNALS_API_HOST=127.0.0.1
PUBLISHER_INTERVAL=1.5
EOF
cat > .dev.vars << 'EOF'
SNIPER_ADMIN_EMAIL=gabrielmendespromove@gmail.com
SNIPER_ADMIN_PASSWORD=AdminSniper2026!
SNIPER_VPS_LOCAL_OPEN_DASHBOARD=1
EOF
chmod 600 scripts/official_publisher.local.env .dev.vars
echo "   .env OK"

echo "   Testando senha no site (sem token)..."
PUB_HTTP=$(curl -s --connect-timeout 5 --max-time 12 -o /tmp/sniper_pub_test.json -w "%{http_code}" \
  -X POST "https://sniperbo.com/dashboard/publish" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0 SNIPERBO-Official-Publisher/1.0" \
  -H "x-sniper-admin-email: gabrielmendespromove@gmail.com" \
  -H "x-sniper-admin-password: AdminSniper2026!" \
  -d '{"probe":true}' || echo "000")
if [[ "$PUB_HTTP" != "200" ]]; then
  echo ""
  echo "ERRO: senha rejeitada pelo site (HTTP $PUB_HTTP)."
  echo "A senha correta e: AdminSniper2026!  (A maiusculo no Admin)"
  echo "Corrija scripts/official_publisher.local.env e rode de novo."
  exit 1
fi
echo "   senha OK (HTTP 200)"

echo "[4/6] Python + dependências..."
python3 -m venv .venv 2>/dev/null || true
.venv/bin/pip install -q -r scripts/requirements-publisher.txt
if [[ ! -d node_modules ]]; then npm install; fi

echo "[5/6] Ligando signals-api (reinicia sempre)..."
pkill -f "wrangler dev" 2>/dev/null || true
sleep 2
bash scripts/start_official_signals_api.sh || echo "   AVISO: signals-api falhou — veja logs/signals-api.log"
sleep 5
curl -s --connect-timeout 3 http://127.0.0.1:8787/health && echo "   signals-api OK" || echo "   signals-api OFFLINE"
curl -s --connect-timeout 3 -H "User-Agent: Mozilla/5.0 SNIPERBO-Official-Publisher/1.0" \
  -H "x-sniper-admin-email: gabrielmendespromove@gmail.com" \
  -H "x-sniper-admin-password: AdminSniper2026!" \
  http://127.0.0.1:8787/dashboard | head -c 80 && echo "   dashboard local OK" || echo "   dashboard local FALHOU"

echo "[6/6] Ligando publisher..."
bash scripts/start_official_publisher.sh
sleep 5

echo ""
echo "=== RESULTADO ==="
if pgrep -f official_dashboard_publisher.py >/dev/null; then
  echo "PUBLISHER: RODANDO (pid $(pgrep -f official_dashboard_publisher.py | head -1))"
else
  echo "PUBLISHER: PARADO — veja log abaixo"
fi

echo ""
echo "=== ULTIMAS 12 LINHAS DO LOG ==="
tail -n 12 "$ROOT/official_dashboard_publisher.log" 2>/dev/null || echo "(log vazio)"
echo ""
echo "Site: https://www.sniperbo.com/app"
echo ""
