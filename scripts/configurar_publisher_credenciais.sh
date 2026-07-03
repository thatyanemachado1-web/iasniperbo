#!/usr/bin/env bash
# Atualiza official_publisher.local.env com token JWT fresco via login admin.
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

echo "Login admin em $REMOTE ..."
TOKEN="$(
  curl -fsS -X POST "$REMOTE/admin/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))"
)"

if [[ -z "$TOKEN" ]]; then
  echo "Login falhou — verifique e-mail e senha." >&2
  exit 1
fi

cat > "$LOCAL_ENV" <<EOF
SNIPER_ADMIN_EMAIL=$EMAIL
SNIPER_ADMIN_PASSWORD=$PASSWORD
SNIPER_ADMIN_TOKEN=$TOKEN
SNIPER_LOCAL_DASHBOARD_TOKEN=$TOKEN
SNIPER_PUBLISHER_TOKEN=
SNIPER_REMOTE_DASHBOARD_TOKEN=
PUBLISHER_INTERVAL=1.5
FRONTEND_PORT=5175
SIGNALS_API_PORT=8787
SIGNALS_API_HOST=127.0.0.1
SNIPER_LOCAL_DASHBOARD_URL=$LOCAL_URL
EOF
chmod 600 "$LOCAL_ENV"
echo "Credenciais salvas em $LOCAL_ENV (token JWT novo)."
