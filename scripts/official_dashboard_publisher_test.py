import importlib.util
import pathlib
import unittest


MODULE_PATH = pathlib.Path(__file__).with_name("official_dashboard_publisher.py")
SPEC = importlib.util.spec_from_file_location("official_dashboard_publisher", MODULE_PATH)
publisher = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(publisher)


class DirectTelegramSignalTests(unittest.TestCase):
    def test_urgent_signal_publish_uses_worker_timeout(self):
        calls = []

        def fake_request_json_with_meta(*args, **kwargs):
            calls.append({"args": args, "kwargs": kwargs})
            return {"ok": True}, 200, 1700.0

        args = type(
            "Args",
            (),
            {
                "signal_url": "https://sniperbo.example/dashboard/signal",
                "remote_timeout": 12.0,
            },
        )()
        original = publisher.request_json_with_meta
        publisher.request_json_with_meta = fake_request_json_with_meta
        try:
            body, status_code, upload_ms = publisher.publish_urgent_signal(
                args,
                "token",
                {
                    "rounds": [{"id": 5001, "result": "B"}],
                    "currentSignal": {"status": "pending", "side": "BANKER"},
                },
                "admin@example.com",
                "password",
            )
        finally:
            publisher.request_json_with_meta = original

        self.assertEqual(body, {"ok": True})
        self.assertEqual(status_code, 200)
        self.assertEqual(upload_ms, 1700.0)
        self.assertEqual(calls[0]["kwargs"]["timeout"], publisher.URGENT_SIGNAL_TIMEOUT)
        self.assertGreaterEqual(publisher.URGENT_SIGNAL_TIMEOUT, 8.0)

    def test_direct_telegram_publish_uses_worker_timeout(self):
        calls = []

        def fake_request_json_with_meta(*args, **kwargs):
            calls.append({"args": args, "kwargs": kwargs})
            return {"sent": [{"channelId": "canal-1"}], "blocked": []}, 200, 1600.0

        original = publisher.request_json_with_meta
        publisher.request_json_with_meta = fake_request_json_with_meta
        try:
            ok, status_code, upload_ms, reason = publisher.publish_direct_telegram_signal(
                {"url": "https://engine.example", "secret": "secret"},
                {
                    "moduleKey": "paying_numbers",
                    "signalKey": "publisher:paying:1:BANKER:test",
                    "roundId": 1,
                    "entry": "BANKER",
                    "message": "Entrada confirmada",
                    "variables": {"number": 7},
                },
            )
        finally:
            publisher.request_json_with_meta = original

        self.assertTrue(ok)
        self.assertEqual(status_code, 200)
        self.assertEqual(upload_ms, 1600.0)
        self.assertIn("sent_count=1", reason)
        self.assertEqual(calls[0]["kwargs"]["timeout"], publisher.DIRECT_TELEGRAM_TIMEOUT)
        self.assertGreaterEqual(publisher.DIRECT_TELEGRAM_TIMEOUT[1], 8.0)

    def test_engine_entry_creates_ai_and_validator_signals(self):
        payload = {
            "rounds": [{"id": 1301, "result": "B"}],
            "currentSignal": {"id": "engine-1301", "side": "PLAYER", "status": "pending"},
            "engineDecision": {
                "state": "ENTRADA",
                "reason": "Padrao confirmado",
                "confidence": 88,
            },
        }

        signals = publisher.direct_telegram_signals(payload)
        module_entries = {(item["moduleKey"], item["entry"]) for item in signals}

        self.assertIn(("ai_patterns", "PLAYER"), module_entries)
        self.assertIn(("validator", "PLAYER"), module_entries)

    def test_surf_prediction_status_creates_signal(self):
        payload = {
            "rounds": [{"id": 1302, "result": "P"}],
            "currentSurfAlert": {
                "id": "surf-1302",
                "surf_alert": True,
                "surf_prediction_side": "BANKER",
                "surf_prediction_status": "ACTIVE",
                "surf_prediction_confidence": 74,
            },
        }

        signals = publisher.direct_telegram_signals(payload)
        surf = [item for item in signals if item["moduleKey"] == "surf_alert"]

        self.assertEqual(len(surf), 1)
        self.assertEqual(surf[0]["entry"], "BANKER")

    def test_stale_pending_module_does_not_block_new_round(self):
        pending = [{"moduleKey": "ai_patterns", "roundId": 100, "maxGale": 1}]

        self.assertTrue(publisher.direct_module_has_pending(pending, "ai_patterns", 102))
        self.assertFalse(publisher.direct_module_has_pending(pending, "ai_patterns", 104))

    def test_pattern_family_cooldown_blocks_repeated_ai_and_validator(self):
        cooldowns = {}
        pending = {
            "moduleKey": "ai_patterns",
            "signalKey": "publisher:ai:1103868:BANKER:abc",
            "roundId": 1103868,
            "entry": "BANKER",
            "variables": {"pattern": "B > P > B", "confidence": "100.00%"},
        }
        repeated_ai = {
            **pending,
            "signalKey": "publisher:ai:1103869:BANKER:def",
            "roundId": 1103869,
        }
        repeated_validator = {
            **pending,
            "moduleKey": "validator",
            "signalKey": "publisher:validator:1103869:BANKER:def",
            "roundId": 1103869,
        }
        different_pattern = {
            **pending,
            "signalKey": "publisher:ai:1103869:BANKER:other",
            "roundId": 1103869,
            "variables": {"pattern": "B > B > P", "confidence": "100.00%"},
        }
        paying_number = {
            "moduleKey": "paying_numbers",
            "signalKey": "publisher:paying:1103869:BANKER:7",
            "roundId": 1103869,
            "entry": "BANKER",
            "variables": {"number": 7},
        }

        family_key = publisher.direct_register_signal_family_cooldown(cooldowns, pending, 1103869, 100.0)
        ai_family, ai_cooldown = publisher.direct_signal_family_cooldown(repeated_ai, cooldowns, 101.0)
        validator_family, validator_cooldown = publisher.direct_signal_family_cooldown(
            repeated_validator,
            cooldowns,
            101.0,
        )
        different_family, different_cooldown = publisher.direct_signal_family_cooldown(
            different_pattern,
            cooldowns,
            101.0,
        )
        paying_family, paying_cooldown = publisher.direct_signal_family_cooldown(paying_number, cooldowns, 101.0)

        self.assertEqual(family_key, "pattern:BANKER:b>p>b")
        self.assertEqual(ai_family, family_key)
        self.assertIsNotNone(ai_cooldown)
        self.assertEqual(validator_family, family_key)
        self.assertIsNotNone(validator_cooldown)
        self.assertEqual(different_family, "pattern:BANKER:b>b>p")
        self.assertIsNone(different_cooldown)
        self.assertEqual(paying_family, "")
        self.assertIsNone(paying_cooldown)

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
        self.assertEqual(outcome["label"], "Green")

    def test_result_outcome_confirms_red_and_tie(self):
        red_pending = {
            "moduleKey": "paying_numbers",
            "signalKey": "publisher:paying:2301:BANKER:7",
            "roundId": 2301,
            "entry": "BANKER",
            "maxGale": 1,
        }
        red_outcome = publisher.resolve_direct_telegram_outcome(
            red_pending,
            {
                "rounds": [
                    {"id": 2301, "result": "B"},
                    {"id": 2302, "result": "P"},
                    {"id": 2303, "result": "P"},
                ],
            },
        )
        tie_outcome = publisher.resolve_direct_telegram_outcome(
            {**red_pending, "signalKey": "publisher:paying:2401:BANKER:7", "roundId": 2401},
            {
                "rounds": [
                    {"id": 2401, "result": "B"},
                    {"id": 2402, "result": "T", "bankerScore": 6, "playerScore": 6},
                ],
            },
        )

        self.assertEqual(red_outcome["status"], "RED")
        self.assertEqual(tie_outcome["status"], "TIE")
        self.assertIn("Empate confirmado", publisher.direct_result_message(red_pending, tie_outcome))


if __name__ == "__main__":
    unittest.main()
