@echo off
chcp 65001 >nul
title SNIPERBO - Verificacao
cd /d "%~dp0"

echo.
echo ============================================
echo   SNIPERBO - O que existe nesta pasta?
echo ============================================
echo.
echo Pasta atual:
echo   %CD%
echo.
echo --------------------------------------------

if exist "%~dp0LIGAR_SINAIS.bat" (
  echo [OK] LIGAR_SINAIS.bat
) else (
  echo [FALTA] LIGAR_SINAIS.bat
)

if exist "%~dp0scripts\official_dashboard_publisher.py" (
  echo [OK] scripts\official_dashboard_publisher.py
) else (
  echo [FALTA] scripts\official_dashboard_publisher.py
)

if exist "%~dp0scripts\configurar_publisher_credenciais.ps1" (
  echo [OK] scripts\configurar_publisher_credenciais.ps1
) else (
  echo [FALTA] scripts\configurar_publisher_credenciais.ps1
)

if exist "%~dp0scripts\ligar_sinais.ps1" (
  echo [OK] scripts\ligar_sinais.ps1
) else (
  echo [FALTA] scripts\ligar_sinais.ps1
)

if exist "%~dp0sniper_bo_scraper.py" (
  echo [OK] sniper_bo_scraper.py  ^(COLETOR DA MESA^)
) else (
  echo [FALTA] sniper_bo_scraper.py  ^(COLETOR DA MESA - OBRIGATORIO^)
)

if exist "%~dp0config.json" (
  echo [OK] config.json
) else (
  echo [FALTA] config.json  ^(config do coletor^)
)

echo --------------------------------------------
echo.
echo Programas no PC:

where python >nul 2>&1
if errorlevel 1 (echo [FALTA] Python - instale de python.org) else (echo [OK] Python)

where node >nul 2>&1
if errorlevel 1 (echo [FALTA] Node.js - instale de nodejs.org) else (echo [OK] Node.js)

where git >nul 2>&1
if errorlevel 1 (echo [FALTA] Git - instale de git-scm.com) else (echo [OK] Git)

echo.
echo --------------------------------------------
echo.
echo SE MUITA COISA ESTA [FALTA]:
echo   Voce pode estar na pasta ERRADA.
echo   O projeto deve ser a pasta que tem a subpasta "scripts".
echo.
echo SE sniper_bo_scraper.py esta [FALTA]:
echo   O site NAO liga sem esse arquivo.
echo   Procure no PC por "sniper_bo_scraper.py" e copie para:
echo   %CD%
echo.
echo SE LIGAR_SINAIS.bat esta [FALTA]:
echo   Atualize o projeto com Git, ou baixe de novo do GitHub.
echo.
pause
