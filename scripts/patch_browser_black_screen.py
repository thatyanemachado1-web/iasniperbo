"""Remove flags que deixam o Bac Bo com tela preta no Edge/Playwright."""
from __future__ import annotations

import re
import sys
from pathlib import Path

BAD_FLAGS = (
    "--no-sandbox",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--disable-dev-shm-usage",
    "--headless",
    "--headless=new",
)

GOOD_FLAGS = (
    "--start-maximized",
    "--disable-blink-features=AutomationControlled",
)


def patch_source(source: str) -> tuple[str, bool]:
    updated = source
    changed = False

    for flag in BAD_FLAGS:
        patterns = [
            rf'["\']{re.escape(flag)}["\'],?\s*',
            rf'{re.escape(flag)},?\s*',
        ]
        for pattern in patterns:
            new = re.sub(pattern, "", updated)
            if new != updated:
                updated = new
                changed = True

    if "disable-blink-features=AutomationControlled" not in updated:
        if "chromium.launch" in updated or "launch_persistent_context" in updated:
            updated = updated.replace(
                'args=["--start-maximized"]',
                'args=["--start-maximized", "--disable-blink-features=AutomationControlled"]',
            )
            changed = True

    return updated, changed


def patch_file(path: Path) -> bool:
    if not path.exists():
        return False
    source = path.read_text(encoding="utf-8", errors="ignore")
    updated, changed = patch_source(source)
    if not changed:
        return False
    path.write_text(updated, encoding="utf-8")
    print(f"browser flags corrigidos: {path}")
    return True


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else r"C:\SNIPERBO").resolve()
    codex = Path(
        r"C:\Users\Usuario\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior"
    )
    if not codex.exists():
        codex = (
            Path.home()
            / "OneDrive"
            / "Documentos"
            / "Codex"
            / "2026-05-24"
            / "voc-um-desenvolvedor-python-s-nior"
        )

    touched = False
    for target in (root / "sniper_bo_scraper.py", codex / "sniper_bo_scraper.py"):
        if patch_file(target):
            touched = True

    if touched:
        print("Flags --no-sandbox / --disable-gpu removidos.")
    else:
        print("Nenhum flag ruim encontrado no scraper (ok).")
    print("Flags recomendados:", ", ".join(GOOD_FLAGS))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
