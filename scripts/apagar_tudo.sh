#!/usr/bin/env bash
# APAGA processos, logs e configs locais da VPS (nao mexe no site Cloudflare).
set -euo pipefail

ROOT="${SNIPER_INSTALL_DIR:-/opt/iasniperbo}"

echo ""
echo "=== SNIPERBO — APAGAR FLUXO LOCAL (VPS) ==="
echo ""

pkill -f official_dashboard_publisher.py 2>/dev/null || true
pkill -f vps_mesa_pulse.py 2>/dev/null || true
pkill -f "wrangler dev" 2>/dev/null || true
sleep 2

if [[ -d "$ROOT" ]]; then
  cd "$ROOT"
  rm -f official_dashboard_publisher.log \
    legacy_collector_bridge.log \
    official_legacy_collector.log \
    logs/official-publisher.pid \
    logs/vps-mesa-pulse.pid \
    logs/signals-api.pid \
    /tmp/sniper_*.json \
    /tmp/sniperbo_publisher_*.lock 2>/dev/null || true
  rm -rf logs/*.log 2>/dev/null || true
  echo "  logs e locks locais apagados"
else
  echo "  pasta $ROOT nao existe (ok)"
fi

echo ""
echo "  Processos parados. Site Cloudflare intacto."
echo "  Proximo passo:"
echo "  curl -fsSL https://raw.githubusercontent.com/thatyanemachado1-web/iasniperbo/main/scripts/iniciar_do_zero.sh | bash"
echo ""
