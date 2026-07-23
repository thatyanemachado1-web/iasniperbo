from __future__ import annotations

import importlib.util
import sqlite3
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).with_name("export_calendar_events_from_sqlite.py")
SPEC = importlib.util.spec_from_file_location("calendar_sqlite_export", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class CalendarSqliteExportTest(unittest.TestCase):
    def setUp(self) -> None:
        self.directory = tempfile.TemporaryDirectory()
        self.database = Path(self.directory.name) / "bacbo.db"
        connection = sqlite3.connect(self.database)
        connection.executescript(
            """
            CREATE TABLE signal_results (
              id INTEGER PRIMARY KEY, signal_id TEXT, created_at TEXT, finished_at TEXT,
              entrada TEXT, result TEXT, final_status TEXT, gale_step INTEGER,
              banker_score INTEGER, player_score INTEGER, winner TEXT, tie_multiplier TEXT
            );
            CREATE TABLE surf_alert_results (
              id INTEGER PRIMARY KEY, alert_id TEXT, created_at TEXT, finished_at TEXT,
              base_round_id TEXT, result_round_id TEXT, final_status TEXT, surf_phase TEXT,
              prediction_side TEXT, prediction_confidence INTEGER, prediction_window INTEGER,
              rounds_seen INTEGER, side_hits INTEGER, opposite_hits INTEGER, reason TEXT,
              stretched_count INTEGER, break_risk INTEGER, banker_score INTEGER,
              player_score INTEGER, winner TEXT
            );
            CREATE TABLE tie_alert_results (
              id INTEGER PRIMARY KEY, alert_id TEXT, created_at TEXT, finished_at TEXT,
              base_round_id TEXT, result_round_id TEXT, final_status TEXT, tie_level TEXT,
              tie_confidence INTEGER, rounds_seen INTEGER, reason TEXT, banker_score INTEGER,
              player_score INTEGER, winner TEXT, tie_multiplier TEXT
            );
            """
        )
        connection.execute(
            "INSERT INTO signal_results VALUES (1,'n1','2026-06-01T20:10:00-03:00',"
            "'2026-06-01T20:11:00-03:00','Banker','Tie','GREEN_G1',1,8,8,'Tie','25x')"
        )
        connection.execute(
            "INSERT INTO surf_alert_results VALUES (1,'s1','2026-06-01T21:10:00-03:00',"
            "'2026-06-01T21:11:00-03:00','r1','r2','EXPIRED_SURF_ALERT','SURF',"
            "'PLAYER',80,4,2,0,0,'expired',3,20,NULL,NULL,NULL)"
        )
        connection.execute(
            "INSERT INTO surf_alert_results VALUES (2,'s2','2026-06-01T22:10:00-03:00',"
            "'2026-06-01T22:11:00-03:00','r2','r3','TIE_SURF_ALERT','SURF',"
            "'BANKER',80,1,1,0,0,'tie',3,20,11,11,'Tie')"
        )
        connection.execute(
            "INSERT INTO tie_alert_results VALUES (1,'t1','2026-06-01T22:10:00-03:00',"
            "'2026-06-01T22:11:00-03:00','r2','r3','GREEN_TIE_ALERT','ALTO',90,1,"
            "'tie',6,6,'Tie','25x')"
        )
        connection.commit()
        connection.close()

    def tearDown(self) -> None:
        self.directory.cleanup()

    def test_official_engine_semantics_and_timezone(self) -> None:
        events, manifest = MODULE.load_events(self.database)
        self.assertEqual(4, len(events))
        by_engine = {}
        for event in events:
            by_engine.setdefault(event["engine_key"], []).append(event)

        neural = by_engine["neural_pagante"][0]
        self.assertEqual("GREEN", neural["outcome_class"])
        self.assertEqual("GREEN_G1", neural["final_result"])
        self.assertEqual("G1", neural["attempt"])
        self.assertEqual("25X", neural["tie_multiplier"])
        self.assertEqual(19, neural["entry_hour"])

        surf_events = by_engine["surf_analyzer"]
        expired = next(event for event in surf_events if event["final_result"] == "EXPIRED")
        tie_surf = next(event for event in surf_events if event["final_result"] == "EMPATE")
        self.assertEqual("NEUTRAL", expired["outcome_class"])
        self.assertEqual("NEUTRAL", tie_surf["outcome_class"])
        self.assertEqual("25X", tie_surf["tie_multiplier"])

        tie = by_engine["radar_empates"][0]
        self.assertEqual("GREEN", tie["outcome_class"])
        self.assertEqual("EMPATE", tie["final_result"])
        self.assertEqual("25X", tie["tie_multiplier"])
        self.assertEqual(4, manifest["events"])
        self.assertEqual(0, manifest["openRowsImported"])

    def test_production_keys_match_worker_event_keys(self) -> None:
        events, manifest = MODULE.load_events(
            self.database,
            "official_vps_sqlite_snapshot",
            "production",
        )
        keys = {event["event_key"] for event in events}
        self.assertIn("neural_pagante:n1", keys)
        self.assertIn("surf_analyzer:s1", keys)
        self.assertIn("radar_empates:t1", keys)
        self.assertEqual("production", manifest["eventKeyMode"])


if __name__ == "__main__":
    unittest.main()
