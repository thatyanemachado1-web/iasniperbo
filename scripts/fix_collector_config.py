import json
import os
import sqlite3
import sys
from pathlib import Path


def read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def apply_login(config: dict, email: str, password: str) -> None:
    if not email or not password:
        return

    flat_keys = {
        "email": email,
        "password": password,
        "login_email": email,
        "login_password": password,
        "login": email,
        "senha": password,
        "usuario": email,
        "user_email": email,
        "user_password": password,
        "api_email": email,
        "api_password": password,
        "site_email": email,
        "site_password": password,
        "casino_email": email,
        "casino_password": password,
        "username": email,
        "auto_login": True,
        "autoLogin": True,
        "login_automatico": True,
    }
    for key, value in flat_keys.items():
        config[key] = value

    for nested_key in ("credentials", "login", "auth", "site", "casino"):
        block = config.get(nested_key)
        if not isinstance(block, dict):
            block = {}
        block["email"] = email
        block["password"] = password
        block["login"] = email
        block["senha"] = password
        block["usuario"] = email
        config[nested_key] = block


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else r"C:\SNIPERBO").resolve()
    data_dir = root / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    db_path = str((data_dir / "bacbo.db").resolve())

    login_env = read_env_file(root / "collector_login.local.env")
    email = (
        login_env.get("COLLECTOR_LOGIN_EMAIL")
        or os.getenv("COLLECTOR_LOGIN_EMAIL")
        or ""
    )
    password = (
        login_env.get("COLLECTOR_LOGIN_PASSWORD")
        or os.getenv("COLLECTOR_LOGIN_PASSWORD")
        or ""
    )

    config_path = root / "config.json"
    config: dict = {}
    if config_path.exists():
        raw = config_path.read_text(encoding="utf-8-sig")
        config = json.loads(raw) if raw.strip() else {}

    config["database_path"] = db_path
    apply_login(config, email, password)
    config_path.write_text(json.dumps(config, indent=2, ensure_ascii=False), encoding="utf-8")

    sqlite3.connect(db_path).close()
    print(f"database_path={db_path}")
    if email:
        print(f"login_email={email}")
    else:
        print("login_email=NAO_CONFIGURADO")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
