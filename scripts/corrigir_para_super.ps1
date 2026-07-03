param(
  [switch]$SkipOpenMesa,
  [switch]$SkipKill
)

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$Scraper = Join-Path $ProjectRoot "sniper_bo_scraper.py"
$Config = Join-Path $ProjectRoot "config.json"
$SuperUrl = "https://77super.com/en/game/101803005-Bac%20Bo"
$SuperLogin = "https://77super.com/"
$DataDir = Join-Path $ProjectRoot "data"

Write-Host ""
Write-Host "=== SNIPERBO - Corrigir para Casa Super ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path -LiteralPath $Scraper)) {
  Write-Host "[ERRO] Falta $Scraper" -ForegroundColor Red
  exit 1
}

New-Item -ItemType Directory -Path $DataDir -Force | Out-Null

$pyPatch = @'
import json, re, sys
from pathlib import Path

root = Path(sys.argv[1])
scraper = root / "sniper_bo_scraper.py"
config_path = root / "config.json"
super_url = sys.argv[2]
super_login = sys.argv[3]
data_dir = root / "data"
data_dir.mkdir(parents=True, exist_ok=True)
default_db = str(data_dir / "bacbo.sqlite")

def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8-sig", errors="ignore"))
    except Exception:
        return {}

def find_base_config() -> dict:
    candidates = [
        config_path.with_suffix(".json.bak"),
        root / "config.json.bak",
        root / "Codex" / "2026-05-24" / "voc-um-desenvolvedor-python-s-nior" / "config.json",
        config_path,
    ]
    best = {}
    for candidate in candidates:
        if not candidate.exists():
            continue
        data = load_json(candidate)
        if len(data) > len(best):
            best = data
    return best

def is_score_url(url: str) -> bool:
    u = str(url or "").lower()
    if not u.startswith("http"):
        return False
    if "77super" in u:
        return False
    score_markers = ("score.bet", "scorebet", "cassinoscore", "casino-score", "casinoscore", "jogoscore")
    if any(m in u for m in score_markers):
        return True
    if "score" in u and any(x in u for x in ("cassino", "casino", "bet", "game", "play")):
        return True
    return False

def patch_url_value(key: str, value):
    if not isinstance(value, str):
        return value
    if not value.startswith("http"):
        return value
    if is_score_url(value):
        return super_login if "login" in key.lower() else super_url
    return value

config = find_base_config()
if not config:
    config = {}

url_keys = [
    "source_url", "url", "game_url", "target_url", "mesa_url", "login_url",
    "base_url", "site_url", "table_url", "start_url",
]
for key in url_keys:
    if key in config:
        config[key] = patch_url_value(key, config[key])

config["source_url"] = super_url
config["url"] = super_url
config["casa"] = "super"
config.setdefault("headless", False)
config.setdefault("enabled", True)
config.setdefault("host", "127.0.0.1")
config.setdefault("port", 8791)
config.setdefault("evolution", True)
config.setdefault("manual_login_only", False)
config.setdefault("session_reuse", True)
config.setdefault("max_login_attempts", 5)
config.setdefault("send_tie_alert", False)
config.setdefault("telegram", {"enabled": False})

db_path = str(config.get("database_path") or config.get("db_path") or default_db)
if not db_path.strip():
    db_path = default_db
db_file = Path(db_path)
if not db_file.is_absolute():
    db_file = root / db_file
db_file.parent.mkdir(parents=True, exist_ok=True)
config["database_path"] = str(db_file)

config_path.write_text(json.dumps(config, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

text = scraper.read_text(encoding="utf-8", errors="ignore")
original = text

def patch_urls_in_text(s: str) -> str:
    def repl(m):
        url = m.group(0)
        return super_url if is_score_url(url) else url
    return re.sub(r"https?://[^\s\"'<>]+", repl, s)

text = patch_urls_in_text(text)
if text != original:
    backup = scraper.with_suffix(".py.bak")
    if not backup.exists():
        backup.write_text(original, encoding="utf-8")
    scraper.write_text(text, encoding="utf-8")
    print("SCRAPER_PATCHED")
else:
    print("SCRAPER_OK")

print("DATABASE_PATH=" + config["database_path"])
print("SOURCE_URL=" + config.get("source_url", super_url))
print("CONFIG_KEYS=" + str(len(config)))
print("CONFIG_WRITTEN=" + str(config_path))
'@

$patchFile = Join-Path $env:TEMP "sniperbo_patch_super.py"
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($patchFile, $pyPatch, $utf8)

$python = "python.exe"
$candidates = @(
  (Join-Path $ProjectRoot "Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior\.venv\Scripts\python.exe"),
  (Join-Path $ProjectRoot ".venv\Scripts\python.exe")
)
foreach ($c in $candidates) { if (Test-Path -LiteralPath $c) { $python = $c; break } }

Write-Host "[1/4] Restaurando config completo + source_url Super..." -ForegroundColor Yellow
& $python $patchFile $ProjectRoot $SuperUrl $SuperLogin 2>&1 | ForEach-Object { Write-Host "  $_" }

$SuperEnv = Join-Path $ScriptDir "super_casino.local.env"
$loginScript = Join-Path $ScriptDir "aplicar_login_super.py"
if ((Test-Path -LiteralPath $SuperEnv) -and (Test-Path -LiteralPath $loginScript)) {
  Write-Host "[2/4] Aplicando login automatico Super..." -ForegroundColor Yellow
  & $python $loginScript $ProjectRoot 2>&1 | ForEach-Object { Write-Host "  $_" }
} else {
  Write-Host "[2/4] Login automatico: rode LOGIN_SUPER.bat (credenciais 77super.com)" -ForegroundColor Yellow
}

if (-not $SkipKill) {
  Write-Host "[3/4] Parando coletores antigos..." -ForegroundColor Yellow
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*sniper_bo_scraper.py*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 2
} else {
  Write-Host "[3/4] Pulando parada de coletores (-SkipKill)" -ForegroundColor Gray
}

if (-not $SkipOpenMesa) {
  Write-Host "[4/4] Abrindo mesa Super..." -ForegroundColor Yellow
  & (Join-Path $ScriptDir "abrir_mesa.ps1")
  Write-Host ""
  Write-Host "Pronto. Chrome deve abrir em 77super.com" -ForegroundColor Green
} else {
  Write-Host "[4/4] Config Super aplicado (-SkipOpenMesa)" -ForegroundColor Green
}

Write-Host ""
