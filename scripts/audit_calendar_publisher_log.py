from __future__ import annotations

import collections
import re
import sys
from pathlib import Path


RESULT_RE = re.compile(
    r"^(?P<day>\d{4}-\d{2}-\d{2}) .*?direct telegram result "
    r"(?:sent|skipped|blocked): module=(?P<module>\S+) round=(?P<round>\S+)"
    r".*? outcome=(?P<outcome>.+?)\s*$",
)
URGENT_TIMING_RE = re.compile(
    r"^(?P<day>\d{4}-\d{2}-\d{2}) .*?urgent publish timing: round_id=(?P<round>\S+)",
)
URGENT_RESULT_RE = re.compile(
    r"^(?P<day>\d{4}-\d{2}-\d{2}) .*?Published urgent signal: .*?"
    r"result=(?P<outcome>GREEN|RED|TIE|EMPATE):(?P<attempt>\S+)",
)


def normalize_outcome(value: str) -> str | None:
    normalized = value.strip().lower().replace("_", " ")
    if normalized.startswith("green g1"):
        return "GREEN_G1"
    if normalized.startswith("green"):
        return "GREEN_SG"
    if normalized.startswith("red"):
        return "RED"
    if normalized.startswith(("empate", "tie", "protecao", "proteção")):
        return "EMPATE"
    return None


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: audit_calendar_publisher_log.py LOG_PATH", file=sys.stderr)
        return 2

    path = Path(sys.argv[1])
    events: dict[tuple[str, str, str], str] = {}
    urgent_events: dict[tuple[str, str, str], str] = {}
    ignored = collections.Counter()
    pending_urgent: tuple[str, str] | None = None

    with path.open("r", encoding="utf-8", errors="replace") as handle:
        for line in handle:
            timing_match = URGENT_TIMING_RE.search(line)
            if timing_match:
                pending_urgent = (timing_match.group("day"), timing_match.group("round"))
                continue

            urgent_match = URGENT_RESULT_RE.search(line)
            if urgent_match and pending_urgent and pending_urgent[0] == urgent_match.group("day"):
                day, round_id = pending_urgent
                raw_outcome = urgent_match.group("outcome")
                attempt = urgent_match.group("attempt")
                outcome = normalize_outcome(f"{raw_outcome} {attempt}")
                if outcome:
                    urgent_events[(day, "paying_numbers", round_id)] = outcome
                pending_urgent = None
                continue

            match = RESULT_RE.search(line)
            if not match:
                continue
            outcome = normalize_outcome(match.group("outcome"))
            if not outcome:
                ignored[match.group("outcome").strip()] += 1
                continue
            key = (match.group("day"), match.group("module"), match.group("round"))
            events[key] = outcome

    for key, outcome in urgent_events.items():
        events.setdefault(key, outcome)

    grouped = collections.Counter(
        (day, module, outcome) for (day, module, _round), outcome in events.items()
    )
    for (day, module, outcome), count in sorted(grouped.items()):
        print(f"{day}\t{module}\t{outcome}\t{count}")
    print(f"UNIQUE\t{len(events)}")
    print(f"URGENT_UNIQUE\t{len(urgent_events)}")
    if ignored:
        print(f"IGNORED\t{sum(ignored.values())}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
