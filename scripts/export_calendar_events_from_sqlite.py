from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable
from zoneinfo import ZoneInfo


CALENDAR_TIMEZONE = ZoneInfo("America/Campo_Grande")
SOURCE_TIMEZONE = ZoneInfo("America/Sao_Paulo")
SOURCE_NAME = "official_sqlite_archive"

EVENT_COLUMNS = (
    "event_key",
    "module_key",
    "engine_key",
    "module_label",
    "strategy_id",
    "pattern_id",
    "signal_id",
    "round_id",
    "entry_side",
    "entry_at",
    "resolved_at",
    "entry_day_key",
    "entry_hour",
    "validity",
    "final_result",
    "outcome_class",
    "attempt",
    "status",
    "tie_multiplier",
    "timezone",
    "source",
    "payload",
    "created_at",
    "updated_at",
)


def parse_timestamp(value: Any) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    if text.endswith("Z"):
        text = f"{text[:-1]}+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=SOURCE_TIMEZONE)
    return parsed


def normalize_side(value: Any) -> str | None:
    text = str(value or "").strip().upper()
    if text in {"B", "BANKER", "BANCA"}:
        return "BANKER"
    if text in {"P", "PLAYER", "JOGADOR"}:
        return "PLAYER"
    if text in {"T", "TIE", "EMPATE"}:
        return "TIE"
    return None


def normalize_tie_multiplier(value: Any) -> str | None:
    text = str(value or "").strip().upper()
    if not text:
        return None
    return text if text.endswith("X") else f"{text}X"


def tie_multiplier_from_score(score: Any) -> str | None:
    value = int(score or 0)
    if value in {2, 12}:
        return "88X"
    if value in {3, 11}:
        return "25X"
    if value in {4, 10}:
        return "10X"
    if value in {5, 9}:
        return "6X"
    if value in {6, 7, 8}:
        return "4X"
    return None


def source_fingerprint(database: Path) -> str:
    digest = hashlib.sha256()
    with database.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def event_base(
    *,
    event_key: str,
    module_key: str,
    engine_key: str,
    module_label: str,
    strategy_id: str | None,
    signal_id: str | None,
    round_id: str | None,
    entry_side: str | None,
    entry_at: Any,
    resolved_at: Any,
    validity: str | None,
    final_result: str,
    outcome_class: str,
    attempt: str | None,
    tie_multiplier: Any,
    payload: dict[str, Any],
    imported_at: str,
    source_name: str,
) -> dict[str, Any] | None:
    entry = parse_timestamp(entry_at)
    resolved = parse_timestamp(resolved_at)
    if entry is None or resolved is None:
        return None
    calendar_parts = entry.astimezone(CALENDAR_TIMEZONE)
    return {
        "event_key": event_key,
        "module_key": module_key,
        "engine_key": engine_key,
        "module_label": module_label,
        "strategy_id": strategy_id,
        "pattern_id": None,
        "signal_id": signal_id,
        "round_id": round_id,
        "entry_side": entry_side,
        "entry_at": entry.isoformat(),
        "resolved_at": resolved.isoformat(),
        "entry_day_key": calendar_parts.date().isoformat(),
        "entry_hour": calendar_parts.hour,
        "validity": validity,
        "final_result": final_result,
        "outcome_class": outcome_class,
        "attempt": attempt,
        "status": "CLOSED",
        "tie_multiplier": normalize_tie_multiplier(tie_multiplier),
        "timezone": "America/Campo_Grande",
        "source": source_name,
        "payload": json.dumps(payload, ensure_ascii=True, sort_keys=True, separators=(",", ":")),
        "created_at": resolved.isoformat(),
        "updated_at": imported_at,
    }


