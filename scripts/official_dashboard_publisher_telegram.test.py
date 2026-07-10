from official_dashboard_publisher import resolve_direct_telegram_outcome


def test_g1_intermediate_and_final() -> None:
    pending = {
        "signalKey": "publisher:paying:100:PLAYER:number-7",
        "roundId": 100,
        "entry": "PLAYER",
        "maxGale": 1,
    }
    first_loss = {
        "rounds": [
            {"id": 100, "result": "B", "bankerScore": 8, "playerScore": 7},
            {"id": 101, "result": "B", "bankerScore": 9, "playerScore": 5},
        ],
    }
    g1 = resolve_direct_telegram_outcome(pending, first_loss)
    assert g1 is not None
    assert g1["status"] == "G1_ACTIVE"
    assert g1["roundId"] == 101
    assert g1["intermediate"] is True

    already_notified = {**pending, "g1NotifiedRoundId": 101}
    assert resolve_direct_telegram_outcome(already_notified, first_loss) is None

    green_g1 = {
        "rounds": [
            *first_loss["rounds"],
            {"id": 102, "result": "P", "bankerScore": 4, "playerScore": 8},
        ],
    }
    final = resolve_direct_telegram_outcome(already_notified, green_g1)
    assert final is not None
    assert final["status"] == "GREEN"
    assert final["label"] == "Green G1"
    assert final["roundId"] == 102


if __name__ == "__main__":
    test_g1_intermediate_and_final()
    print("official-dashboard-publisher telegram tests passed")
