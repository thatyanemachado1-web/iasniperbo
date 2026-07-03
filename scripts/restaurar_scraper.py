"""Restaura sniper_bo_scraper.py — validacao com ast (sem py_compile no Windows)."""
from __future__ import annotations

import ast
import shutil
import sys
from pathlib import Path


def codex_dir() -> Path:
    codex = Path(
        r"C:\Users\Usuario\OneDrive\Documentos\Codex\2026-05-24\voc-um-desenvolvedor-python-s-nior"
    )
    if codex.exists():
        return codex
    return (
        Path.home()
        / "OneDrive"
        / "Documentos"
        / "Codex"
        / "2026-05-24"
        / "voc-um-desenvolvedor-python-s-nior"
    )


def is_valid_python(path: Path) -> bool:
    if not path.is_file():
        return False
    try:
        ast.parse(path.read_text(encoding="utf-8", errors="ignore"))
        return True
    except SyntaxError:
        return False


def backup(path: Path) -> None:
    if path.is_file():
        shutil.copy2(path, path.with_suffix(path.suffix + ".bak"))


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else r"C:\SNIPERBO").resolve()
    codex = codex_dir()

    targets = []
    for path in (root / "sniper_bo_scraper.py", codex / "sniper_bo_scraper.py"):
        if path.parent.exists():
            targets.append(path)

    candidates: list[Path] = []
    seen: set[str] = set()
    for base in (root, codex):
        if not base.exists():
            continue
        for name in (
            "sniper_bo_scraper.py.bak",
            "sniper_bo_scraper.py.orig",
            "sniper_bo_scraper.py.original",
            "sniper_bo_scraper.py",
        ):
            path = base / name
            key = str(path.resolve()).lower()
            if key in seen:
                continue
            seen.add(key)
            candidates.append(path)

    good = next((p for p in candidates if is_valid_python(p)), None)
    if not good:
        print("ERRO: nenhuma copia valida de sniper_bo_scraper.py")
        print("OneDrive > botao direito no arquivo > Historico de versoes > restaurar versao de ontem")
        return 1

    print(f"OK copia valida: {good}")
    for target in targets:
        if target.resolve() == good.resolve():
            print(f"ja ok: {target}")
            continue
        backup(target)
        shutil.copy2(good, target)
        print(f"restaurado: {target}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
