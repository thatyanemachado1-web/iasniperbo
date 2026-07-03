import json
import re
import sys
from pathlib import Path


SELECTOR_TEXTS = [
    "Login",
    "Log in",
    "Sign in",
    "Entrar",
    "Enter",
    "Submit",
    "Continue",
    "Email",
    "E-mail",
    "Password",
    "Senha",
    "Confirm",
    "Play",
    "Jogar",
    "Bac Bo",
    "Live",
]


def patch_config(root: Path) -> None:
    config_path = root / "config.json"
    config: dict = {}
    if config_path.exists():
        config = json.loads(config_path.read_text(encoding="utf-8-sig") or "{}")
    config["login_url"] = "https://77super.com/en/login"
    config["game_url"] = "https://77super.com/en/game/101803005-Bac%20Bo"
    config["url"] = config["game_url"]
    config["start_url"] = config["game_url"]
    config["open_login_first"] = False
    config["default_selectors"] = SELECTOR_TEXTS
    config["DEFAULT_SELECTORS"] = SELECTOR_TEXTS
    config_path.write_text(json.dumps(config, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"config.json atualizado: {config_path}")


def patch_scraper(scraper_path: Path) -> bool:
    if not scraper_path.exists():
        return False
    source = scraper_path.read_text(encoding="utf-8", errors="ignore")
    if "DEFAULT_SELECTORS" not in source:
        return False

    block = ",\n    ".join(f'"{item}"' for item in SELECTOR_TEXTS)
    replacement = f"DEFAULT_SELECTORS = [\n    {block},\n]"
    updated, count = re.subn(
        r"DEFAULT_SELECTORS\s*=\s*\[[^\]]*\]",
        replacement,
        source,
        count=1,
        flags=re.DOTALL,
    )
    if count:
        scraper_path.write_text(updated, encoding="utf-8")
        print(f"sniper_bo_scraper.py atualizado: {scraper_path}")
        return True

    # Evita encerrar quando nao acha botao na primeira tentativa.
    relaxed = source
    relaxed = relaxed.replace(
        "ciclo finalizado. candidatos=0",
        "ciclo finalizado. candidatos=0 - aguardando proximo ciclo",
    )
    if relaxed != source:
        scraper_path.write_text(relaxed, encoding="utf-8")
        print(f"sniper_bo_scraper.py relaxado: {scraper_path}")
        return True
    return False


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else r"C:\SNIPERBO").resolve()
    codex = Path(
        r"C:\Users\Usuario\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior"
    )
    if not codex.exists():
        codex = Path.home() / "OneDrive" / "Documentos" / "Codex" / "2026-05-24" / "voc-um-desenvolvedor-python-s-nior"

    patch_config(root)
    for scraper in (root / "sniper_bo_scraper.py", codex / "sniper_bo_scraper.py"):
        patch_scraper(scraper)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
