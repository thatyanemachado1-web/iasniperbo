"""Repara sniper_bo_scraper.py quebrado pelo patch antigo de DEFAULT_SELECTORS."""
from __future__ import annotations

import ast
import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sniperbo_paths import project_root

OUR_PATCH_MARKERS = (
    '"Log in"',
    '"Sign in"',
    '"Bac Bo"',
    '"login_automatico"',
)


def is_valid(source: str) -> bool:
    try:
        ast.parse(source)
        return True
    except SyntaxError:
        return False


def remove_our_default_selectors_block(source: str) -> str:
    pattern = r"DEFAULT_SELECTORS\s*=\s*\[\s*\n\s*\"Login\",[\s\S]*?\"Live\",?\s*\n\s*\]"
    return re.sub(pattern, "", source, count=1)


def fix_orphan_selector_lines(source: str) -> str:
    lines = source.splitlines()
    fixed: list[str] = []
    for line in lines:
        stripped = line.strip()
        if re.match(r"^\]\s*tbody\s+tr['\"],?\s*$", stripped):
            fixed.append('    "table tbody tr",')
            continue
        if re.match(r"^tbody\s+tr['\"],?\s*$", stripped):
            fixed.append('    "table tbody tr",')
            continue
        if stripped.startswith("] ") and ("tr" in stripped or "tbody" in stripped):
            cleaned = stripped.lstrip("] ").strip().rstrip(",").strip("'\"")
            fixed.append(f'    "{cleaned}",')
            continue
        fixed.append(line)
    return "\n".join(fixed) + ("\n" if source.endswith("\n") else "")


def repair(source: str) -> str:
    updated = source
    if any(marker in updated for marker in OUR_PATCH_MARKERS):
        updated = remove_our_default_selectors_block(updated)
    updated = fix_orphan_selector_lines(updated)
    return updated


def main() -> int:
    root = project_root(sys.argv[1] if len(sys.argv) > 1 else None)
    target = root / "sniper_bo_scraper.py"
    if not target.is_file():
        print("ERRO: falta C:\\SNIPERBO\\sniper_bo_scraper.py")
        return 1

    source = target.read_text(encoding="utf-8", errors="ignore")
    if is_valid(source):
        print(f"ok: {target}")
        return 0

    shutil.copy2(target, target.with_suffix(target.suffix + ".quebrado"))
    fixed = repair(source)
    if not is_valid(fixed):
        print("ERRO: nao consegui reparar automaticamente.")
        print("Procure no PC outra copia de sniper_bo_scraper.py e copie para C:\\SNIPERBO\\")
        print(f"Backup do quebrado: {target.with_suffix(target.suffix + '.quebrado')}")
        return 1

    shutil.copy2(target, target.with_suffix(target.suffix + ".bak"))
    target.write_text(fixed, encoding="utf-8")
    print(f"REPARADO: {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
