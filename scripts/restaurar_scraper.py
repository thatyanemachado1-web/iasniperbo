"""Restaura sniper_bo_scraper.py dentro de C:\\SNIPERBO."""
from __future__ import annotations

import ast
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sniperbo_paths import project_root


def is_valid_python(path: Path) -> bool:
    if not path.is_file():
        return False
    try:
        ast.parse(path.read_text(encoding="utf-8", errors="ignore"))
        return True
    except SyntaxError:
        return False


def main() -> int:
    root = project_root(sys.argv[1] if len(sys.argv) > 1 else None)
    target = root / "sniper_bo_scraper.py"

    candidates = [
        root / "sniper_bo_scraper.py.bak",
        root / "sniper_bo_scraper.py.orig",
        root / "sniper_bo_scraper.py.original",
        root / "sniper_bo_scraper.py",
    ]

    good = next((p for p in candidates if is_valid_python(p)), None)
    if not good:
        print("ERRO: sniper_bo_scraper.py quebrado em C:\\SNIPERBO")
        print("Copie de novo o arquivo original para C:\\SNIPERBO\\sniper_bo_scraper.py")
        return 1

    if good.resolve() != target.resolve():
        if target.is_file():
            shutil.copy2(target, target.with_suffix(target.suffix + ".bak"))
        shutil.copy2(good, target)
        print(f"restaurado de: {good}")
    else:
        print(f"ok: {target}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