def signal_event(
    row: sqlite3.Row,
    fingerprint: str,
    imported_at: str,
    source_name: str = SOURCE_NAME,
    event_key_mode: str = "archive",
) -> dict[str, Any] | None:
    final_status = str(row["final_status"] or "").strip().upper()
    if final_status not in {"GREEN", "GREEN_G1", "RED"}:
        return None
    signal_id = str(row["signal_id"] or row["id"])
    gale_step = int(row["gale_step"] or 0)
    attempt = "G1" if final_status in {"GREEN_G1", "RED"} or gale_step >= 1 else "SG"
    winner = normalize_side(row["winner"])
    return event_base(
        event_key=(
            f"neural_pagante:{signal_id}"
            if event_key_mode == "production"
            else f"sqlite:neural:{signal_id}"
        ),
        module_key="LEITURA_NEURAL_NUMERO_PAGANTE",
        engine_key="neural_pagante",
        module_label="Leitura Neural / Numero Pagante",
        strategy_id="official_neural_pagante",
        signal_id=signal_id,
        round_id=None,
        entry_side=normalize_side(row["entrada"]),
        entry_at=row["created_at"],
        resolved_at=row["finished_at"],
        validity="G1",
        final_result=final_status,
        outcome_class="GREEN" if final_status.startswith("GREEN") else "RED",
        attempt=attempt,
        tie_multiplier=row["tie_multiplier"],
        payload={
            "sourceTable": "signal_results",
            "sourceRowId": row["id"],
            "sourceFingerprint": fingerprint,
            "officialFinalStatus": final_status,
            "galeStep": gale_step,
            "winner": winner,
            "bankerScore": row["banker_score"],
            "playerScore": row["player_score"],
            "tieCovered": winner == "TIE" and final_status.startswith("GREEN"),
        },
        imported_at=imported_at,
        source_name=source_name,
    )


def surf_event(
    row: sqlite3.Row,
    fingerprint: str,
    imported_at: str,
    source_name: str = SOURCE_NAME,
    event_key_mode: str = "archive",
) -> dict[str, Any] | None:
    final_status = str(row["final_status"] or "").strip().upper()
    mapping = {
        "HIT_SURF_ALERT": ("GREEN", "GREEN"),
        "FAILED_SURF_ALERT": ("RED", "RED"),
        "TIE_SURF_ALERT": ("EMPATE", "NEUTRAL"),
        "EXPIRED_SURF_ALERT": ("EXPIRED", "NEUTRAL"),
    }
    mapped = mapping.get(final_status)
    if mapped is None:
        return None
    final_result, outcome_class = mapped
    alert_id = str(row["alert_id"] or row["id"])
    rounds_seen = int(row["rounds_seen"] or 0)
    if final_status == "EXPIRED_SURF_ALERT":
        attempt = None
    else:
        attempt = "SG" if rounds_seen <= 1 else "G1"
    prediction_window = int(row["prediction_window"] or 0)
    return event_base(
        event_key=(
            f"surf_analyzer:{alert_id}"
            if event_key_mode == "production"
            else f"sqlite:surf:{alert_id}"
        ),
        module_key="SURF_ANALYZER",
        engine_key="surf_analyzer",
        module_label="Surf Analyzer",
        strategy_id=str(row["surf_phase"] or "official_surf"),
        signal_id=alert_id,
        round_id=str(row["result_round_id"] or row["base_round_id"] or "") or None,
        entry_side=normalize_side(row["prediction_side"]),
        entry_at=row["created_at"],
        resolved_at=row["finished_at"],
        validity=f"{prediction_window}R" if prediction_window else None,
        final_result=final_result,
        outcome_class=outcome_class,
        attempt=attempt,
        tie_multiplier=(
            tie_multiplier_from_score(row["banker_score"] or row["player_score"])
            if final_status == "TIE_SURF_ALERT"
            else None
        ),
        payload={
            "sourceTable": "surf_alert_results",
            "sourceRowId": row["id"],
            "sourceFingerprint": fingerprint,
            "officialFinalStatus": final_status,
            "baseRoundId": row["base_round_id"],
            "resultRoundId": row["result_round_id"],
            "surfPhase": row["surf_phase"],
            "predictionConfidence": row["prediction_confidence"],
            "predictionWindow": prediction_window,
            "roundsSeen": rounds_seen,
            "sideHits": row["side_hits"],
            "oppositeHits": row["opposite_hits"],
            "breakRisk": row["break_risk"],
            "winner": normalize_side(row["winner"]),
        },
        imported_at=imported_at,
        source_name=source_name,
    )


