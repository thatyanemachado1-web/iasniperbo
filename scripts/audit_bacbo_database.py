from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit a Bac Bo SQLite database read-only.")
    parser.add_argument("database", type=Path)
    args = parser.parse_args()

    uri = f"file:{args.database.resolve().as_posix()}?mode=ro"
    connection = sqlite3.connect(uri, uri=True)
    connection.row_factory = sqlite3.Row
    tables = [
        row[0]
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
        )
    ]
    report: list[dict[str, object]] = []
    for table in tables:
        columns = [
            row[1]
            for row in connection.execute(f"PRAGMA table_info([{table}])")
        ]
        count = connection.execute(f"SELECT COUNT(*) FROM [{table}]").fetchone()[0]
        temporal: dict[str, dict[str, object]] = {}
        for column in columns:
            if any(token in column.lower() for token in ("time", "date", "created", "finished", "resolved")):
                minimum, maximum = connection.execute(
                    f"SELECT MIN([{column}]), MAX([{column}]) FROM [{table}]"
                ).fetchone()
                temporal[column] = {"min": minimum, "max": maximum}
        distributions: dict[str, list[dict[str, object]]] = {}
        for column in ("result", "final_status", "gale_step", "winner"):
            if column not in columns:
                continue
            distributions[column] = [
                {"value": row[0], "rows": row[1]}
                for row in connection.execute(
                    f"SELECT [{column}], COUNT(*) AS rows FROM [{table}] "
                    f"GROUP BY [{column}] ORDER BY rows DESC LIMIT 20"
                )
            ]
        report.append(
            {
                "table": table,
                "rows": count,
                "columns": columns,
                "temporal": temporal,
                "distributions": distributions,
            }
        )
    print(json.dumps(report, ensure_ascii=True, indent=2, default=str))


if __name__ == "__main__":
    main()
