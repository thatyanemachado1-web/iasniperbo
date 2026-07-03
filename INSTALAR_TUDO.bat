@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title SNIPERBO - Instalador automatico
set "DEST=C:\SNIPERBO"
set "ZIP=%TEMP%\sniperbo-main.zip"
set "EXTRACT=%TEMP%\sniperbo-extract"

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

echo [1/6] Baixando projeto do GitHub...
powershell -NoProfile -Command ^
  "$ProgressPreference='SilentlyContinue';" ^
  "Invoke-WebRequest -Uri 'https://github.com/thatyanemachado1-web/iasniperbo/archive/refs/heads/main.zip' -OutFile '%ZIP%' -UseBasicParsing"
if errorlevel 1 (
  echo ERRO ao baixar. Verifique sua internet.
  pause
  exit /b 1
)

echo [2/6] Extraindo arquivos...
if exist "%EXTRACT%" rmdir /s /q "%EXTRACT%" 2>nul
powershell -NoProfile -Command "Expand-Archive -Path '%ZIP%' -DestinationPath '%EXTRACT%' -Force"
if not exist "%EXTRACT%\iasniperbo-main" (
  echo ERRO ao extrair ZIP.
  pause
  exit /b 1
)

echo [3/6] Copiando para %DEST%...
xcopy "%EXTRACT%\iasniperbo-main\*" "%DEST%\" /E /Y /I /Q >nul

echo [4/6] Procurando coletor da mesa (sniper_bo_scraper.py)...
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
  for %%D in ("%SCRAPER%\..") do set "SCRAPER_DIR=%%~fD"
  if exist "!SCRAPER_DIR!\config.json" copy /Y "!SCRAPER_DIR!\config.json" "%DEST%\config.json" >nul 2>nul
) else (
  echo.
  echo   *** ATENCAO ***
  echo   sniper_bo_scraper.py NAO encontrado no PC.
  echo   Sem ele os sinais REAIS da mesa nao funcionam.
  echo   Pecaa quem instalou antes para enviar esse arquivo.
  echo.
)

echo [5/6] Instalando Python requests...
where python >nul 2>&1
if not errorlevel 1 (
  python -m pip install -q requests truststore 2>nul
)

echo [6/6] Configurando credenciais e ligando...
if exist "%DEST%\scripts\configurar_publisher_credenciais.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%DEST%\scripts\configurar_publisher_credenciais.ps1" -AdminEmail "gabrielmendespromove@gmail.com" -AdminPassword "AdminSniper2026!"
)
if exist "%DEST%\scripts\ligar_sinais.ps1" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%DEST%\scripts\ligar_sinais.ps1"
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
