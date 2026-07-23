from __future__ import annotations

import argparse
import json
import sqlite3
import tempfile
from pathlib import Path


def rows_as_dicts(connection: sqlite3.Connection, query: str) -> list[dict[str, object]]:
    connection.row_factory = sqlite3.Row
    return [dict(row) for row in connection.execute(query)]


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify generated calendar D1 import SQL locally.")
    parser.add_argument("migration", type=Path)
    parser.add_argument("import_dir", type=Path)
    args = parser.parse_args()

    manifest = json.loads((args.import_dir / "manifest.json").read_text(encoding="utf-8"))
    sql_files = sorted(args.import_dir.glob("calendar-events-*.sql"))
    if not sql_files:
        raise SystemExit("No calendar import SQL files found.")

    with tempfile.TemporaryDirectory() as temporary:
        database = Path(temporary) / "calendar-import.sqlite3"
        connection = sqlite3.connect(database)
        connection.executescript(args.migration.read_text(encoding="utf-8"))
        for sql_file in sql_files:
            connection.executescript(sql_file.read_text(encoding="utf-8"))
        count = int(connection.execute("SELECT COUNT(*) FROM calendar_result_events").fetchone()[0])

        connection.executescript(sql_files[0].read_text(encoding="utf-8"))
        count_after_replay = int(
            connection.execute("SELECT COUNT(*) FROM calendar_result_events").fetchone()[0]
        )
        invalid = int(
            connection.execute(
                "SELECT COUNT(*) FROM calendar_result_events "
                "WHERE status <> 'CLOSED' OR outcome_class NOT IN ('GREEN','RED','NEUTRAL')"
            ).fetchone()[0]
        )
        by_engine = rows_as_dicts(
            connection,
            "SELECT engine_key, COUNT(*) AS events, "
            "SUM(outcome_class='GREEN') AS greens, SUM(outcome_class='RED') AS reds, "
            "SUM(outcome_class='NEUTRAL') AS neutral "
            "FROM calendar_result_events GROUP BY engine_key ORDER BY engine_key",
        )
        by_month = rows_as_dicts(
            connection,
            "SELECT substr(entry_day_key,1,7) AS month, COUNT(*) AS events "
            "FROM calendar_result_events GROUP BY month ORDER BY month",
        )
        connection.close()

    expected = int(manifest["events"])
    report = {
        "ok": count == expected and count_after_replay == count and invalid == 0,
        "expected": expected,
        "imported": count,
        "afterFirstChunkReplay": count_after_replay,
        "dedupeStable": count_after_replay == count,
        "invalidRows": invalid,
        "byEngine": by_engine,
        "byMonth": by_month,
        "sqlFiles": len(sql_files),
    }
    print(json.dumps(report, ensure_ascii=True, indent=2))
    if not report["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
