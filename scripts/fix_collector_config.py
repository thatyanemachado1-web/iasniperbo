import json
import os
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sniperbo_paths import project_root


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
    game_url = "https://77super.com/en/game/101803005-Bac%20Bo"
    flat_keys = {
        "email": email,
        "password": password,
        "login_email": email,
        "login_password": password,
        "site_url": "https://77super.com",
        "login_url": "https://77super.com/en/login",
        "game_url": game_url,
        "url": game_url,
        "start_url": game_url,
        "auto_login": True,
    }
    for key, value in flat_keys.items():
        config[key] = value


def main() -> int:
    root = project_root(sys.argv[1] if len(sys.argv) > 1 else None)
    data_dir = root / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    db_path = str((data_dir / "bacbo.db").resolve())

    login_env = read_env_file(root / "collector_login.local.env")
    email = login_env.get("COLLECTOR_LOGIN_EMAIL") or os.getenv("COLLECTOR_LOGIN_EMAIL", "")
    password = login_env.get("COLLECTOR_LOGIN_PASSWORD") or os.getenv("COLLECTOR_LOGIN_PASSWORD", "")

    config_path = root / "config.json"
    config: dict = {}
    if config_path.exists():
        raw = config_path.read_text(encoding="utf-8-sig")
        config = json.loads(raw) if raw.strip() else {}

    config["database_path"] = db_path
    apply_login(config, email, password)
    config_path.write_text(json.dumps(config, indent=2, ensure_ascii=False), encoding="utf-8")

    if email and password:
        env_text = (
            f"EMAIL={email}\nPASSWORD={password}\n"
            f"SNIPER_LOGIN_EMAIL={email}\nSNIPER_LOGIN_PASSWORD={password}\n"
        )
        (root / ".env").write_text(env_text, encoding="utf-8")

    sqlite3.connect(db_path).close()
    print(f"database_path={db_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
