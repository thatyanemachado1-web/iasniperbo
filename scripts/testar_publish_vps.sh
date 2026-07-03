#!/usr/bin/env bash
# Testa publish sem token JWT — só e-mail + senha admin.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_ENV="$SCRIPT_DIR/official_publisher.local.env"

# shellcheck source=scripts/lib/read_local_env.sh
source "$SCRIPT_DIR/lib/read_local_env.sh"
read_local_env "$LOCAL_ENV"

EMAIL="${SNIPER_ADMIN_EMAIL:-}"
PASSWORD="${SNIPER_ADMIN_PASSWORD:-}"
REMOTE="${SNIPER_REMOTE_BASE_URL:-https://sniperbo.com}"

echo "=== Diagnóstico publish VPS (sem token) ==="
echo "email: ${EMAIL:-VAZIO}"
echo "password_len: ${#PASSWORD}"

if [[ -z "$EMAIL" || -z "$PASSWORD" ]]; then
  echo "ERRO: preencha SNIPER_ADMIN_EMAIL e SNIPER_ADMIN_PASSWORD em $LOCAL_ENV" >&2
  exit 1
fi

echo ""
echo "1) Login admin (max 10s)..."
HTTP_LOGIN="$(
  curl -s --connect-timeout 5 --max-time 10 -o /tmp/sniper_admin_login.json -w "%{http_code}" \
    -X POST "$REMOTE/admin/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" || echo "000"
)"
echo "   login HTTP $HTTP_LOGIN"

echo ""
echo "2) Publish probe (sem token, max 15s)..."
HTTP_CODE="$(
  curl -s --connect-timeout 5 --max-time 15 -o /tmp/sniper_publish_probe.json -w "%{http_code}" \
    -X POST "$REMOTE/dashboard/publish" \
    -H "Content-Type: application/json" \
    -H "User-Agent: Mozilla/5.0 SNIPERBO-Official-Publisher/1.0" \
    -H "x-sniper-admin-email: $EMAIL" \
    -H "x-sniper-admin-password: $PASSWORD" \
    -d '{"probe":true}' || echo "000"
)"
echo "   publish HTTP $HTTP_CODE"
head -c 200 /tmp/sniper_publish_probe.json 2>/dev/null || true
echo ""

if [[ "$HTTP_CODE" == "200" ]]; then
  echo "OK — publish sem token funcionando."
  echo "Reinicie: bash scripts/start_official_publisher.sh"
else
  echo "FALHOU — envie este print."
  exit 1
fi
