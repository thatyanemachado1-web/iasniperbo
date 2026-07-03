#!/usr/bin/env bash
# Para sobrecarga na VPS e alivia o site IMEDIATAMENTE.
pkill -f vps_mesa_pulse.py 2>/dev/null || true
pkill -f official_dashboard_publisher.py 2>/dev/null || true
echo "VPS publisher/pulse PARADOS — site aliviado."
echo "Abra: https://www.sniperbo.com/app"
echo "Para religar devagar: bash /opt/iasniperbo/scripts/ligar_tudo_agora.sh"
