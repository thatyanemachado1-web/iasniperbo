"""Abre o 77super para login manual. A sessao fica salva no perfil Chrome."""
from __future__ import annotations

import sys
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("ERRO: playwright nao instalado. Rode: python -m playwright install chromium")
    raise SystemExit(1)


def resolve_paths() -> tuple[Path, Path]:
    root = Path(r"C:\SNIPERBO")
    if len(sys.argv) > 1:
        root = Path(sys.argv[1]).resolve()
    codex = Path(
        r"C:\Users\Usuario\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior"
    )
    if not codex.exists():
        codex = Path.home() / "OneDrive" / "Documentos" / "Codex" / "2026-05-24" / "voc-um-desenvolvedor-python-s-nior"
    workdir = codex if (codex / "sniper_bo_scraper.py").exists() else root
    profile = workdir / "browser_profile_77super"
    profile.mkdir(parents=True, exist_ok=True)
    return workdir, profile


def main() -> int:
    workdir, profile = resolve_paths()
    login_url = "https://77super.com/en/login"
    game_url = "https://77super.com/en/game/101803005-Bac%20Bo"

    print("")
    print("=== SNIPERBO - Login manual (1 vez) ===")
    print(f"Perfil: {profile}")
    print("")
    print("1) Edge vai abrir na pagina de login")
    print("2) Faca login com seu email e senha")
    print("3) Entre no jogo Bac Bo")
    print("4) Volte aqui e aperte ENTER")
    print("")

    edge_paths = [
        Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
    ]
    channel = "msedge" if any(p.exists() for p in edge_paths) else "chrome"

    with sync_playwright() as playwright:
        context = playwright.chromium.launch_persistent_context(
            user_data_dir=str(profile),
            headless=False,
            channel=channel,
            args=["--start-maximized"],
        )
        page = context.pages[0] if context.pages else context.new_page()
        try:
            page.goto(login_url, wait_until="domcontentloaded", timeout=60000)
        except Exception:
            page.goto("https://77super.com", wait_until="domcontentloaded", timeout=60000)

        input("Depois de logar e abrir o Bac Bo, aperte ENTER aqui... ")

        try:
            if "game" not in page.url.lower():
                page.goto(game_url, wait_until="domcontentloaded", timeout=60000)
                input("Se o Bac Bo abriu, aperte ENTER de novo para salvar... ")
        except Exception:
            pass

        context.close()

    print("")
    print("Login salvo! Agora rode FICAR_ABERTO.bat")
    print("")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
