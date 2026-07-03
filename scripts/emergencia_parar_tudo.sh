#!/usr/bin/env bash
# EMERGENCIA — para publisher e alivia o site se caiu.
set -euo pipefail
pkill -f official_dashboard_publisher.py 2>/dev/null || true
pkill -f "wrangler dev" 2>/dev/null || true
echo ""
echo "Publisher e wrangler local PARADOS."
echo "Aguarde 1 minuto e abra: https://www.sniperbo.com/app"
echo ""
echo "Para ligar sinais de novo (devagar, 10s):"
echo "curl -fsSL https://raw.githubusercontent.com/thatyanemachado1-web/iasniperbo/main/scripts/soltar_sinais_agora.sh | bash"
echo ""
