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


if __name__ == "__main__":
    unittest.main()
