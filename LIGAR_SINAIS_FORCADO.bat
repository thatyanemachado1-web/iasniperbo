@echo off
chcp 65001 >nul
title SNIPERBO - Forcar sinais no site
cd /d "%~dp0"
echo.
echo Ligando publicador continuo para sniperbo.com...
echo NAO feche esta janela se quiser sinais no site.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\configurar_publisher_credenciais.ps1" -AdminEmail "gabrielmendespromove@gmail.com" -AdminPassword "AdminSniper2026!" 2>nul
python "%~dp0scripts\force_site_live.py"
pause
