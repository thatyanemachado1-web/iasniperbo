@echo off
chcp 65001 >nul
cd /d "%~dp0"
(
echo COLLECTOR_LOGIN_EMAIL=gabrielmendespromove@gmail.com
echo COLLECTOR_LOGIN_PASSWORD=221600Pmcg11
) > collector_login.local.env

start "SNIPERBO Publisher" cmd /k "cd /d %~dp0 && powershell -NoProfile -ExecutionPolicy Bypass -File scripts\iniciar_publisher_windows.ps1"
call "%~dp0LIGAR_COLETOR_AGORA.bat"
