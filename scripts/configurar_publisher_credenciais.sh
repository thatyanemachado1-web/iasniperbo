#!/usr/bin/env bash
# Valida login admin e grava e-mail/senha (sem token JWT).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_ENV="$SCRIPT_DIR/official_publisher.local.env"

# shellcheck source=scripts/lib/read_local_env.sh
source "$SCRIPT_DIR/lib/read_local_env.sh"
read_local_env "$LOCAL_ENV"

EMAIL="${SNIPER_ADMIN_EMAIL:-gabrielmendespromove@gmail.com}"
PASSWORD="${SNIPER_ADMIN_PASSWORD:-}"
REMOTE="${SNIPER_REMOTE_BASE_URL:-https://sniperbo.com}"
LOCAL_URL="${SNIPER_LOCAL_DASHBOARD_URL:-http://127.0.0.1:8787/dashboard}"

if [[ -z "$PASSWORD" ]]; then
  echo "SNIPER_ADMIN_PASSWORD vazio em $LOCAL_ENV" >&2
  exit 1
fi

echo "Validando login admin em $REMOTE ..."
HTTP_CODE="$(
  curl -s -o /tmp/sniper_admin_login.json -w "%{http_code}" -X POST "$REMOTE/admin/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"
)"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "Login falhou (HTTP $HTTP_CODE). Verifique e-mail e senha." >&2
  head -c 200 /tmp/sniper_admin_login.json 2>/dev/null || true
  echo ""
  exit 1
fi

cat > "$LOCAL_ENV" <<EOF
SNIPER_ADMIN_EMAIL=$EMAIL
SNIPER_ADMIN_PASSWORD=$PASSWORD
SNIPER_PUBLISH_PASSWORD_ONLY=1
SNIPER_LOCAL_DASHBOARD_URL=$LOCAL_URL
SIGNALS_API_PORT=8787
SIGNALS_API_HOST=127.0.0.1
PUBLISHER_INTERVAL=1.5
FRONTEND_PORT=5175
EOF
chmod 600 "$LOCAL_ENV"
echo "Credenciais OK em $LOCAL_ENV (modo sem token — só e-mail e senha)."
