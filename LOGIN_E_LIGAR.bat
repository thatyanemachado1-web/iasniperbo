@echo off
chcp 65001 >nul
cd /d "%~dp0"
(
echo COLLECTOR_LOGIN_EMAIL=gabrielmendespromove@gmail.com
echo COLLECTOR_LOGIN_PASSWORD=221600Pmcg11
) > collector_login.local.env
call "%~dp0LIGAR_COLETOR_AGORA.bat"
