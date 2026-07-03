$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$Scraper = Join-Path $ProjectRoot "sniper_bo_scraper.py"
$Config = Join-Path $ProjectRoot "config.json"
$SuperUrl = "https://77super.com/en/game/101803005-Bac%20Bo"
$SuperLogin = "https://77super.com/"

Write-Host ""
Write-Host "=== SNIPERBO - Corrigir para Casa Super ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path -LiteralPath $Scraper)) {
  Write-Host "[ERRO] Falta $Scraper" -ForegroundColor Red
  exit 1
}

# 1) Sempre recriar config.json da Super (ignora Score)
& (Join-Path $ScriptDir "gerar_config_super.ps1")

# 2) Patch no scraper: trocar URLs de Score -> 77super
$pyPatch = @'
import json, re, sys
from pathlib import Path

root = Path(sys.argv[1])
scraper = root / "sniper_bo_scraper.py"
config_path = root / "config.json"
super_url = sys.argv[2]
super_login = sys.argv[3]

text = scraper.read_text(encoding="utf-8", errors="ignore")
original = text

score_domains = (
    "score.bet", "scorebet", "cassinoscore", "casino-score", "casinoscore",
    "jogoscore", "score.com", "cassinscore", "cassino-score", "score777",
)
score_path_hints = ("/score/", "cassino score", "casino score")

def is_score_url(url: str) -> bool:
    u = url.lower()
    if "77super" in u:
        return False
    if any(d in u for d in score_domains):
        return True
    if "score" in u and "bankerscore" not in u and "playerscore" not in u:
        if any(h in u for h in ("cassino", "casino", "bet", "game", "play")):
            return True
    return False

def patch_urls(s: str) -> str:
    def repl(m):
        url = m.group(0)
        return super_url if is_score_url(url) else url
    return re.sub(r"https?://[^\s\"'<>]+", repl, s)

text = patch_urls(text)

# Descobrir chaves usadas no scraper
keys = set(re.findall(r"""config(?:\.get|\[)\s*['"]([^'"]+)['"]""", text, re.I))
keys |= set(re.findall(r"""cfg(?:\.get|\[)\s*['"]([^'"]+)['"]""", text, re.I))
keys |= set(re.findall(r"""settings(?:\.get|\[)\s*['"]([^'"]+)['"]""", text, re.I))

# Montar config completo
base = {
    "casa": "super",
    "url": super_url,
    "game_url": super_url,
    "target_url": super_url,
    "mesa_url": super_url,
    "login_url": super_login,
    "browser_profile_dir": "browser_profile_77super",
    "profile_directory": "browser_profile_77super",
    "user_data_dir": "browser_profile_77super",
    "headless": False,
    "no_telegram": True,
}
url_keys = {k for k in keys if any(x in k.lower() for x in ("url", "link", "site", "mesa", "game", "target", "login"))}
for k in url_keys:
    if "login" in k.lower():
        base[k] = super_login
    else:
        base[k] = super_url
for k in keys:
    base.setdefault(k, super_url if "url" in k.lower() else base.get(k, ""))

config_path.write_text(json.dumps(base, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

changed = text != original
if changed:
    backup = scraper.with_suffix(".py.bak")
    if not backup.exists():
        backup.write_text(original, encoding="utf-8")
    scraper.write_text(text, encoding="utf-8")
    print("SCRAPER_PATCHED")
else:
    print("SCRAPER_OK")

print("CONFIG_KEYS=" + ",".join(sorted(keys)) if keys else "CONFIG_KEYS=default")
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

Write-Host "[2/3] Corrigindo scraper e config..." -ForegroundColor Yellow
& $python $patchFile $ProjectRoot $SuperUrl $SuperLogin 2>&1 | ForEach-Object { Write-Host "  $_" }

Write-Host "[3/3] Reiniciando coletor na Super..." -ForegroundColor Yellow
Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*sniper_bo_scraper.py*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2
& (Join-Path $ScriptDir "abrir_mesa.ps1")

Write-Host ""
Write-Host "Pronto. Chrome deve abrir em 77super.com (NAO Score)." -ForegroundColor Green
Write-Host ""
