#!/usr/bin/env python3
"""Publica sinais no sniperbo.com enquanto roda (mantem cards vivos no site)."""
from __future__ import annotations

import json
import os
import random
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw in path.read_text(encoding="utf-8-sig", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def iso_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def publish(url: str, email: str, password: str, payload: dict) -> tuple[int, dict]:
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 SNIPERBO-Official-Publisher/1.0",
        "x-sniper-admin-email": email,
        "x-sniper-admin-password": password,
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = json.loads(resp.read().decode("utf-8", errors="ignore"))
            return resp.status, body if isinstance(body, dict) else {}
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="ignore")
        try:
            body = json.loads(raw)
        except Exception:
            body = {"error": raw[:300]}
        return exc.code, body if isinstance(body, dict) else {"error": raw[:300]}


def build_payload(seq: int, side: str) -> dict:
    now = datetime.now(timezone.utc)
    hhmm = now.strftime("%H:%M")
    results = ["B", "P", "B", "P", "B", "T", "P", "B"]
    rounds = []
    base_id = seq * 10
    for i in range(8):
        rid = base_id + i
        result = results[(seq + i) % len(results)]
        rounds.append(
            {
                "id": rid,
                "result": result,
                "bankerScore": random.randint(3, 12),
                "playerScore": random.randint(3, 12),
                "time": hhmm,
            }
        )
    return {
        "mockMode": False,
        "updatedAt": iso_now(),
        "rounds": rounds,
        "currentSignal": {
            "id": f"live-{seq}-{side.lower()}",
            "side": side,
            "status": "pending",
            "protection": "G1",
            "strength": random.randint(72, 94),
            "label": "Entrada ativa",
        },
        "neuralReading": {
            "mode": "ACTIVE",
            "direcao": side,
            "origem": side,
            "origemTipo": "PAGANTE",
            "paganteStatus": "Entrada confirmada",
            "assertividade": random.randint(70, 92),
        },
        "engineDecision": {
            "state": "ENTRADA",
            "reason": "Sinal ativo publicado.",
            "confidence": random.randint(75, 95),
        },
        "bettingTiming": {
            "phase": "OPEN",
            "remainingSeconds": random.randint(8, 22),
            "roundId": base_id + 7,
            "updatedAt": iso_now(),
        },
    }


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    env_path = root / "scripts" / "official_publisher.local.env"
    env = load_env(env_path)
    email = env.get("SNIPER_ADMIN_EMAIL") or os.getenv("SNIPER_ADMIN_EMAIL", "")
    password = env.get("SNIPER_ADMIN_PASSWORD") or os.getenv("SNIPER_ADMIN_PASSWORD", "")
    publish_url = env.get("SNIPER_REMOTE_PUBLISH_URL") or "https://sniperbo.com/dashboard/publish"
    interval = float(env.get("FORCE_SITE_INTERVAL") or os.getenv("FORCE_SITE_INTERVAL") or "2.5")

    if not email or not password:
        print("Defina SNIPER_ADMIN_EMAIL e SNIPER_ADMIN_PASSWORD em scripts/official_publisher.local.env")
        return 1

    print(f"Publicando sinais em {publish_url} a cada {interval}s (Ctrl+C para parar)")
    seq = 0
    sides = ["BANKER", "PLAYER"]
    while True:
        seq += 1
        side = sides[seq % 2]
        payload = build_payload(seq, side)
        status, body = publish(publish_url, email, password, payload)
        signal = (body.get("dashboard") or {}).get("currentSignal") or payload["currentSignal"]
        ok = body.get("ok") is True and status == 200
        print(
            f"[{seq}] HTTP {status} ok={ok} signal={signal.get('side')} {signal.get('status')} "
            f"strength={signal.get('strength')}",
            flush=True,
        )
        if not ok:
            print(f"  resposta: {json.dumps(body, ensure_ascii=False)[:400]}", flush=True)
        time.sleep(max(1.0, interval))


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nParado.")
        raise SystemExit(0)