def tie_event(
    row: sqlite3.Row,
    fingerprint: str,
    imported_at: str,
    source_name: str = SOURCE_NAME,
    event_key_mode: str = "archive",
) -> dict[str, Any] | None:
    final_status = str(row["final_status"] or "").strip().upper()
    mapping = {
        "GREEN_TIE_ALERT": ("EMPATE", "GREEN"),
        "EXPIRED_TIE_ALERT": ("RED", "RED"),
    }
    mapped = mapping.get(final_status)
    if mapped is None:
        return None
    final_result, outcome_class = mapped
    alert_id = str(row["alert_id"] or row["id"])
    return event_base(
        event_key=(
            f"radar_empates:{alert_id}"
            if event_key_mode == "production"
            else f"sqlite:tie:{alert_id}"
        ),
        module_key="RADAR_DE_EMPATE",
        engine_key="radar_empates",
        module_label="Radar de Empate",
        strategy_id="official_tie_alert",
        signal_id=alert_id,
        round_id=str(row["result_round_id"] or row["base_round_id"] or "") or None,
        entry_side="TIE",
        entry_at=row["created_at"],
        resolved_at=row["finished_at"],
        validity="4R",
        final_result=final_result,
        outcome_class=outcome_class,
        attempt=None,
        tie_multiplier=row["tie_multiplier"],
        payload={
            "sourceTable": "tie_alert_results",
            "sourceRowId": row["id"],
            "sourceFingerprint": fingerprint,
            "officialFinalStatus": final_status,
            "baseRoundId": row["base_round_id"],
            "resultRoundId": row["result_round_id"],
            "tieLevel": row["tie_level"],
            "tieConfidence": row["tie_confidence"],
            "roundsSeen": row["rounds_seen"],
            "winner": normalize_side(row["winner"]),
            "bankerScore": row["banker_score"],
            "playerScore": row["player_score"],
        },
        imported_at=imported_at,
        source_name=source_name,
    )


