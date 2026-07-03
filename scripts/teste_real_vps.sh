#!/usr/bin/env bash
# Teste REAL ponta a ponta na VPS — diagnostica e corrige 401 de vez.
# Versao: 2026-07-03-reexec (curl|bash re-roda copia do git apos passo 1)
set -euo pipefail

ROOT="/opt/iasniperbo"
ENV_FILE="$ROOT/scripts/official_publisher.local.env"
REMOTE="https://sniperbo.com"
LOCAL="http://127.0.0.1:8787"
SCRIPT_SELF="$ROOT/scripts/teste_real_vps.sh"

cd "$ROOT"

pass() { echo "  [OK] $1"; }
fail() { echo "  [FALHOU] $1"; FAIL=1; }
warn() { echo "  [AVISO] $1"; }

FAIL=0

echo ""
echo "=========================================="
echo "  SNIPERBO — TESTE REAL VPS"
echo "=========================================="
echo ""

# --- 1. Código atualizado ---
echo "[1] Atualizando código..."
git fetch origin 2>/dev/null && git reset --hard origin/main 2>/dev/null && pass "git main atualizado" || warn "git falhou — usando arquivos locais"
curl -fsSL -o scripts/official_dashboard_publisher.py \
  "https://raw.githubusercontent.com/thatyanemachado1-web/iasniperbo/main/scripts/official_dashboard_publisher.py" \
  && pass "publisher.py baixado" || fail "nao baixou publisher.py"
curl -fsSL -o scripts/start_official_signals_api.sh \
  "https://raw.githubusercontent.com/thatyanemachado1-web/iasniperbo/main/scripts/start_official_signals_api.sh" \
  && pass "start_official_signals_api.sh baixado" || fail "nao baixou signals-api script"
curl -fsSL -o scripts/start_official_publisher.sh \
  "https://raw.githubusercontent.com/thatyanemachado1-web/iasniperbo/main/scripts/start_official_publisher.sh" \
  && pass "start_official_publisher.sh baixado" || warn "nao baixou start_official_publisher.sh"
curl -fsSL -o scripts/teste_real_vps.sh \
  "https://raw.githubusercontent.com/thatyanemachado1-web/iasniperbo/main/scripts/teste_real_vps.sh" \
  && pass "teste_real_vps.sh baixado" || warn "nao baixou teste_real_vps.sh"
