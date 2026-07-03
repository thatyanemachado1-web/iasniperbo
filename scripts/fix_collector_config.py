import json
import sqlite3
import sys
from pathlib import Path


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else r"C:\SNIPERBO").resolve()
    data_dir = root / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    db_path = str((data_dir / "bacbo.db").resolve())

    config_path = root / "config.json"
    config: dict = {}
    if config_path.exists():
        raw = config_path.read_text(encoding="utf-8-sig")
        config = json.loads(raw) if raw.strip() else {}

    config["database_path"] = db_path
    config_path.write_text(json.dumps(config, indent=2, ensure_ascii=False), encoding="utf-8")

    sqlite3.connect(db_path).close()
    print(f"database_path={db_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
