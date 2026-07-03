#!/usr/bin/env python3
"""Aplica login automatico da Casa Super no config.json do coletor."""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8-sig", errors="ignore").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8-sig", errors="ignore"))
    except Exception:
        return {}


def discover_login_keys(scraper_text: str) -> list[str]:
    keys = set(
        re.findall(r"""config(?:\.get|\[)\s*['"]([^'"]+)['"]""", scraper_text, re.I)
    )
    login_hints = (
        "user", "pass", "email", "login", "senha", "cpf", "phone", "telefone", "account"
    )
    found = [k for k in keys if any(h in k.lower() for h in login_hints)]
    return sorted(set(found))


def credential_values(env: dict[str, str]) -> dict[str, str]:
    email = (
        env.get("SUPER_LOGIN_EMAIL")
        or env.get("SUPER_EMAIL")
        or os.getenv("SUPER_LOGIN_EMAIL", "")
        or os.getenv("SUPER_EMAIL", "")
    ).strip()
    password = (
        env.get("SUPER_LOGIN_PASSWORD")
        or env.get("SUPER_PASSWORD")
        or os.getenv("SUPER_LOGIN_PASSWORD", "")
        or os.getenv("SUPER_PASSWORD", "")
    ).strip()
    username = (
        env.get("SUPER_LOGIN_USERNAME")
        or env.get("SUPER_USERNAME")
        or email
        or os.getenv("SUPER_LOGIN_USERNAME", "")
    ).strip()
    cpf = (env.get("SUPER_LOGIN_CPF") or os.getenv("SUPER_LOGIN_CPF", "")).strip()
    out: dict[str, str] = {}
    if email:
        out["email"] = email
        out["login_email"] = email
        out["username"] = username or email
        out["login_username"] = username or email
        out["user"] = username or email
    if password:
        out["password"] = password
        out["login_password"] = password
        out["senha"] = password
    if cpf:
        out["cpf"] = cpf
        out["login_cpf"] = cpf
    return out


def apply_credentials(config: dict, creds: dict[str, str], login_keys: list[str]) -> None:
    for key in login_keys:
        lower = key.lower()
        if any(x in lower for x in ("pass", "senha")):
            if creds.get("password"):
                config[key] = creds["password"]
        elif "cpf" in lower and creds.get("cpf"):
            config[key] = creds["cpf"]
        elif any(x in lower for x in ("user", "email", "login")):
            value = creds.get("email") or creds.get("username")
            if value:
                config[key] = value

    if creds.get("email") or creds.get("password"):
        login_obj = config.get("login") if isinstance(config.get("login"), dict) else {}
        if creds.get("email"):
            login_obj["email"] = creds["email"]
            login_obj["username"] = creds.get("username") or creds["email"]
        if creds.get("password"):
            login_obj["password"] = creds["password"]
        if creds.get("cpf"):
            login_obj["cpf"] = creds["cpf"]
        config["login"] = login_obj

    for flat_key, value in creds.items():
        if flat_key in {"email", "password", "username", "cpf", "senha"}:
            continue
        config.setdefault(flat_key, value)


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    scraper = root / "sniper_bo_scraper.py"
    config_path = root / "config.json"
    env_path = root / "scripts" / "super_casino.local.env"
    env_example = root / "scripts" / "super_casino.local.env.example"

    if not scraper.exists():
        print(f"ERRO: scraper ausente: {scraper}")
        return 1

    env = load_env(env_path)
    creds = credential_values(env)
    if not creds.get("password") or not (creds.get("email") or creds.get("username")):
        print("ERRO: preencha scripts/super_casino.local.env com SUPER_LOGIN_EMAIL e SUPER_LOGIN_PASSWORD")
        if env_example.exists():
            print(f"      Copie de: {env_example}")
        return 1

    scraper_text = scraper.read_text(encoding="utf-8", errors="ignore")
    login_keys = discover_login_keys(scraper_text)

    config = load_json(config_path)
    if not config:
        codex = root / "Codex" / "2026-05-24" / "voc-um-desenvolvedor-python-s-nior" / "config.json"
        if codex.exists():
            config = load_json(codex)

    apply_credentials(config, creds, login_keys)

    config["manual_login_only"] = False
    config["session_reuse"] = True
    config.setdefault("max_login_attempts", 5)
    config.setdefault("manual_login_timeout_seconds", 180)
    config.setdefault("dismiss_game_overlays", True)
    config.setdefault("use_system_browser_fallback", True)

    config_path.write_text(json.dumps(config, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("LOGIN_AUTO=ok")
    print(f"CONFIG={config_path}")
    print(f"LOGIN_KEYS={','.join(login_keys) if login_keys else 'login+flat'}")
    print("manual_login_only=false session_reuse=true")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
