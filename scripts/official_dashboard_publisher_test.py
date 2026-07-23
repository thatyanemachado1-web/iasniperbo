import importlib.util
import inspect
import pathlib
import tempfile
import unittest
import copy
from unittest import mock


MODULE_PATH = pathlib.Path(__file__).with_name("official_dashboard_publisher.py")
SPEC = importlib.util.spec_from_file_location("official_dashboard_publisher", MODULE_PATH)
publisher = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(publisher)


class EnvFileTests(unittest.TestCase):
    def test_load_env_file_strips_utf8_bom_from_first_key(self):
        with tempfile.TemporaryDirectory() as directory:
            env_path = pathlib.Path(directory) / "publisher.env"
            env_path.write_text(
                "\ufeffSNIPER_ADMIN_EMAIL=admin@example.test\n"
                "SNIPER_ADMIN_PASSWORD=secret\n",
                encoding="utf-8",
            )

            values = publisher.load_env_file(env_path)

        self.assertEqual(values["SNIPER_ADMIN_EMAIL"], "admin@example.test")
        self.assertNotIn("\ufeffSNIPER_ADMIN_EMAIL", values)


class DirectTelegramSignalTests(unittest.TestCase):
    def setUp(self):
        self._pattern_cache_key = publisher.DIRECT_PATTERN_MINER_SNAPSHOT_CACHE_KEY
        self._pattern_cache = publisher.DIRECT_PATTERN_MINER_SNAPSHOT_CACHE
        self.addCleanup(self._restore_pattern_cache)

    def _restore_pattern_cache(self):
        publisher.DIRECT_PATTERN_MINER_SNAPSHOT_CACHE_KEY = self._pattern_cache_key
        publisher.DIRECT_PATTERN_MINER_SNAPSHOT_CACHE = self._pattern_cache

    def test_fast_path_constants_fit_one_second_budget(self):
        self.assertLessEqual(publisher.DEFAULT_PUBLISHER_INTERVAL_SECONDS, 0.2)
        self.assertLessEqual(publisher.URGENT_SIGNAL_CONNECT_TIMEOUT, 0.25)
        self.assertLessEqual(publisher.URGENT_SIGNAL_READ_TIMEOUT, 1.0)
        self.assertEqual(publisher.DIRECT_TELEGRAM_RESULT_TO_ENTRY_DELAY_SECONDS, 2.0)

    def test_all_card_lifecycle_changes_trigger_urgent_and_full_publish(self):
        base = {
            "rounds": [{"id": 5000, "result": "B", "playerScore": 4, "bankerScore": 8}],
            "currentSignal": {"id": "waiting", "status": "waiting", "side": "NONE"},
        }
        variants = []

        neural = copy.deepcopy(base)
        neural["neuralEntryState"] = {
            "key": "7:BANKER:PAGANTE:PLAYER",
            "status": "awaiting_sg",
            "expectedSide": "PLAYER",
            "triggerRoundKey": "5000",
        }
        variants.append(neural)

        surf = copy.deepcopy(base)
        surf["currentSurfAlert"] = {
            "surfCycle": {
                "cycleId": "surf-5000",
                "cycleStatus": "AGUARDANDO_RESULTADO",
                "technicalSide": "BANKER",
            }
        }
        variants.append(surf)

        tie = copy.deepcopy(base)
        tie["currentTieAlert"] = {
            "id": "tie-5000",
            "status": "active",
            "level": "Alto",
            "confidence": 82,
        }
        variants.append(tie)

        pattern = copy.deepcopy(base)
        pattern["patternIaServerCycle"] = {
            "module": "PADROES_IA",
            "signalId": "pattern-5000",
            "cycleStatus": "AGUARDANDO_RESULTADO",
            "technicalSide": "PLAYER",
            "sourceRoundId": 5000,
        }
        variants.append(pattern)

        pattern_alert = copy.deepcopy(base)
        pattern_alert["patternMinerSnapshot"] = {
            "entryAlerts": [{
                "id": "validated-5000",
                "kind": "validated",
                "strategy": {"id": "p1", "status": "HOT", "expectedResult": "B"},
                "matchedRounds": [{"id": 5000}],
            }]
        }
        variants.append(pattern_alert)

        lateral = copy.deepcopy(base)
        lateral["bacBoBeadPlate"] = [
            {"id": "5000", "side": "BANKER", "value": 8, "slot": 30}
        ]
        variants.append(lateral)

        base_urgent = publisher.dashboard_signal_fingerprint(base)
        base_full = publisher.dashboard_fingerprint(base)
        for payload in variants:
            with self.subTest(payload=payload):
                self.assertNotEqual(publisher.dashboard_signal_fingerprint(payload), base_urgent)
                self.assertNotEqual(publisher.dashboard_fingerprint(payload), base_full)

    def test_urgent_payload_carries_all_official_card_sources(self):
        payload = {
            "rounds": [{"id": 5001, "result": "P"}],
            "patternIaServerCycle": {"module": "PADROES_IA", "cycleStatus": "CLOSED"},
            "patternMinerSnapshot": {"updatedAt": "now", "entryAlerts": []},
            "aiPatternSignal": {"id": "ai-5001"},
            "dailyResultsByModule": {"SURF_ANALYZER": [{"resultId": "surf-5001"}]},
            "bacBoBeadPlate": [{"id": "5001", "side": "PLAYER", "value": 9, "slot": 31}],
            "currentSurfAlert": {"surfCycle": {"cycleId": "surf-5001"}},
            "currentTieAlert": {"id": "tie-5001", "status": "green"},
        }

        urgent = publisher.build_urgent_signal_payload(payload)

        for key in (
            "patternIaServerCycle",
            "patternMinerSnapshot",
            "aiPatternSignal",
            "dailyResultsByModule",
            "bacBoBeadPlate",
            "currentSurfAlert",
            "currentTieAlert",
        ):
            self.assertIn(key, urgent)

    def test_direct_site_non_neural_payload_preserves_module_source(self):
        base = {
            "rounds": [{"id": 5002, "result": "B"}],
            "currentSurfAlert": {
                "surf_alert": True,
                "surf_prediction_side": "BANKER",
                "surfCycle": {"cycleId": "surf-5002", "cycleStatus": "AGUARDANDO_RESULTADO"},
            },
        }
        signal = {
            "moduleKey": "surf_alert",
            "signalKey": "surf-5002",
            "roundId": 5002,
            "entry": "BANKER",
        }

        direct = publisher.build_direct_site_signal_payload(base, signal)

        self.assertEqual(direct["currentSurfAlert"], base["currentSurfAlert"])
        self.assertNotIn("currentSignal", direct)

    def test_pending_result_block_is_retryable(self):
        self.assertFalse(publisher.direct_telegram_block_handled("blocked_count=1;pending_result=1"))
        self.assertFalse(
            publisher.direct_telegram_block_handled(
                "blocked_count=2;duplicate_signal=1;pending_result=1",
            )
        )

    def test_only_terminal_blocks_are_marked_handled(self):
        self.assertTrue(publisher.direct_telegram_block_handled("duplicate_signal"))
        self.assertTrue(publisher.direct_telegram_block_handled("blocked_count=1;module_inactive=1"))
        self.assertTrue(publisher.direct_telegram_block_handled("blocked_count=1;missing_pending_entry=1"))
        self.assertFalse(publisher.direct_telegram_block_handled("blocked_count=1;telegram_error=1"))

    def test_local_payload_wins_when_its_round_is_newer(self):
        published_payload = {"rounds": [{"id": 3001, "result": "B"}], "revision": 50}
        local_payload = {"rounds": [{"id": 3002, "result": "P"}], "revision": 1}

        payload, source = publisher.direct_telegram_payload(published_payload, local_payload)

        self.assertIs(payload, local_payload)
        self.assertEqual(source, "local")

    def test_local_payload_wins_same_round_and_revision_tie(self):
        published_payload = {"rounds": [{"id": 3002, "result": "P"}], "revision": 10}
        local_payload = {
            "rounds": [{"id": 3002, "result": "P"}],
            "revision": 10,
            "neuralReading": {"status": "ENTRADA_CONFIRMADA"},
        }

        payload, source = publisher.direct_telegram_payload(published_payload, local_payload)

        self.assertIs(payload, local_payload)
        self.assertEqual(source, "local")

    def test_production_config_uses_engine_default_and_publisher_token(self):
        with mock.patch.dict(publisher.os.environ, {}, clear=True):
            config = publisher.build_direct_telegram_config(
                {"SNIPER_PUBLISHER_TOKEN": "publisher-secret"},
                enabled=True,
                single_target=False,
            )

        self.assertEqual(config["url"], publisher.DEFAULT_TELEGRAM_ENGINE_URL)
        self.assertEqual(config["secret"], "publisher-secret")

    def test_final_result_carries_atomic_resolution_fields(self):
        captured = {}

        def fake_request(_url, **kwargs):
            captured.update(kwargs["payload"])
            return {"sent": [{"channelId": "room-1"}], "blocked": []}, 200, 15.0

        with mock.patch.object(publisher, "request_json_with_meta", side_effect=fake_request):
            ok, status, _elapsed, _reason = publisher.publish_direct_telegram_signal(
                {"url": "https://engine.test", "secret": "secret", "user_id": "", "channel_id": ""},
                {
                    "moduleKey": "paying_numbers",
                    "signalKey": "publisher:paying:3001:BANKER:7:result:GREEN:3002",
                    "resolvesSignalKey": "publisher:paying:3001:BANKER:7",
                    "finalResult": True,
                    "roundId": 3002,
                    "entry": "BANKER",
                    "result": "Green",
                    "message": "GREEN",
                },
            )

        self.assertTrue(ok)
        self.assertEqual(status, 200)
        self.assertEqual(captured["resolvesSignalKey"], "publisher:paying:3001:BANKER:7")
        self.assertIs(captured["finalResult"], True)

    def test_locked_result_resolution_stays_retryable(self):
        with mock.patch.object(
            publisher,
            "request_json_with_meta",
            return_value=({"ok": True, "skipped": "locked"}, 200, 10.0),
        ):
            ok, status, _elapsed, reason = publisher.resolve_direct_telegram_pending_results(
                {"url": "https://engine.test", "secret": "secret"},
                {"rounds": [{"id": 3002, "result": "P"}]},
            )

        self.assertFalse(ok)
        self.assertEqual(status, 200)
        self.assertEqual(reason, "locked")

    def test_pattern_cache_miss_does_not_recompute_on_critical_path(self):
        payload = {"rounds": [{"id": 3002, "result": "P", "playerScore": 8, "bankerScore": 5}]}
        bank = [publisher.direct_normalize_pattern_round(payload["rounds"][0])]
        publisher.DIRECT_PATTERN_MINER_SNAPSHOT_CACHE_KEY = ""
        publisher.DIRECT_PATTERN_MINER_SNAPSHOT_CACHE = None

        with mock.patch.object(publisher, "direct_pattern_miner_snapshot") as rebuild:
            critical_payload = publisher.attach_direct_pattern_miner_snapshot(
                payload,
                bank,
                refresh=False,
            )

        rebuild.assert_not_called()
        self.assertNotIn("patternMinerSnapshot", critical_payload)

    def test_matching_pattern_cache_is_safe_on_critical_path(self):
        payload = {"rounds": [{"id": 3003, "result": "B", "playerScore": 4, "bankerScore": 9}]}
        bank = [publisher.direct_normalize_pattern_round(payload["rounds"][0])]
        cached = {"updatedAt": "2026-07-14T03:00:00.000Z", "entryAlerts": []}
        publisher.DIRECT_PATTERN_MINER_SNAPSHOT_CACHE_KEY = publisher.direct_pattern_miner_snapshot_cache_key(bank)
        publisher.DIRECT_PATTERN_MINER_SNAPSHOT_CACHE = cached

        critical_payload = publisher.attach_direct_pattern_miner_snapshot(
            payload,
            bank,
            refresh=False,
        )

        self.assertIs(critical_payload["patternMinerSnapshot"], cached)

    def test_pattern_cache_refresh_is_non_blocking(self):
        payload = {"rounds": [{"id": 3004, "result": "P", "playerScore": 9, "bankerScore": 3}]}
        bank = [publisher.direct_normalize_pattern_round(payload["rounds"][0])]
        publisher.DIRECT_PATTERN_MINER_SNAPSHOT_CACHE_KEY = ""
        publisher.DIRECT_PATTERN_MINER_SNAPSHOT_CACHE = None
        publisher.DIRECT_PATTERN_MINER_REFRESH_THREAD = None
        started = publisher.threading.Event()
        release = publisher.threading.Event()

        def slow_refresh(_rounds):
            started.set()
            release.wait(1.0)
            return {}

        with mock.patch.object(publisher, "direct_pattern_miner_snapshot", side_effect=slow_refresh):
            start = publisher.time.perf_counter()
            scheduled = publisher.refresh_direct_pattern_miner_snapshot_cache(payload, bank)
            elapsed = publisher.time.perf_counter() - start
            self.assertTrue(started.wait(0.5))
            self.assertTrue(scheduled)
            self.assertLess(elapsed, 0.1)
            self.assertFalse(publisher.refresh_direct_pattern_miner_snapshot_cache(payload, bank))
            release.set()
            assert publisher.DIRECT_PATTERN_MINER_REFRESH_THREAD is not None
            publisher.DIRECT_PATTERN_MINER_REFRESH_THREAD.join(1.0)

        self.assertFalse(publisher.DIRECT_PATTERN_MINER_REFRESH_THREAD.is_alive())

    def test_accepted_result_is_final_before_recovery_timeout(self):
        result_keys: set[str] = set()
        module_hold_until: dict[str, float] = {}
        pending = {"moduleKey": "paying_numbers", "roundId": 3001}

        with mock.patch.object(publisher.time, "monotonic", return_value=100.0):
            publisher.accept_direct_telegram_result(
                pending,
                "result-key",
                "aggregate-key",
                result_keys,
                module_hold_until,
            )
        with mock.patch.object(
            publisher,
            "resolve_direct_telegram_pending_results",
            side_effect=TimeoutError("engine timeout"),
        ):
            ok, status, elapsed, reason = publisher.recover_direct_telegram_pending_result(
                {"url": "https://engine.test", "secret": "secret"},
                {"rounds": [{"id": 3002, "result": "P"}]},
            )

        self.assertEqual(result_keys, {"result-key", "aggregate-key"})
        self.assertEqual(module_hold_until["paying_numbers"], 102.0)
        self.assertFalse(ok)
        self.assertEqual(status, 0)
        self.assertEqual(elapsed, 0.0)
        self.assertEqual(reason, "recovery_error:TimeoutError")

    def test_main_keeps_critical_sends_before_deferred_pattern_refresh(self):
        source = inspect.getsource(publisher.main)

        cache_only = source.index("refresh=False")
        early_urgent = source.index("if signal_changed:", cache_only)
        terminal_results = source.index("telegram_result_payload", early_urgent)
        telegram_entries = source.index("for direct_signal in direct_telegram_signals", terminal_results)
        site_entries = source.index("# The urgent dashboard snapshot", telegram_entries)
        deferred_refresh = source.index("refresh_direct_pattern_miner_snapshot_cache", site_entries)

        self.assertLess(cache_only, early_urgent)
        self.assertLess(early_urgent, terminal_results)
        self.assertLess(terminal_results, telegram_entries)
        self.assertLess(telegram_entries, site_entries)
        self.assertLess(site_entries, deferred_refresh)

    def test_visual_player_card_beats_stale_banker_signal(self):
        payload = {
            "rounds": [{"id": 1201, "result": "B"}],
            "currentSignal": {"id": "stale-banker", "side": "BANKER", "status": "pending"},
            "neuralEntryState": {
                "key": "stale-banker",
                "expectedSide": "BANKER",
                "status": "awaiting_sg",
                "triggerRoundKey": "1200",
            },
            "neuralReading": {
                "mode": "ACTIVE",
                "direcao": "PLAYER",
                "origem": "PLAYER",
                "numero": 9,
                "paganteStatus": "ENTRADA CONFIRMADA PLAYER",
            },
        }

        signals = publisher.direct_telegram_signals(payload)
        paying = [item for item in signals if item["moduleKey"] == "paying_numbers"]

        self.assertEqual(len(paying), 1)
        self.assertEqual(paying[0]["entry"], "PLAYER")
        self.assertIn(":PLAYER:", paying[0]["signalKey"])

    def test_visual_banker_card_sends_without_main_signal_pending(self):
        payload = {
            "rounds": [{"id": 1202, "result": "P"}],
            "currentSignal": {"id": "waiting", "side": "NONE", "status": "waiting"},
            "neuralReading": {
                "mode": "ACTIVE",
                "direcao": "BANKER",
                "origem": "BANKER",
                "numero": 4,
                "paganteStatus": "ENTRADA CONFIRMADA BANKER",
            },
        }

        signals = publisher.direct_telegram_signals(payload)
        paying = [item for item in signals if item["moduleKey"] == "paying_numbers"]

        self.assertEqual(len(paying), 1)
        self.assertEqual(paying[0]["entry"], "BANKER")

    def test_tie_visual_card_does_not_create_paying_numbers(self):
        payload = {
            "rounds": [{"id": 1203, "result": "B"}],
            "neuralReading": {
                "mode": "ACTIVE",
                "direcao": "TIE",
                "origem": "TIE",
                "numero": 6,
                "paganteStatus": "ENTRADA CONFIRMADA TIE",
            },
            "currentTieAlert": {"id": "tie-1203", "status": "active", "level": "alto"},
        }

        signals = publisher.direct_telegram_signals(payload)
        module_entries = [(item["moduleKey"], item["entry"]) for item in signals]

        self.assertNotIn(("paying_numbers", "TIE"), module_entries)
        self.assertIn(("ties_only", "TIE"), module_entries)

    def test_result_outcome_uses_published_payload_when_local_is_stale(self):
        pending = {
            "moduleKey": "paying_numbers",
            "signalKey": "publisher:paying:2201:BANKER:7",
            "roundId": 2201,
            "entry": "BANKER",
            "maxGale": 1,
        }
        published_payload = {
            "rounds": [
                {"id": 2201, "result": "P"},
                {"id": 2202, "result": "B"},
            ],
        }
        local_payload = {
            "rounds": [
                {"id": 1201, "result": "P"},
                {"id": 1202, "result": "P"},
            ],
        }

        payload, source = publisher.direct_telegram_payload(published_payload, local_payload)
        outcome = publisher.resolve_direct_telegram_outcome(pending, payload)

        self.assertEqual(source, "published")
        self.assertIsNotNone(outcome)
        self.assertEqual(outcome["status"], "GREEN")
        self.assertEqual(outcome["label"], "GREEN SG")

    def test_local_payload_wins_same_round_even_with_lower_revision(self):
        published_payload = {
            "revision": 999,
            "rounds": [{"id": 2250, "result": "B"}],
            "payingNumbers": {"paganteStatus": "AGUARDANDO G1 BANKER"},
        }
        local_payload = {
            "revision": 2,
            "rounds": [{"id": 2250, "result": "B"}],
            "payingNumbers": {"paganteStatus": "GREEN G1 PLAYER"},
        }

        payload, source = publisher.direct_telegram_payload(published_payload, local_payload)

        self.assertEqual(source, "local")
        self.assertIs(payload, local_payload)

    def test_result_outcome_waits_g1_before_final_red(self):
        red_pending = {
            "moduleKey": "paying_numbers",
            "signalKey": "publisher:paying:2301:BANKER:7",
            "roundId": 2301,
            "entry": "BANKER",
            "maxGale": 1,
        }
        g1_outcome = publisher.resolve_direct_telegram_outcome(
            red_pending,
            {
                "rounds": [
                    {"id": 2301, "result": "B"},
                    {"id": 2302, "result": "P"},
                    {"id": 2303, "result": "P"},
                ],
            },
        )
        red_after_g1_notice = publisher.resolve_direct_telegram_outcome(
            {**red_pending, "g1NoticeRoundIds": ["2302"]},
            {
                "rounds": [
                    {"id": 2301, "result": "B"},
                    {"id": 2302, "result": "P"},
                    {"id": 2303, "result": "P"},
                ],
            },
        )

        self.assertEqual(g1_outcome["status"], "G1_ACTIVE")
        self.assertIn("PROTEÇÃO G1 ATIVA", publisher.direct_result_message(red_pending, g1_outcome))
        self.assertEqual(red_after_g1_notice["status"], "RED")

    def test_result_outcome_confirms_green_g1_after_notice(self):
        pending = {
            "moduleKey": "paying_numbers",
            "signalKey": "publisher:paying:2501:BANKER:7",
            "roundId": 2501,
            "entry": "BANKER",
            "maxGale": 1,
            "g1NoticeRoundIds": ["2502"],
        }
        outcome = publisher.resolve_direct_telegram_outcome(
            pending,
            {
                "rounds": [
                    {"id": 2501, "result": "B"},
                    {"id": 2502, "result": "P"},
                    {"id": 2503, "result": "B"},
                ],
            },
        )

        self.assertEqual(outcome["status"], "GREEN")
        self.assertEqual(outcome["label"], "GREEN G1")
        self.assertIn("GREEN G1", publisher.direct_result_message(pending, outcome))

    def test_tie_protects_normal_entry_and_confirms_tie_radar(self):
        normal_pending = {
            "moduleKey": "paying_numbers",
            "signalKey": "publisher:paying:2401:BANKER:7",
            "roundId": 2401,
            "entry": "BANKER",
            "maxGale": 1,
        }
        tie_protection = publisher.resolve_direct_telegram_outcome(
            normal_pending,
            {
                "rounds": [
                    {"id": 2401, "result": "B"},
                    {"id": 2402, "result": "T", "bankerScore": 6, "playerScore": 6},
                ],
            },
        )
        tie_radar_outcome = publisher.resolve_direct_telegram_outcome(
            {**normal_pending, "moduleKey": "ties_only"},
            {
                "rounds": [
                    {"id": 2401, "result": "B"},
                    {"id": 2402, "result": "T", "bankerScore": 6, "playerScore": 6},
                ],
            },
        )

        self.assertEqual(tie_protection["status"], "TIE_PROTECTION")
        self.assertIn("PROTEGIDO / AGUARDANDO DEFINIÇÃO", publisher.direct_result_message(normal_pending, tie_protection))
        self.assertEqual(tie_radar_outcome["status"], "TIE")
        self.assertIn("EMPATE CONFIRMADO", publisher.direct_result_message(normal_pending, tie_radar_outcome))

if __name__ == "__main__":
    unittest.main()