chmod +x scripts/*.sh 2>/dev/null || true

# curl|bash executa versao antiga em memoria — re-roda a copia atualizada do git.
if [[ -z "${SNIPER_VPS_TEST_REEXEC:-}" && -f "$SCRIPT_SELF" ]]; then
  export SNIPER_VPS_TEST_REEXEC=1
  exec bash "$SCRIPT_SELF"
fi

# --- 2. .env ---
echo ""
echo "[2] Conferindo credenciais..."
if [[ ! -f "$ENV_FILE" ]]; then
  fail "arquivo $ENV_FILE nao existe"
else
  # shellcheck source=scripts/lib/read_local_env.sh
  source "$ROOT/scripts/lib/read_local_env.sh"
  read_local_env "$ENV_FILE"
  echo "  email: ${SNIPER_ADMIN_EMAIL:-VAZIO}"
  echo "  senha_len: ${#SNIPER_ADMIN_PASSWORD}"
  if [[ -z "${SNIPER_ADMIN_EMAIL:-}" || -z "${SNIPER_ADMIN_PASSWORD:-}" ]]; then
    fail "email ou senha vazios no .env"
  elif [[ "${SNIPER_ADMIN_PASSWORD:0:1}" != "A" ]]; then
    fail "senha deve comecar com A maiusculo: AdminSniper2026!"
  else
    pass "email e senha preenchidos"
  fi
fi

EMAIL="${SNIPER_ADMIN_EMAIL:-gabrielmendespromove@gmail.com}"
PASS="${SNIPER_ADMIN_PASSWORD:-AdminSniper2026!}"

# --- 3. Teste REMOTO (site) ---
echo ""
echo "[3] Teste REMOTO — sniperbo.com (sem token, so senha)..."
R_HTTP=$(curl -s --connect-timeout 8 --max-time 15 -o /tmp/sniper_remote_pub.json -w "%{http_code}" \
  -X POST "$REMOTE/dashboard/publish" \
  -H "Content-Type: application/json" \
  -H "User-Agent: Mozilla/5.0 SNIPERBO-Official-Publisher/1.0" \
  -H "x-sniper-admin-email: $EMAIL" \
  -H "x-sniper-admin-password: $PASS" \
  -d '{"probe":true}' || echo "000")
if [[ "$R_HTTP" == "200" ]]; then
  pass "publish remoto HTTP 200 — email e senha corretos no SITE"
else
  fail "publish remoto HTTP $R_HTTP — senha ou email errados no site"
  head -c 150 /tmp/sniper_remote_pub.json 2>/dev/null; echo ""
fi

# --- 4. Reinicia signals-api com codigo novo ---
echo ""
echo "[4] Reiniciando signals-api local (8787)..."
pkill -f "official_dashboard_publisher.py" 2>/dev/null || true
pkill -f "wrangler dev" 2>/dev/null || true
sleep 3
# credenciais para wrangler dev (.dev.vars)
cat > "$ROOT/.dev.vars" <<EOF
SNIPER_ADMIN_EMAIL=$EMAIL
SNIPER_ADMIN_PASSWORD=$PASS
SNIPER_VPS_LOCAL_OPEN_DASHBOARD=1
EOF
chmod 600 "$ROOT/.dev.vars"
pass ".dev.vars criado para wrangler"
python3 -m venv .venv 2>/dev/null || true
.venv/bin/pip install -q -r scripts/requirements-publisher.txt 2>/dev/null || true
[[ -d node_modules ]] || npm install --silent 2>/dev/null
bash scripts/start_official_signals_api.sh || fail "signals-api nao subiu"
sleep 8

H_HTTP=$(curl -s --connect-timeout 5 -o /tmp/sniper_health.json -w "%{http_code}" "$LOCAL/health" || echo "000")
if [[ "$H_HTTP" == "200" ]]; then
  pass "health local HTTP 200"
else
  fail "health local HTTP $H_HTTP"
  tail -n 15 "$ROOT/logs/signals-api.log" 2>/dev/null || true
fi

# --- 5. Teste LOCAL dashboard ---
echo ""
echo "[5] Teste LOCAL — 127.0.0.1:8787/dashboard..."
L_HTTP=$(curl -s --connect-timeout 5 --max-time 10 -o /tmp/sniper_local_dash.json -w "%{http_code}" \
  -H "User-Agent: Mozilla/5.0 SNIPERBO-Official-Publisher/1.0" \
  -H "x-sniper-admin-email: $EMAIL" \
  -H "x-sniper-admin-password: $PASS" \
  "$LOCAL/dashboard" || echo "000")
if [[ "$L_HTTP" == "200" ]]; then
  pass "dashboard local HTTP 200"
  ROUNDS=$(python3 -c "import json; d=json.load(open('/tmp/sniper_local_dash.json')); print(len(d.get('rounds',[])))" 2>/dev/null || echo "?")
  echo "  rodadas locais: $ROUNDS"
else
  fail "dashboard local HTTP $L_HTTP — ESTE e o 401 que voce ve no log"
  head -c 150 /tmp/sniper_local_dash.json 2>/dev/null; echo ""
  echo "  >> Corrigindo: git pull + reiniciar wrangler..."
  git pull origin main 2>/dev/null || true
  pkill -f "wrangler dev" 2>/dev/null || true
  sleep 2
  bash scripts/start_official_signals_api.sh
  sleep 8
  L_HTTP2=$(curl -s --connect-timeout 5 -o /dev/null -w "%{http_code}" \
    -H "User-Agent: Mozilla/5.0 SNIPERBO-Official-Publisher/1.0" \
    -H "x-sniper-admin-email: $EMAIL" \
    -H "x-sniper-admin-password: $PASS" \
    "$LOCAL/dashboard" || echo "000")
  if [[ "$L_HTTP2" == "200" ]]; then
    pass "dashboard local HTTP 200 apos reinicio"
  else
    fail "dashboard local ainda HTTP $L_HTTP2"
  fi
fi

# --- 6. Teste Python publisher (1 ciclo) ---
echo ""
echo "[6] Teste Python publisher..."
cat > "$ENV_FILE" <<EOF
SNIPER_ADMIN_EMAIL=$EMAIL
SNIPER_ADMIN_PASSWORD=$PASS
SNIPER_PUBLISH_PASSWORD_ONLY=1
SNIPER_LOCAL_DASHBOARD_URL=http://127.0.0.1:8787/dashboard
SIGNALS_API_PORT=8787
SIGNALS_API_HOST=127.0.0.1
PUBLISHER_INTERVAL=1.5
SNIPER_REMOTE_TIMEOUT=45
SNIPER_LOCAL_TIMEOUT=10
EOF
chmod 600 "$ENV_FILE"

timeout 65 .venv/bin/python scripts/official_dashboard_publisher.py \
  --env-file "$ENV_FILE" \
  --local-url "http://127.0.0.1:8787/dashboard" \
  --interval 2 \
  --remote-timeout 45 \
  --local-timeout 10 \
  --no-urgent-signal \
  --log-file /tmp/sniper_test_pub.log 2>/tmp/sniper_test_pub.log &
TPID=$!
sleep 50
kill "$TPID" 2>/dev/null || true

if grep -q "Published official dashboard" /tmp/sniper_test_pub.log 2>/dev/null; then
  pass "Python publicou no site com sucesso"
  grep "Published official dashboard" /tmp/sniper_test_pub.log | tail -1
elif grep -q "Local dashboard HTTP 401" /tmp/sniper_test_pub.log 2>/dev/null; then
  fail "Python: 401 na API LOCAL (8787) — signals-api precisa codigo novo"
  grep -E "401|403|Publish|Local dashboard" /tmp/sniper_test_pub.log | tail -5
elif grep -q "ReadTimeout\|Publish failed\|timeout" /tmp/sniper_test_pub.log 2>/dev/null; then
  fail "Python: timeout ao publicar no site — VPS lenta, mas auth OK"
  grep -E "timeout|Timeout|Published|Publish" /tmp/sniper_test_pub.log | tail -5
else
  fail "Python nao publicou em 50s — veja log:"
  tail -n 12 /tmp/sniper_test_pub.log 2>/dev/null || true
fi

# --- 7. Site ao vivo ---
echo ""
echo "[7] Conferindo site ao vivo..."
SITE_UPD=$(curl -s --connect-timeout 8 "$REMOTE/dashboard" | python3 -c "
import sys,json
d=json.load(sys.stdin)
s=d.get('currentSignal') or {}
print('signal:', s.get('side'), s.get('status'), '| updated:', d.get('updatedAt','?')[:19])
" 2>/dev/null || echo "nao leu dashboard")
echo "  $SITE_UPD"

# --- Resultado ---
echo ""
echo "=========================================="
if [[ "$FAIL" -eq 0 ]]; then
  echo "  RESULTADO: TUDO OK — pode ligar de vez:"
  echo "  bash scripts/start_official_publisher.sh"
else
  echo "  RESULTADO: TEM ERRO — copie TUDO acima e mande print"
fi
echo "=========================================="
echo ""

exit "$FAIL"
