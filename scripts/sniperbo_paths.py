"""Caminhos padrao — so C:\\SNIPERBO, sem OneDrive."""
from __future__ import annotations

from pathlib import Path

DEFAULT_ROOT = Path(r"C:\SNIPERBO")


def project_root(arg: str | None = None) -> Path:
    if arg:
        return Path(arg).resolve()
    return DEFAULT_ROOT.resolve()


def python_exe(root: Path) -> Path:
    local = root / ".venv" / "Scripts" / "python.exe"
    if local.exists():
        return local
    return Path("python")


def scraper_path(root: Path) -> Path:
    return root / "sniper_bo_scraper.py"


def browser_profile(root: Path) -> Path:
    profile = root / "browser_profile_77super"
    profile.mkdir(parents=True, exist_ok=True)
    return profile
