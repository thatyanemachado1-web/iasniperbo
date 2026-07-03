#!/usr/bin/env bash
# Para o publisher na VPS (use se o site ficar lento ou cair).
set -euo pipefail
pkill -f official_dashboard_publisher.py 2>/dev/null || true
echo "Publisher parado."
echo "Site: https://www.sniperbo.com/app"
echo "Para ligar de novo: curl -fsSL https://raw.githubusercontent.com/thatyanemachado1-web/iasniperbo/main/scripts/soltar_sinais_agora.sh | bash"
