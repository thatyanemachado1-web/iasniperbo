#!/usr/bin/env python3
"""Alimenta a API local com rodadas novas (roadmap) para o motor gerar sinais sem coletor."""
from __future__ import annotations

import argparse
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

ROADMAP = list("BPBBTPBBPTBBPBPBBTPBBPTBP")
USER_AGENT = "Mozilla/5.0 SNIPERBO-Official-Publisher/1.0"
TZ = ZoneInfo("America/Sao_Paulo")


def load_env(path: str) -> dict[str, str]:
    out: dict[str, str] = {}
    if not os.path.isfile(path):
        return out
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        out[key.strip()] = value.strip().strip('"').strip("'")
    return out


def request_json(url: str, *, method: str = "GET", body: dict | None = None, headers: dict | None = None, timeout: float = 20.0):
    data = None
    req_headers = {"Accept": "application/json", "User-Agent": USER_AGENT}
    if headers:
        req_headers.update(headers)
    if body is not None:
        data = json.dumps(body, separators=(",", ":")).encode("utf-8")
        req_headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=req_headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
        return json.loads(raw) if raw else {}


def auth_headers(env: dict[str, str]) -> dict[str, str]:
    email = env.get("SNIPER_ADMIN_EMAIL", "")
    password = env.get("SNIPER_ADMIN_PASSWORD", "")
    headers: dict[str, str] = {}
    if email:
        headers["x-sniper-admin-email"] = email
    if password:
        headers["x-sniper-admin-password"] = password
    return headers


def scores_for(result: str) -> tuple[int, int]:
    a, b = random.randint(0, 9), random.randint(0, 9)
    if result == "T":
        v = random.randint(0, 9)
        return v, v
    if result == "B":
        return max(a, b), min(a, b)
    return min(a, b), max(a, b)


def cycle_date() -> str:
    return datetime.now(TZ).strftime("%Y-%m-%d")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_next_round(existing: list[dict], index: int) -> dict:
    result = ROADMAP[index % len(ROADMAP)]
    banker, player = scores_for(result)
    base_id = 0
    for item in existing:
        try:
            base_id = max(base_id, int(item.get("id") or 0))
        except (TypeError, ValueError):
            continue
    round_id = base_id + 1 if base_id else int(time.time() * 1000) % 10_000_000
    stamp = datetime.now(TZ).strftime("%H:%M")
    return {
        "id": round_id,
        "result": result,
        "bankerScore": banker,
        "playerScore": player,
        "tieMultiplier": random.choice([4, 6, 10, 25]) if result == "T" else None,
        "time": stamp,
        "recordedAt": now_iso(),
    }


def pulse_once(local_dashboard_url: str, env: dict[str, str], pulse_index: int) -> dict:
    headers = auth_headers(env)
    dashboard = request_json(local_dashboard_url, headers=headers, timeout=15.0)
    rounds = list(dashboard.get("rounds") or [])
    new_round = build_next_round(rounds, pulse_index)
    rounds = (rounds + [new_round])[-30:]
    payload = {
        **dashboard,
        "mockMode": False,
        "rounds": rounds,
        "updatedAt": now_iso(),
        "cycleDate": cycle_date(),
        "dailyCycleDate": cycle_date(),
    }
    request_json(
        local_dashboard_url,
        method="POST",
        body=payload,
        headers=headers,
        timeout=30.0,
    )
    return request_json(local_dashboard_url, headers=headers, timeout=15.0)


def main() -> int:
    parser = argparse.ArgumentParser(description="Pulse local dashboard with new rounds for signal engine.")
    parser.add_argument("--env-file", default="scripts/official_publisher.local.env")
    parser.add_argument("--local-url", default="http://127.0.0.1:8787/dashboard")
    parser.add_argument("--interval", type=float, default=35.0)
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()

    env = load_env(args.env_file)
    pulse_index = 0
    while True:
        try:
            dashboard = pulse_once(args.local_url, env, pulse_index)
            signal = dashboard.get("currentSignal") or {}
            print(
                f"pulse={pulse_index} rounds={len(dashboard.get('rounds') or [])} "
                f"signal={signal.get('status')} side={signal.get('side')} "
                f"neural={(dashboard.get('neuralReading') or {}).get('mode')}",
                flush=True,
            )
        except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError) as exc:
            print(f"pulse error: {exc}", file=sys.stderr, flush=True)
        pulse_index += 1
        if args.once:
            break
        time.sleep(max(5.0, args.interval))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
