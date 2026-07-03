"""Restaura sniper_bo_scraper.py se algum patch quebrou o arquivo."""
from __future__ import annotations

import py_compile
import shutil
import sys
import tempfile
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
    if not path.exists():
        return False
    try:
        with tempfile.NamedTemporaryFile(suffix=".pyc", delete=True) as tmp:
            py_compile.compile(str(path), cfile=tmp.name, doraise=True)
        return True
    except py_compile.PyCompileError:
        return False


def backup(path: Path) -> None:
    if path.exists():
        shutil.copy2(path, path.with_suffix(path.suffix + ".bak"))


def restore_to(target: Path, source: Path) -> None:
    backup(target)
    shutil.copy2(source, target)
    print(f"restaurado: {source} -> {target}")


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else r"C:\SNIPERBO").resolve()
    codex = codex_dir()
    targets = [p for p in (root / "sniper_bo_scraper.py", codex / "sniper_bo_scraper.py") if p.parent.exists()]

    candidates: list[Path] = []
    for base in (root, codex):
        for name in (
            "sniper_bo_scraper.py.bak",
            "sniper_bo_scraper.py.orig",
            "sniper_bo_scraper.py.original",
            "sniper_bo_scraper.py",
        ):
            candidates.append(base / name)

    good = next((p for p in candidates if is_valid_python(p)), None)
    if not good:
        print("ERRO: nenhuma copia valida de sniper_bo_scraper.py encontrada.")
        print("Restaure pelo OneDrive: botao direito no arquivo > Historico de versoes.")
        return 1

    print(f"copia valida: {good}")
    for target in targets:
        if target.resolve() == good.resolve():
            continue
        restore_to(target, good)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
