@echo off
chcp 65001 >nul
title SNIPERBO - Instalador automatico
set "DEST=C:\SNIPERBO"
set "ZIP=%TEMP%\sniperbo-main.zip"
set "EXTRACT=%TEMP%\sniperbo-extract"
set "ADMIN_EMAIL=gabrielmendespromove@gmail.com"
set "ADMIN_PASS=AdminSniper2026!"

echo.
echo ================================================
echo   SNIPERBO - Instalando tudo automaticamente
echo ================================================
echo.

if not exist "%DEST%" mkdir "%DEST%"
cd /d "%DEST%"

where powershell >nul 2>&1
if errorlevel 1 (
  echo ERRO: PowerShell nao encontrado.
  pause
  exit /b 1
)

echo [1/8] Baixando projeto do GitHub...
powershell -NoProfile -Command ^
  "$ProgressPreference='SilentlyContinue';" ^
  "Invoke-WebRequest -Uri 'https://github.com/thatyanemachado1-web/iasniperbo/archive/refs/heads/main.zip' -OutFile '%ZIP%' -UseBasicParsing"
if errorlevel 1 (
  echo ERRO ao baixar. Verifique sua internet.
  pause
  exit /b 1
)

echo [2/8] Extraindo arquivos...
if exist "%EXTRACT%" rmdir /s /q "%EXTRACT%" 2>nul
powershell -NoProfile -Command "Expand-Archive -Path '%ZIP%' -DestinationPath '%EXTRACT%' -Force"
if not exist "%EXTRACT%\iasniperbo-main" (
  echo ERRO ao extrair ZIP.
  pause
  exit /b 1
)

echo [3/8] Copiando para %DEST%...
xcopy "%EXTRACT%\iasniperbo-main\*" "%DEST%\" /E /Y /I /Q >nul

echo [4/8] Procurando coletor da mesa (sniper_bo_scraper.py)...
set "SCRAPER="
for %%P in (
  "%DEST%\sniper_bo_scraper.py"
  "C:\Users\Usuario\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior\sniper_bo_scraper.py"
  "C:\Users\%USERNAME%\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior\sniper_bo_scraper.py"
  "C:\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior\sniper_bo_scraper.py"
) do (
  if exist %%P (
    set "SCRAPER=%%P"
    goto :found_scraper
  )
)
:found_scraper
if defined SCRAPER (
  if /I not "%SCRAPER%"=="%DEST%\sniper_bo_scraper.py" (
    copy /Y "%SCRAPER%" "%DEST%\sniper_bo_scraper.py" >nul
    echo   Copiado de: %SCRAPER%
  ) else (
    echo   Ja esta em %DEST%
  )
  if exist "%SCRAPER%\..\config.json" copy /Y "%SCRAPER%\..\config.json" "%DEST%\config.json" >nul 2>nul
) else (
  echo.
  echo   *** ATENCAO ***
  echo   sniper_bo_scraper.py NAO encontrado no PC.
  echo   Sem ele os sinais REAIS da mesa nao funcionam.
  echo   Pecaa quem instalou antes para enviar esse arquivo.
  echo.
)

echo [5/8] Instalando Python requests...
where python >nul 2>&1
if not errorlevel 1 (
  python -m pip install -q requests truststore 2>nul
) else (
  echo   AVISO: Python nao encontrado. Instale de python.org
)

echo [6/8] Instalando Node.js dependencias...
where node >nul 2>&1
if errorlevel 1 (
  echo   AVISO: Node.js nao encontrado. Instale de nodejs.org
) else (
  call npm install --silent
)

echo [7/8] Compilando Signals API (pode demorar 2-5 min)...
where node >nul 2>&1
if not errorlevel 1 (
  call npm run build
  if errorlevel 1 (
    echo   AVISO: build falhou. Rode "npm run build" manualmente depois.
  )
)

echo [8/8] Ligando sinais (credenciais via ligar_sinais.ps1)...
if exist "%DEST%\scripts\ligar_sinais.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$env:SNIPER_SETUP_EMAIL='%ADMIN_EMAIL%';" ^
    "$env:SNIPER_SETUP_PASS='%ADMIN_PASS%';" ^
    "& '%DEST%\scripts\configurar_publisher_credenciais.ps1' -AdminEmail $env:SNIPER_SETUP_EMAIL -AdminPassword $env:SNIPER_SETUP_PASS;" ^
    "& '%DEST%\scripts\ligar_sinais.ps1'"
) else (
)

echo.
echo ================================================
echo   Instalacao concluida!
echo   Pasta: %DEST%
echo   Site:  https://sniperbo.com/app
echo   Log:   %DEST%\official_dashboard_publisher.log
echo ================================================
echo.
if exist "%DEST%\VERIFICAR_SINAIS.bat" (
  echo Abrindo verificacao...
  call "%DEST%\VERIFICAR_SINAIS.bat"
) else (
  pause
)
