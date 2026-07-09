import importlib.util
import pathlib
import unittest


MODULE_PATH = pathlib.Path(__file__).with_name("official_dashboard_publisher.py")
SPEC = importlib.util.spec_from_file_location("official_dashboard_publisher", MODULE_PATH)
publisher = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(publisher)


class DirectTelegramSignalTests(unittest.TestCase):
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