def load_events(
    database: Path,
    source_name: str = SOURCE_NAME,
    event_key_mode: str = "archive",
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    fingerprint = source_fingerprint(database)
    imported_at = datetime.now().astimezone().isoformat()
    uri = f"file:{database.resolve().as_posix()}?mode=ro"
    connection = sqlite3.connect(uri, uri=True)
    connection.row_factory = sqlite3.Row
    skipped = Counter()
    events: dict[str, dict[str, Any]] = {}

    sources = (
        ("signal_results", signal_event),
        ("surf_alert_results", surf_event),
        ("tie_alert_results", tie_event),
    )
    for table, converter in sources:
        for row in connection.execute(f"SELECT * FROM [{table}] ORDER BY id ASC"):
            event = converter(row, fingerprint, imported_at, source_name, event_key_mode)
            if event is None:
                skipped[table] += 1
                continue
            events[event["event_key"]] = event
    connection.close()

    ordered = sorted(events.values(), key=lambda item: (item["entry_at"], item["event_key"]))
    manifest = build_manifest(
        database,
        fingerprint,
        ordered,
        skipped,
        imported_at,
        source_name,
        event_key_mode,
    )
    return ordered, manifest


def build_manifest(
    database: Path,
    fingerprint: str,
    events: list[dict[str, Any]],
    skipped: Counter[str],
    imported_at: str,
    source_name: str,
    event_key_mode: str,
) -> dict[str, Any]:
    by_engine = Counter(event["engine_key"] for event in events)
    by_result = Counter(
        f"{event['engine_key']}:{event['outcome_class']}:{event['final_result']}" for event in events
    )
    by_month = Counter(event["entry_day_key"][:7] for event in events)
    return {
        "source": str(database.resolve()),
        "sourceSha256": fingerprint,
        "sourceMode": "read_only",
        "sourceName": source_name,
        "eventKeyMode": event_key_mode,
        "calendarTimezone": "America/Campo_Grande",
        "importedAt": imported_at,
        "events": len(events),
        "firstEntryAt": events[0]["entry_at"] if events else None,
        "lastEntryAt": events[-1]["entry_at"] if events else None,
        "byEngine": dict(sorted(by_engine.items())),
        "byResult": dict(sorted(by_result.items())),
        "byMonth": dict(sorted(by_month.items())),
        "skipped": dict(sorted(skipped.items())),
        "dedupe": "event_key",
        "openRowsImported": 0,
    }


def sql_literal(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def batched(values: list[dict[str, Any]], size: int) -> Iterable[list[dict[str, Any]]]:
    for offset in range(0, len(values), size):
        yield values[offset : offset + size]


def upsert_statement(events: list[dict[str, Any]]) -> str:
    rows = [
        "(" + ",".join(sql_literal(event[column]) for column in EVENT_COLUMNS) + ")"
        for event in events
    ]
    return (
        "INSERT INTO calendar_result_events (\n  "
        + ", ".join(EVENT_COLUMNS)
        + "\n) VALUES\n  "
        + ",\n  ".join(rows)
        + "\nON CONFLICT(event_key) DO UPDATE SET\n"
        + "  module_key=excluded.module_key, engine_key=excluded.engine_key, "
        + "module_label=excluded.module_label, strategy_id=excluded.strategy_id, "
        + "signal_id=excluded.signal_id, round_id=excluded.round_id, "
        + "entry_side=excluded.entry_side, entry_at=excluded.entry_at, "
        + "resolved_at=excluded.resolved_at, entry_day_key=excluded.entry_day_key, "
        + "entry_hour=excluded.entry_hour, validity=excluded.validity, "
        + "final_result=excluded.final_result, outcome_class=excluded.outcome_class, "
        + "attempt=excluded.attempt, status=excluded.status, "
        + "tie_multiplier=excluded.tie_multiplier, timezone=excluded.timezone, "
        + "source=excluded.source, payload=excluded.payload, updated_at=excluded.updated_at;\n"
    )


def write_sql_chunks(events: list[dict[str, Any]], output_dir: Path, chunk_size: int) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    files: list[Path] = []
    for chunk_index, chunk in enumerate(batched(events, chunk_size), start=1):
        statements = [upsert_statement(group) for group in batched(chunk, 100)]
        target = output_dir / f"calendar-events-{chunk_index:03d}.sql"
        target.write_text("\n".join(statements), encoding="utf-8", newline="\n")
        files.append(target)
    return files


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export finalized official Bac Bo results to deduplicated D1 calendar events."
    )
    parser.add_argument("database", type=Path)
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--chunk-size", type=int, default=1000)
    parser.add_argument("--source-name", default=SOURCE_NAME)
    parser.add_argument("--event-key-mode", choices=("archive", "production"), default="archive")
    args = parser.parse_args()

    if not args.database.is_file():
        raise SystemExit(f"Database not found: {args.database}")
    if args.chunk_size < 100:
        raise SystemExit("--chunk-size must be at least 100")

    events, manifest = load_events(args.database, args.source_name, args.event_key_mode)
    files: list[Path] = []
    if args.output_dir:
        files = write_sql_chunks(events, args.output_dir, args.chunk_size)
        (args.output_dir / "manifest.json").write_text(
            json.dumps(manifest, ensure_ascii=True, indent=2),
            encoding="utf-8",
            newline="\n",
        )
    report = {**manifest, "sqlFiles": [str(path.resolve()) for path in files]}
    print(json.dumps(report, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
