from __future__ import annotations

import argparse
import copy
import functools
import json
import logging
import os
import re
import time
from pathlib import Path
from typing import Any

try:
    import truststore
except ImportError:  # pragma: no cover - optional Windows/system CA integration.
    truststore = None  # type: ignore[assignment]
else:
    truststore.inject_into_ssl()

try:
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
except ImportError:  # pragma: no cover - keeps the local publisher alive if requests is absent.
    requests = None  # type: ignore[assignment]
    HTTPAdapter = None  # type: ignore[assignment]
    Retry = None  # type: ignore[assignment]
    from urllib.error import HTTPError, URLError
    from urllib.request import Request, urlopen
else:
    HTTPError = requests.HTTPError
    URLError = requests.RequestException


USER_AGENT = "Mozilla/5.0 SNIPERBO-Official-Publisher/1.0"
POST_TIMEOUT = (3.0, 5.0)
UPLOAD_WARNING_MS = 2000.0
DIRECT_TELEGRAM_TARGET_MS = 300.0
DIRECT_TELEGRAM_RESULT_TO_ENTRY_DELAY_SECONDS = 1.2
DIRECT_TELEGRAM_HANDLED_BLOCK_REASONS = {
    "duplicate_signal",
    "entry_not_allowed",
    "module_inactive",
    "channel_inactive",
    "duplicate_chat_id",
}
PATTERN_MINER_HISTORY_LIMIT = 15000
PATTERN_MINER_MIN_OCCURRENCES = 3
PATTERN_MINER_MIN_VALIDATED = 2
PATTERN_MINER_LENGTHS = (3, 4, 5)
PATTERN_MINER_TOP_SCAN = 150
PATTERN_MINER_TOP_STRATEGIES_LIMIT = 30
PATTERN_MINER_BANK_SAVE_INTERVAL = 15.0
PENDING_ENTRY_STATUSES = {
    "pending",
    "g1",
    "awaiting_sg",
    "awaiting_g1",
    "aguardando_resultado",
    "aguardando_g1",
}
TERMINAL_ENTRY_STATUSES = {
    "green",
    "green_g1",
    "red",
    "tie",
    "expired",
    "expirada",
    "g1_green",
    "g1_red",
    "green_sg",
    "red_sg",
}


def create_session() -> requests.Session:
    if requests is None or HTTPAdapter is None or Retry is None:
        return None  # type: ignore[return-value]
    session = requests.Session()
    retry = Retry(
        total=2,
        connect=2,
        read=0,
        status=2,
        backoff_factor=0.3,
        status_forcelist=[502, 503, 504],
        allowed_methods=frozenset(["GET", "POST"]),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(pool_connections=10, pool_maxsize=10, max_retries=retry)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


SESSION = create_session()
PROCESS_LOCK_HANDLE: Any = None


def acquire_process_lock(args: argparse.Namespace) -> bool:
    global PROCESS_LOCK_HANDLE
    try:
        import fcntl  # type: ignore[import-not-found]
    except ImportError:
        return True
    lock_name = re.sub(r"[^A-Za-z0-9_.-]+", "_", f"{args.remote_url}_{args.log_file}")[-180:]
    lock_path = Path("/tmp") / f"sniperbo_publisher_{lock_name}.lock"
    handle = lock_path.open("w", encoding="utf-8")
    try:
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        print(f"Publisher already running for {args.remote_url} ({args.log_file}).")
        handle.close()
        return False
    handle.seek(0)
    handle.truncate()
    handle.write(f"pid={os.getpid()} remote_url={args.remote_url} log_file={args.log_file}\n")
    handle.flush()
    PROCESS_LOCK_HANDLE = handle
    return True


def http_error_summary(exc: BaseException) -> tuple[int, str]:
    if requests is not None and hasattr(exc, "response"):
        response = getattr(exc, "response", None)
        status_code = response.status_code if response is not None else 0
        body = response.text[:180] if response is not None else str(exc)[:180]
        return int(status_code or 0), body
    status_code = getattr(exc, "code", 0)
    if hasattr(exc, "read"):
        try:
            body = exc.read().decode("utf-8", errors="replace")[:180]
        except Exception:
            body = str(exc)[:180]
    else:
        body = str(exc)[:180]
    return int(status_code or 0), body


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def env_value(env: dict[str, str], name: str, default: str = "") -> str:
    return os.getenv(name) or env.get(name, default)


def unique_tokens(*values: str) -> list[str]:
    tokens: list[str] = []
    for value in values:
        token = str(value or "").strip()
        if token and token not in tokens:
            tokens.append(token)
    return tokens


def iso_now_ms() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime()) + f".{int((time.time() % 1) * 1000):03d}"


def read_entry_status(entry: Any) -> str:
    if not isinstance(entry, dict):
        return ""
    return str(entry.get("status") or entry.get("state") or entry.get("resultado") or "").strip().casefold()


def is_pending_entry(entry: Any) -> bool:
    return read_entry_status(entry) in PENDING_ENTRY_STATUSES


def is_terminal_entry(entry: Any) -> bool:
    return read_entry_status(entry) in TERMINAL_ENTRY_STATUSES


def entry_identity(entry: Any) -> str:
    if not isinstance(entry, dict):
        return ""
    for key in ("id", "key", "triggerRoundKey", "round_id", "roundId"):
        value = str(entry.get(key) or "").strip()
        if value:
            return f"{key}:{value}"
    side = str(entry.get("side") or entry.get("expectedSide") or entry.get("entry") or "").strip()
    status = read_entry_status(entry)
    return f"{side}:{status}" if side or status else ""


def extract_round_id(payload: dict[str, Any]) -> str:
    rounds = payload.get("rounds") if isinstance(payload.get("rounds"), list) else []
    last_round = rounds[-1] if rounds and isinstance(rounds[-1], dict) else {}
    return str(
        last_round.get("id")
        or last_round.get("round_id")
        or last_round.get("roundId")
        or last_round.get("numero")
        or payload.get("updatedAt")
        or "",
    )


def pattern_entry_alerts(payload: dict[str, Any]) -> list[Any]:
    pattern = payload.get("patternMinerSnapshot") or payload.get("patternMiner")
    if not isinstance(pattern, dict):
        return []
    alerts = pattern.get("entryAlerts")
    return alerts if isinstance(alerts, list) else []


LATE_ENTRY_WINDOW_SECONDS = 2.0


def suppress_late_open_entries(payload: dict[str, Any]) -> dict[str, Any]:
    timing = payload.get("bettingTiming") if isinstance(payload.get("bettingTiming"), dict) else {}
    phase = str(timing.get("phase") or "").strip().casefold()
    try:
        remaining = float(timing.get("remainingSeconds"))
    except (TypeError, ValueError):
        return payload
    if phase != "open" or remaining > LATE_ENTRY_WINDOW_SECONDS:
        return payload

    guarded = copy.deepcopy(payload)
    changed_fields: list[str] = []
    for field in ("entrada_atual", "currentSignal", "neuralEntryState"):
        entry = guarded.get(field)
        if not isinstance(entry, dict):
            continue
        status = read_entry_status(entry)
        if status not in PENDING_ENTRY_STATUSES and status != "tie_watch":
            continue
        if is_terminal_entry(entry):
            continue
        if field == "currentSignal":
            guarded[field] = {
                **entry,
                "status": "waiting",
                "side": "NONE",
                "lateSuppressed": True,
                "lateReason": f"Janela com {remaining:.1f}s restantes",
            }
        else:
            guarded[field] = {
                **entry,
                "status": "waiting",
                "lateSuppressed": True,
                "lateReason": f"Janela com {remaining:.1f}s restantes",
            }
        changed_fields.append(field)

    if changed_fields:
        logging.warning(
            "entrada/tie_watch suprimido por janela tardia: remaining=%.1fs fields=%s round=%s",
            remaining,
            ",".join(changed_fields),
            extract_round_id(payload),
        )
    return guarded


def apply_g1_publication_lock(
    payload: dict[str, Any],
    last_published: dict[str, Any] | None,
) -> tuple[dict[str, Any], bool, str]:
    if not isinstance(last_published, dict):
        return payload, False, ""

    guarded = copy.deepcopy(payload)
    blocked_fields: list[str] = []
    entry_fields = ("entrada_atual", "currentSignal", "neuralEntryState")

    if any(is_terminal_entry(guarded.get(field)) for field in entry_fields):
        return guarded, False, ""

    for field in entry_fields:
        previous = last_published.get(field)
        incoming = guarded.get(field)
        if not is_pending_entry(previous) or not isinstance(incoming, dict):
            continue
        if is_terminal_entry(incoming):
            continue
        previous_identity = entry_identity(previous)
        incoming_identity = entry_identity(incoming)
        if incoming_identity and previous_identity and incoming_identity == previous_identity:
            continue
        guarded[field] = copy.deepcopy(previous)
        blocked_fields.append(field)

    if not blocked_fields:
        return guarded, False, ""

    previous_signal = last_published.get("currentSignal") if isinstance(last_published.get("currentSignal"), dict) else {}
    previous_neural = last_published.get("neuralEntryState") if isinstance(last_published.get("neuralEntryState"), dict) else {}
    round_hint = (
        str(previous_signal.get("id") or "")
        or str(previous_neural.get("triggerRoundKey") or "")
        or extract_round_id(last_published)
    )
    return guarded, True, round_hint


def log_publish_timing(
    kind: str,
    payload: dict[str, Any],
    t0_iso: str,
    prep_ms: float,
    upload_ms: float,
    status_code: int,
) -> None:
    round_id = extract_round_id(payload)
    log_fn = logging.warning if upload_ms > UPLOAD_WARNING_MS else logging.info
    log_fn(
        "%s publish timing: round_id=%s t0=%s prep_ms=%.0f upload_ms=%.0f status_code=%s",
        kind,
        round_id,
        t0_iso,
        prep_ms,
        upload_ms,
        status_code,
    )


def request_json(
    url: str,
    *,
    method: str = "GET",
    token: str = "",
    extra_headers: dict[str, str] | None = None,
    payload: Any | None = None,
    timeout: float | tuple[float, float] = 8.0,
    verify_ssl: bool = True,
) -> Any:
    body, _, _ = request_json_with_meta(
        url,
        method=method,
        token=token,
        extra_headers=extra_headers,
        payload=payload,
        timeout=timeout,
        verify_ssl=verify_ssl,
    )
    return body


def request_json_with_meta(
    url: str,
    *,
    method: str = "GET",
    token: str = "",
    extra_headers: dict[str, str] | None = None,
    payload: Any | None = None,
    timeout: float | tuple[float, float] = 8.0,
    verify_ssl: bool = True,
) -> tuple[Any, int, float]:
    method_upper = method.upper()
    if method_upper == "POST":
        if isinstance(timeout, tuple):
            request_timeout = timeout
        else:
            request_timeout = (min(POST_TIMEOUT[0], float(timeout)), float(timeout))
    else:
        request_timeout = timeout
    headers = {
        "Accept": "application/json",
        "Cache-Control": "no-store",
        "Connection": "keep-alive",
        "User-Agent": USER_AGENT,
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if extra_headers:
        headers.update({key: value for key, value in extra_headers.items() if value})
    if method_upper == "POST" or payload is not None:
        headers["Content-Type"] = "application/json"

    started = time.perf_counter()
    if SESSION is None:
        data = json.dumps(payload, separators=(",", ":")).encode("utf-8") if payload is not None else None
        request = Request(url, data=data, headers=headers, method=method_upper)
        urllib_timeout = request_timeout[1] if isinstance(request_timeout, tuple) else request_timeout
        with urlopen(request, timeout=urllib_timeout) as response:
            body = response.read().decode("utf-8", errors="replace")
            elapsed_ms = (time.perf_counter() - started) * 1000.0
            return (json.loads(body) if body else {}, response.status, elapsed_ms)

    response = SESSION.request(
        method_upper,
        url,
        headers=headers,
        json=payload if payload is not None else None,
        timeout=request_timeout,
        verify=verify_ssl,
    )
    elapsed_ms = (time.perf_counter() - started) * 1000.0
    response.raise_for_status()
    body = response.text
    return (json.loads(body) if body else {}, response.status_code, elapsed_ms)


def admin_login(remote_base_url: str, email: str, password: str, timeout: float) -> str:
    response = request_json(
        f"{remote_base_url.rstrip('/')}/admin/login",
        method="POST",
        payload={"email": email, "password": password},
        timeout=timeout,
    )
    token = str(response.get("token") or "")
    if not token:
        raise RuntimeError("admin login did not return a token")
    return token


def read_local_dashboard(
    args: argparse.Namespace,
    local_token: str,
    admin_email: str = "",
    admin_password: str = "",
    publisher_token: str = "",
) -> dict[str, Any]:
    headers = {
        "x-sniper-admin-email": admin_email,
        "x-sniper-admin-password": admin_password,
    }
    if publisher_token:
        headers["x-sniper-publisher-token"] = publisher_token
    payload = request_json(
        args.local_url,
        token=local_token,
        extra_headers=headers,
        timeout=args.local_timeout,
    )
    return payload if isinstance(payload, dict) else {}


def publish_payload(
    args: argparse.Namespace,
    token: str,
    local_payload: dict[str, Any],
    admin_email: str,
    admin_password: str,
) -> tuple[dict[str, Any], int, float]:
    publisher_headers = {
        "x-sniper-admin-email": admin_email,
        "x-sniper-admin-password": admin_password,
    }
    if token:
        publisher_headers["x-sniper-publisher-token"] = token
    body, status_code, upload_ms = request_json_with_meta(
        args.remote_url,
        method="POST",
        token=token,
        extra_headers=publisher_headers,
        payload=local_payload,
        timeout=float(args.remote_timeout),
    )
    return (body if isinstance(body, dict) else {}, status_code, upload_ms)


def dashboard_signal_fingerprint(payload: dict[str, Any]) -> str:
    signal = payload.get("currentSignal") if isinstance(payload.get("currentSignal"), dict) else {}
    neural_result = payload.get("neuralEntryLastResult") if isinstance(payload.get("neuralEntryLastResult"), dict) else {}
    neural_state = payload.get("neuralEntryState") if isinstance(payload.get("neuralEntryState"), dict) else {}
    neural_reading = payload.get("neuralReading") if isinstance(payload.get("neuralReading"), dict) else {}
    surf = payload.get("currentSurfAlert") if isinstance(payload.get("currentSurfAlert"), dict) else {}
    tie = payload.get("currentTieAlert") if isinstance(payload.get("currentTieAlert"), dict) else {}
    pattern = payload.get("patternMinerSnapshot") or payload.get("patternMiner")
    pattern_alerts = pattern.get("entryAlerts") if isinstance(pattern, dict) else []
    first_pattern = pattern_alerts[0] if pattern_alerts and isinstance(pattern_alerts[0], dict) else {}
    pattern_strategy = first_pattern.get("strategy") if isinstance(first_pattern.get("strategy"), dict) else {}
    rounds = payload.get("rounds") if isinstance(payload.get("rounds"), list) else []
    last_round = rounds[-1] if rounds and isinstance(rounds[-1], dict) else {}
    signal_status = signal.get("status")
    compact = {
        "roundId": last_round.get("id"),
        "roundResult": last_round.get("result") or last_round.get("resultado"),
        "signalStatus": signal_status,
        "signalSide": signal.get("side"),
        "neuralResultId": neural_result.get("id"),
        "neuralStateId": neural_state.get("id") or neural_state.get("triggerRoundKey"),
        "neuralMode": neural_reading.get("mode"),
        "neuralSide": neural_reading.get("direcao") or neural_reading.get("origem"),
        "surfAlert": surf.get("surf_alert"),
        "surfSide": surf.get("surf_side") or surf.get("surf_prediction_side"),
        "tieStatus": tie.get("status"),
        "tieLevel": tie.get("level"),
        "patternStatus": pattern_strategy.get("status"),
        "patternSide": pattern_strategy.get("next_side") or pattern_strategy.get("expectedResult"),
        "patternRoundId": pattern_strategy.get("round_id"),
    }
    return json.dumps(compact, sort_keys=True, separators=(",", ":"))


def urgent_signal_min_interval(payload: dict[str, Any], args: argparse.Namespace) -> float:
    signal = payload.get("currentSignal") if isinstance(payload.get("currentSignal"), dict) else {}
    neural_result = payload.get("neuralEntryLastResult") if isinstance(payload.get("neuralEntryLastResult"), dict) else {}
    neural_reading = payload.get("neuralReading") if isinstance(payload.get("neuralReading"), dict) else {}
    status = str(signal.get("status") or "").strip().casefold()
    priority_statuses = {"pending", "g1", "green", "green_g1", "red", "active", "tie_watch"}
    surf = payload.get("currentSurfAlert") if isinstance(payload.get("currentSurfAlert"), dict) else {}
    tie = payload.get("currentTieAlert") if isinstance(payload.get("currentTieAlert"), dict) else {}
    pattern = payload.get("patternMinerSnapshot") or payload.get("patternMiner")
    pattern_alerts = pattern.get("entryAlerts") if isinstance(pattern, dict) else []
    has_module_signal = (
        bool(surf.get("surf_alert"))
        or str(tie.get("status") or "").strip().casefold() == "active"
        or bool(pattern_alerts)
        or str(neural_reading.get("mode") or "").strip().casefold() in {"active", "ativo", "valido", "valid"}
    )
    if status in priority_statuses or neural_result.get("id") or has_module_signal:
        return max(0.15, float(args.urgent_retry_interval))
    return max(0.35, float(args.non_entry_urgent_interval))


def build_urgent_signal_payload(payload: dict[str, Any]) -> dict[str, Any]:
    keys = (
        "updatedAt",
        "cycleDate",
        "dailyCycleDate",
        "currentSignal",
        "neuralReading",
        "neuralScoreboard",
        "neuralEntryState",
        "neuralEntryLastResult",
        "bettingTiming",
        "engineDecision",
        "currentSurfAlert",
        "currentTieAlert",
        "patternMinerSnapshot",
        "patternMiner",
        "mainScoreboard",
        "surfAnalyzerScoreboard",
        "tieAlertScoreboard",
        "entryMode",
    )
    urgent_payload = {key: payload[key] for key in keys if key in payload}
    rounds = payload.get("rounds")
    if isinstance(rounds, list) and rounds:
        urgent_payload["rounds"] = rounds[-8:]
    return urgent_payload


def publish_urgent_signal(
    args: argparse.Namespace,
    token: str,
    local_payload: dict[str, Any],
    admin_email: str,
    admin_password: str,
) -> tuple[dict[str, Any], int, float]:
    publisher_headers = {
        "x-sniper-admin-email": admin_email,
        "x-sniper-admin-password": admin_password,
    }
    if token:
        publisher_headers["x-sniper-publisher-token"] = token
    body, status_code, upload_ms = request_json_with_meta(
        args.signal_url,
        method="POST",
        token=token,
        extra_headers=publisher_headers,
        payload=build_urgent_signal_payload(local_payload),
        timeout=min(args.remote_timeout, 1.2),
    )
    return (body if isinstance(body, dict) else {}, status_code, upload_ms)


def direct_telegram_entry(value: Any) -> str:
    text = str(value or "").strip().upper()
    if text in {"B", "BANKER"} or "BANKER" in text:
        return "BANKER"
    if text in {"P", "PLAYER"} or "PLAYER" in text:
        return "PLAYER"
    if text in {"T", "TIE", "EMPATE"} or "TIE" in text or "EMPATE" in text:
        return "TIE"
    return ""


def direct_confirmed_entry_status(value: Any) -> bool:
    text = str(value or "").strip().casefold().replace("_", " ")
    return (
        "entrada confirmada" in text
        or "confirmad" in text
        or "active" in text
        or "ativo" in text
        or "validado" in text
    )


def direct_visual_paying_entry(reading: dict[str, Any]) -> str:
    if not isinstance(reading, dict):
        return ""
    entry = direct_telegram_entry(reading.get("direcao") or reading.get("origem"))
    if not entry:
        return ""
    mode = str(reading.get("mode") or "").strip().upper()
    status = reading.get("paganteStatus") or reading.get("paganteAlert") or ""
    if mode == "ACTIVE" or direct_confirmed_entry_status(status):
        return entry
    return ""


def direct_visual_paying_status(reading: dict[str, Any]) -> str:
    if not isinstance(reading, dict):
        return ""
    status = str(reading.get("paganteStatus") or reading.get("paganteAlert") or "").strip().casefold()
    if status:
        return status
    if str(reading.get("mode") or "").strip().upper() == "ACTIVE":
        return "active"
    return ""


def direct_telegram_entry_label(entry: str) -> str:
    if entry == "BANKER":
        return "🔴 BANKER"
    if entry == "PLAYER":
        return "🔵 PLAYER"
    if entry == "TIE":
        return "🟡 TIE"
    return "Automatico"


def direct_telegram_score_label(entry: str, number: Any) -> str:
    text = str(number or "").strip()
    if not text or text == "--":
        return "--"
    digits = re.sub(r"\D+", "", text)
    if not digits:
        return decorate_direct_telegram_message(text)
    if entry == "BANKER":
        return f"🔴 B{digits}"
    if entry == "PLAYER":
        return f"🔵 P{digits}"
    if entry == "TIE":
        return f"🟡 T{digits}"
    return decorate_direct_telegram_message(text)


def decorate_direct_telegram_message(message: str) -> str:
    text = str(message or "")
    text = re.sub(r"\bB\s+Banker\b", direct_telegram_entry_label("BANKER"), text, flags=re.IGNORECASE)
    text = re.sub(r"\bP\s+Player\b", direct_telegram_entry_label("PLAYER"), text, flags=re.IGNORECASE)
    text = re.sub(r"\bT\s+Tie\b", direct_telegram_entry_label("TIE"), text, flags=re.IGNORECASE)

    def replace_score(match: re.Match[str]) -> str:
        prefix = match.group(1) or ""
        side = (match.group(2) or "").upper()
        number = match.group(3) or ""
        if any(icon in prefix for icon in ("🔴", "🔵", "🟡")):
            return match.group(0)
        if side == "B":
            return f"{prefix}🔴 B{number}"
        if side == "P":
            return f"{prefix}🔵 P{number}"
        if side == "T":
            return f"{prefix}🟡 T{number}"
        return match.group(0)

    return re.sub(r"(^|[^\w🔴🔵🟡])([BPT])\s*([2-9]|1[0-2])\b", replace_score, text, flags=re.IGNORECASE)


def direct_round_id(payload: dict[str, Any]) -> int:
    raw = extract_round_id(payload)
    try:
        return int(float(raw))
    except (TypeError, ValueError):
        return int(time.time() * 1000)


def direct_signal_status(*values: Any) -> str:
    for value in values:
        status = read_entry_status(value)
        if status:
            return status
        if isinstance(value, dict):
            raw = str(value.get("paganteStatus") or value.get("status") or value.get("phase") or "").strip().casefold()
            if raw:
                return raw
    return ""


def direct_engine_state(value: Any) -> str:
    if not isinstance(value, dict):
        return ""
    return str(value.get("state") or value.get("status") or "").strip().upper()


def direct_status_is_open(status: str) -> bool:
    if direct_confirmed_entry_status(status):
        return True
    return status in PENDING_ENTRY_STATUSES or status in {
        "active",
        "confirmado",
        "confirmed",
        "entrada_ativa",
        "tie_watch",
    }


def direct_float(value: Any) -> float:
    text = str(value or "0").strip().replace("%", "").replace(",", ".")
    try:
        return float(text)
    except (TypeError, ValueError):
        return 0.0


def build_direct_telegram_message(module_key: str, entry: str, variables: dict[str, Any]) -> str:
    entry_label = direct_telegram_entry_label(entry)
    if module_key == "ai_patterns":
        pattern = str(variables.get("pattern") or "Padrao IA confirmado").strip()
        confidence = str(variables.get("confidence") or variables.get("percentage") or "--").strip()
        return "\n".join([
            "🤖 <b>PADRÃO IA CONFIRMADO</b>",
            "",
            f"🎲 <b>Mesa:</b> {variables.get('table') or 'Bac Bo'}",
            f"🧩 <b>Padrão:</b> {pattern}",
            f"🎯 <b>Entrada:</b> {entry_label}",
            "🛡️ <b>Proteção:</b> G1",
            f"📊 <b>Assertividade:</b> {confidence}",
        ])
    if module_key == "paying_numbers":
        title = "💎 <b>NÚMERO PAGANTE CONFIRMADO</b>"
        number = direct_telegram_score_label(entry, variables.get("number") or "--")
        status = str(variables.get("status") or "CONFIRMADO")
        return "\n".join([
            title,
            "",
            f"🔢 <b>Número:</b> {number}",
            f"🎯 <b>Entrada:</b> {entry_label}",
            "🛡️ <b>Proteção:</b> G1",
            f"📌 <b>Status:</b> {status}",
        ])
    if module_key == "surf_alert":
        return "\n".join([
            "🌊 <b>AVISO DE SURF CONFIRMADO</b>",
            "",
            f"🎯 <b>Entrada:</b> {entry_label}",
            "🛡️ <b>Proteção:</b> G1",
            f"📊 <b>Risco:</b> {variables.get('risk') or '--'}",
        ])
    if module_key == "ties_only":
        return "\n".join([
            "🟡 <b>POSSÍVEL EMPATE</b>",
            "",
            f"🎯 <b>Entrada:</b> {entry_label}",
            "🛡️ <b>Cobertura:</b> até G4",
            f"📊 <b>Nível:</b> {variables.get('level') or 'Ativo'}",
        ])
    return "\n".join([
        "🎯 <b>ENTRADA CONFIRMADA</b>",
        "",
        f"🎲 <b>Mesa:</b> {variables.get('table') or 'Bac Bo'}",
        f"🎯 <b>Entrada:</b> {entry_label}",
        "🛡️ <b>Proteção:</b> G1",
    ])


def direct_pattern_text_from_decision(decision: dict[str, Any], signal: dict[str, Any]) -> str:
    reason = str(decision.get("reason") or "").strip()
    debug = str(decision.get("debug") or "").strip()
    signal_id = str(signal.get("id") or signal.get("key") or "").strip()
    if reason:
        return reason[:180]
    if debug:
        return debug[:180]
    if signal_id:
        return signal_id[:180]
    return "Padrao IA confirmado"


DIRECT_PATTERN_MINER_CACHE_KEY = ""
DIRECT_PATTERN_MINER_CACHE_ALERTS: list[dict[str, Any]] = []
DIRECT_PATTERN_MINER_SNAPSHOT_CACHE_KEY = ""
DIRECT_PATTERN_MINER_SNAPSHOT_CACHE: dict[str, Any] | None = None


def direct_pattern_bank_path(args: argparse.Namespace, env: dict[str, str]) -> Path:
    configured = env_value(env, "DIRECT_PATTERN_MINER_BANK_PATH")
    if configured:
        return Path(configured)
    if getattr(args, "log_file", ""):
        return Path(args.log_file).with_name("pattern_miner_round_bank.json")
    return Path("pattern_miner_round_bank.json")


def load_direct_pattern_round_bank(path: Path) -> list[dict[str, Any]]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    if not isinstance(data, list):
        return []
    rounds = [direct_normalize_pattern_round(item) for item in data if isinstance(item, dict)]
    return [item for item in rounds if item][-PATTERN_MINER_HISTORY_LIMIT:]


def save_direct_pattern_round_bank(path: Path, bank: list[dict[str, Any]]) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(bank[-PATTERN_MINER_HISTORY_LIMIT:], ensure_ascii=False), encoding="utf-8")
    except OSError as exc:
        logging.warning("pattern miner bank save failed: %s", exc)


def direct_normalize_pattern_round(round_item: Any) -> dict[str, Any] | None:
    if not isinstance(round_item, dict):
        return None
    side = direct_round_side(round_item)
    result = {"BANKER": "B", "PLAYER": "P", "TIE": "T"}.get(side, side)
    if result not in {"B", "P", "T"}:
        return None
    banker_score = direct_int(round_item.get("bankerScore") or round_item.get("banker_score") or round_item.get("banker"))
    player_score = direct_int(round_item.get("playerScore") or round_item.get("player_score") or round_item.get("player"))
    tie_multiplier = direct_int(round_item.get("tieMultiplier") or round_item.get("tie_multiplier") or round_item.get("multiplier"))
    return {
        "id": round_item.get("id") or round_item.get("round_id") or round_item.get("roundId") or round_item.get("numero"),
        "result": result,
        "bankerScore": banker_score,
        "playerScore": player_score,
        "tieMultiplier": tie_multiplier,
        "time": str(round_item.get("time") or round_item.get("created_at") or round_item.get("createdAt") or "").strip(),
    }


def direct_int(value: Any) -> int:
    try:
        return int(float(str(value).strip().replace(",", ".")))
    except (TypeError, ValueError):
        return 0


def direct_pattern_round_key(round_item: dict[str, Any]) -> str:
    raw_id = str(round_item.get("id") or "").strip()
    if raw_id:
        return f"id:{raw_id}"
    return ":".join([
        str(round_item.get("result") or ""),
        str(round_item.get("bankerScore") or 0),
        str(round_item.get("playerScore") or 0),
        str(round_item.get("time") or ""),
    ])


def update_direct_pattern_round_bank(bank: list[dict[str, Any]], payload: dict[str, Any]) -> list[dict[str, Any]]:
    payload_rounds = payload.get("rounds") if isinstance(payload.get("rounds"), list) else []
    incoming = [direct_normalize_pattern_round(item) for item in payload_rounds]
    incoming = [item for item in incoming if item]
    if not incoming:
        return bank[-PATTERN_MINER_HISTORY_LIMIT:]

    merged: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for item in [*bank, *incoming]:
        key = direct_pattern_round_key(item)
        if not key:
            continue
        if key not in merged:
            order.append(key)
        merged[key] = item
    return [merged[key] for key in order if key in merged][-PATTERN_MINER_HISTORY_LIMIT:]


def direct_payload_pattern_rounds(payload: dict[str, Any]) -> list[dict[str, Any]]:
    payload_rounds = payload.get("rounds") if isinstance(payload.get("rounds"), list) else []
    incoming = [direct_normalize_pattern_round(item) for item in payload_rounds]
    return [item for item in incoming if item]


def direct_ai_patterns_from_round_bank(rounds: list[dict[str, Any]], round_id: int) -> list[dict[str, Any]]:
    if len(rounds) < max(PATTERN_MINER_LENGTHS) + 2:
        return []
    alerts = direct_pattern_miner_entry_alerts(rounds)
    if not alerts:
        return []
    alert = None
    for candidate in alerts:
        strategy = candidate.get("strategy") if isinstance(candidate.get("strategy"), dict) else {}
        if direct_ai_pattern_entry_allowed(direct_telegram_entry(strategy.get("expectedResult"))):
            alert = candidate
            break
    if not alert:
        return []
    strategy = alert.get("strategy") if isinstance(alert.get("strategy"), dict) else {}
    entry = direct_telegram_entry(strategy.get("expectedResult"))
    if not direct_ai_pattern_entry_allowed(entry):
        return []
    sequence = strategy.get("sequence") if isinstance(strategy.get("sequence"), list) else []
    pattern = " > ".join(str(item) for item in sequence if item) or "Padrao IA confirmado"
    confidence = direct_float(strategy.get("assertiveness"))
    variables = {
        "table": "Bac Bo",
        "pattern": pattern,
        "confidence": f"{confidence:.2f}%" if confidence else "--",
        "status": str(strategy.get("status") or "VALIDADO"),
    }
    return [{
        "moduleKey": "ai_patterns",
        "signalKey": f"publisher:ai-miner:{round_id}:{entry}:{strategy.get('id') or pattern}",
        "roundId": round_id,
        "entry": entry,
        "variables": variables,
        "message": build_direct_telegram_message("ai_patterns", entry, variables),
    }]


def direct_pattern_miner_entry_alerts(rounds: list[dict[str, Any]]) -> list[dict[str, Any]]:
    global DIRECT_PATTERN_MINER_CACHE_KEY, DIRECT_PATTERN_MINER_CACHE_ALERTS
    last_key = direct_pattern_round_key(rounds[-1]) if rounds else ""
    cache_key = f"{len(rounds)}:{last_key}"
    if cache_key == DIRECT_PATTERN_MINER_CACHE_KEY:
        return DIRECT_PATTERN_MINER_CACHE_ALERTS

    strategies = direct_pattern_miner_rank_strategies(rounds)
    alerts = [
        alert
        for alert in direct_pattern_miner_realtime_alerts(rounds, strategies)
        if alert.get("kind") == "validated"
    ]
    DIRECT_PATTERN_MINER_CACHE_KEY = cache_key
    DIRECT_PATTERN_MINER_CACHE_ALERTS = alerts[:40]
    return DIRECT_PATTERN_MINER_CACHE_ALERTS


def attach_direct_pattern_miner_snapshot(
    payload: dict[str, Any],
    pattern_round_bank: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    payload_rounds = direct_payload_pattern_rounds(payload)
    if not payload_rounds:
        return payload
    payload_last_key = direct_pattern_round_key(payload_rounds[-1])
    bank_rounds = pattern_round_bank if isinstance(pattern_round_bank, list) else []
    bank_last_key = direct_pattern_round_key(bank_rounds[-1]) if bank_rounds else ""
    rounds = bank_rounds if bank_rounds and bank_last_key == payload_last_key else payload_rounds
    next_payload = dict(payload)
    next_payload["patternMinerSnapshot"] = direct_pattern_miner_snapshot(rounds)
    return next_payload


def direct_pattern_miner_snapshot(rounds: list[dict[str, Any]]) -> dict[str, Any]:
    global DIRECT_PATTERN_MINER_SNAPSHOT_CACHE_KEY, DIRECT_PATTERN_MINER_SNAPSHOT_CACHE
    last_key = direct_pattern_round_key(rounds[-1]) if rounds else ""
    cache_key = f"{len(rounds)}:{last_key}"
    if cache_key == DIRECT_PATTERN_MINER_SNAPSHOT_CACHE_KEY and DIRECT_PATTERN_MINER_SNAPSHOT_CACHE:
        return DIRECT_PATTERN_MINER_SNAPSHOT_CACHE
    updated_at = iso_now_ms()
    full_ranking = [
        direct_pattern_strategy_snapshot(strategy, updated_at)
        for strategy in direct_pattern_miner_rank_strategies(rounds)
    ]
    strict_hot = [
        strategy for strategy in full_ranking
        if strategy.get("status") in {"VERY_HOT", "HOT"}
    ]
    if len(strict_hot) >= 20:
        hot_strategies = strict_hot[:PATTERN_MINER_TOP_STRATEGIES_LIMIT]
    else:
        hot_strategies = [
            strategy for strategy in full_ranking
            if not strategy.get("insufficientSample")
        ][:PATTERN_MINER_TOP_STRATEGIES_LIMIT]
    alerts = direct_pattern_miner_realtime_alerts(rounds, full_ranking)
    valid_strategies = [strategy for strategy in full_ranking if not strategy.get("insufficientSample")]
    ranking = full_ranking[:PATTERN_MINER_TOP_SCAN]
    total_validated = sum(int(strategy.get("totalValidated") or 0) for strategy in valid_strategies)
    sg = sum(int(strategy.get("sg") or 0) for strategy in valid_strategies)
    g1 = sum(int(strategy.get("g1") or 0) for strategy in valid_strategies)
    scoreboard = {
        "sg": sg,
        "g1": g1,
        "red": sum(int(strategy.get("red") or 0) for strategy in valid_strategies),
        "tie": sum(int(strategy.get("tie") or 0) for strategy in valid_strategies),
        "totalValidated": total_validated,
        "sequencePositive": max([int(strategy.get("sequencePositive") or 0) for strategy in valid_strategies] or [0]),
        "sequenceNegative": max([int(strategy.get("sequenceNegative") or 0) for strategy in valid_strategies] or [0]),
        "maxSequencePositive": max([int(strategy.get("maxSequencePositive") or 0) for strategy in valid_strategies] or [0]),
        "maxSequenceNegative": max([int(strategy.get("maxSequenceNegative") or 0) for strategy in valid_strategies] or [0]),
    }
    if total_validated:
        scoreboard["assertiveness"] = ((sg + g1) / total_validated) * 100
    snapshot = {
        "strategies": ranking,
        "ranking": ranking,
        "hotStrategies": hot_strategies,
        "formingAlerts": [alert for alert in alerts if alert.get("kind") == "forming"],
        "entryAlerts": [alert for alert in alerts if alert.get("kind") == "validated"],
        "scoreboard": scoreboard,
        "agent": {
            "catalogedStrategies": len(full_ranking),
            "hotStrategies": len(hot_strategies),
            "observedStrategies": len([strategy for strategy in full_ranking if strategy.get("status") == "OBSERVATION"]),
            "lastDiscovery": next((strategy for strategy in full_ranking if not strategy.get("insufficientSample")), None),
            "updatedAt": updated_at,
        },
        "analyzedRounds": len(rounds),
        "historyLimit": PATTERN_MINER_HISTORY_LIMIT,
        "updatedAt": updated_at,
    }
    DIRECT_PATTERN_MINER_SNAPSHOT_CACHE_KEY = cache_key
    DIRECT_PATTERN_MINER_SNAPSHOT_CACHE = snapshot
    return snapshot


def direct_pattern_strategy_snapshot(strategy: dict[str, Any], updated_at: str) -> dict[str, Any]:
    item = dict(strategy)
    if not item.get("expectedResult"):
        item.pop("expectedResult", None)
    item.setdefault("createdAt", updated_at)
    item.setdefault("updatedAt", updated_at)
    return item


def direct_pattern_miner_realtime_alerts(
    rounds: list[dict[str, Any]],
    ranking: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    alerts: list[dict[str, Any]] = []
    if not rounds:
        return alerts
    for strategy in [item for item in ranking if not item.get("insufficientSample")][:PATTERN_MINER_TOP_SCAN]:
        sequence = strategy.get("sequence") if isinstance(strategy.get("sequence"), list) else []
        length = len(sequence)
        if length and len(rounds) >= length:
            completed_rounds = rounds[-length:]
            if direct_matches_sequence(completed_rounds, sequence):
                alerts.append({
                    "id": f"validated-{strategy.get('id')}",
                    "kind": "validated",
                    "strategy": strategy,
                    "matchedRounds": completed_rounds,
                    "progress": 1,
                    "missingTokens": [],
                    "title": "PADRAO VALIDADO",
                })
                continue
        for matched in range(length - 1, 0, -1):
            if len(rounds) < matched:
                continue
            partial_rounds = rounds[-matched:]
            partial_sequence = sequence[:matched]
            if direct_matches_sequence(partial_rounds, partial_sequence):
                alerts.append({
                    "id": f"forming-{strategy.get('id')}-{matched}",
                    "kind": "forming",
                    "strategy": strategy,
                    "matchedRounds": partial_rounds,
                    "progress": matched / length if length else 0,
                    "missingTokens": sequence[matched:],
                    "title": "PADRAO EM FORMACAO",
                })
                break
    alerts.sort(key=lambda alert: (
        0 if alert.get("kind") == "validated" else 1,
        -direct_float(alert.get("progress")),
        -direct_float((alert.get("strategy") or {}).get("assertiveness")),
    ))
    return alerts[:40]


def direct_pattern_miner_rank_strategies(rounds: list[dict[str, Any]]) -> list[dict[str, Any]]:
    buckets: dict[tuple[str, ...], dict[str, Any]] = {}
    for length in PATTERN_MINER_LENGTHS:
        if length < 2 or len(rounds) < length:
            continue
        for start in range(0, len(rounds) - length + 1):
            for sequence in direct_sequence_variants(rounds, start, length):
                bucket = buckets.setdefault(sequence, {
                    "sequence": list(sequence),
                    "occurrences": 0,
                    "byExpected": {side: direct_empty_pattern_stats() for side in ("B", "P", "T")},
                })
                bucket["occurrences"] += 1
                for expected in ("B", "P", "T"):
                    direct_apply_pattern_validation(bucket["byExpected"][expected], rounds, start + length, expected)

    strategies = [
        direct_pattern_bucket_to_strategy(bucket)
        for bucket in buckets.values()
        if int(bucket.get("occurrences") or 0) >= PATTERN_MINER_MIN_OCCURRENCES
    ]
    strategies.sort(key=functools.cmp_to_key(direct_compare_pattern_strategies))
    for index, strategy in enumerate(strategies, start=1):
        strategy["rank"] = index
    return strategies


def direct_empty_pattern_stats() -> dict[str, Any]:
    return {
        "sg": 0,
        "g1": 0,
        "red": 0,
        "tie": 0,
        "totalValidated": 0,
        "sequencePositive": 0,
        "sequenceNegative": 0,
        "maxSequencePositive": 0,
        "maxSequenceNegative": 0,
        "lastOutcome": "",
    }


def direct_pattern_bucket_to_strategy(bucket: dict[str, Any]) -> dict[str, Any]:
    options = []
    for expected, stats in (bucket.get("byExpected") or {}).items():
        assertiveness = direct_pattern_assertiveness(stats)
        options.append({
            "expected": expected,
            "stats": stats,
            "assertiveness": assertiveness if assertiveness is not None else -1,
        })
    options.sort(key=lambda item: (
        -float(item["assertiveness"]),
        -int(item["stats"].get("sg") or 0) - int(item["stats"].get("g1") or 0),
        -int(item["stats"].get("totalValidated") or 0),
    ))
    best = options[0] if options else {"expected": "", "stats": direct_empty_pattern_stats(), "assertiveness": -1}
    stats = best["stats"]
    has_sample = (
        int(bucket.get("occurrences") or 0) >= PATTERN_MINER_MIN_OCCURRENCES
        and int(stats.get("totalValidated") or 0) >= PATTERN_MINER_MIN_VALIDATED
        and int(stats.get("sg") or 0) + int(stats.get("g1") or 0) > 0
        and float(best.get("assertiveness") or -1) >= 0
    )
    assertiveness = float(best["assertiveness"]) if has_sample else 0.0
    sequence = list(bucket.get("sequence") or [])
    return {
        "id": direct_stable_pattern_id(sequence),
        "sequence": sequence,
        "occurrences": int(bucket.get("occurrences") or 0),
        "expectedResult": best.get("expected") if has_sample else "",
        "sg": int(stats.get("sg") or 0),
        "g1": int(stats.get("g1") or 0),
        "red": int(stats.get("red") or 0),
        "tie": int(stats.get("tie") or 0),
        "totalValidated": int(stats.get("totalValidated") or 0),
        "sequencePositive": int(stats.get("sequencePositive") or 0),
        "sequenceNegative": int(stats.get("sequenceNegative") or 0),
        "maxSequencePositive": int(stats.get("maxSequencePositive") or 0),
        "maxSequenceNegative": int(stats.get("maxSequenceNegative") or 0),
        "assertiveness": assertiveness,
        "status": direct_pattern_status(stats, assertiveness, has_sample),
        "insufficientSample": not has_sample,
        "rank": 0,
    }


def direct_compare_pattern_strategies(a: dict[str, Any], b: dict[str, Any]) -> int:
    a_insufficient = bool(a.get("insufficientSample"))
    b_insufficient = bool(b.get("insufficientSample"))
    if a_insufficient != b_insufficient:
        return 1 if a_insufficient else -1

    a_rate = direct_float(a.get("assertiveness")) if a.get("assertiveness") is not None else -1.0
    b_rate = direct_float(b.get("assertiveness")) if b.get("assertiveness") is not None else -1.0
    rate_diff = b_rate - a_rate
    if abs(rate_diff) > 3:
        return 1 if rate_diff > 0 else -1

    a_sequence = a.get("sequence") if isinstance(a.get("sequence"), list) else []
    b_sequence = b.get("sequence") if isinstance(b.get("sequence"), list) else []
    a_specificity = direct_numeric_specificity(a_sequence)
    b_specificity = direct_numeric_specificity(b_sequence)
    if a_specificity != b_specificity:
        return b_specificity - a_specificity
    if a_rate != b_rate:
        return 1 if rate_diff > 0 else -1
    a_total = int(a.get("totalValidated") or 0)
    b_total = int(b.get("totalValidated") or 0)
    if a_total != b_total:
        return b_total - a_total
    a_occurrences = int(a.get("occurrences") or 0)
    b_occurrences = int(b.get("occurrences") or 0)
    if a_occurrences != b_occurrences:
        return b_occurrences - a_occurrences
    a_id = str(a.get("id") or "")
    b_id = str(b.get("id") or "")
    if b_id < a_id:
        return -1
    if b_id > a_id:
        return 1
    return 0


def direct_first_ai_candidate(candidates: list[dict[str, Any]]) -> dict[str, Any] | None:
    for candidate in candidates:
        if str(candidate.get("moduleKey") or "") != "ai_patterns":
            continue
        if direct_ai_pattern_entry_allowed(str(candidate.get("entry") or "")):
            return candidate
    return None


def direct_module_has_pending(pending_items: list[dict[str, Any]], module_key: str) -> bool:
    if not module_key:
        return False
    return any(str(item.get("moduleKey") or "") == module_key for item in pending_items)


def direct_pattern_status(stats: dict[str, Any], assertiveness: float, has_sample: bool) -> str:
    if not has_sample:
        return "INACTIVE"
    total = int(stats.get("totalValidated") or 0)
    if assertiveness >= 85 and total >= 8:
        return "VERY_HOT"
    if assertiveness >= 75:
        return "HOT"
    if assertiveness >= 62:
        return "STABLE"
    if assertiveness >= 50:
        return "OBSERVATION"
    return "WEAK"


def direct_apply_pattern_validation(stats: dict[str, Any], rounds: list[dict[str, Any]], entry_index: int, expected: str) -> None:
    validation = direct_validate_pattern_occurrence(rounds, entry_index, expected)
    stats["tie"] = int(stats.get("tie") or 0) + int(validation.get("tieCount") or 0)
    kind = str(validation.get("kind") or "")
    if kind in {"pending", "tie"}:
        return
    stats["totalValidated"] = int(stats.get("totalValidated") or 0) + 1
    if kind == "sg":
        stats["sg"] = int(stats.get("sg") or 0) + 1
        direct_apply_pattern_result_sequence(stats, "green")
        return
    if kind == "g1":
        stats["g1"] = int(stats.get("g1") or 0) + 1
        direct_apply_pattern_result_sequence(stats, "green")
        return
    stats["red"] = int(stats.get("red") or 0) + 1
    direct_apply_pattern_result_sequence(stats, "red")


def direct_apply_pattern_result_sequence(stats: dict[str, Any], result: str) -> None:
    if result == "green":
        stats["sequencePositive"] = int(stats.get("sequencePositive") or 0) + 1 if stats.get("lastOutcome") == "green" else 1
        stats["sequenceNegative"] = 0
        stats["maxSequencePositive"] = max(int(stats.get("maxSequencePositive") or 0), int(stats.get("sequencePositive") or 0))
        stats["lastOutcome"] = "green"
        return
    stats["sequenceNegative"] = int(stats.get("sequenceNegative") or 0) + 1 if stats.get("lastOutcome") == "red" else 1
    stats["sequencePositive"] = 0
    stats["maxSequenceNegative"] = max(int(stats.get("maxSequenceNegative") or 0), int(stats.get("sequenceNegative") or 0))
    stats["lastOutcome"] = "red"


def direct_validate_pattern_occurrence(rounds: list[dict[str, Any]], entry_index: int, expected: str) -> dict[str, Any]:
    sg_round = rounds[entry_index] if entry_index < len(rounds) else None
    g1_round = rounds[entry_index + 1] if entry_index + 1 < len(rounds) else None
    if not sg_round:
        return {"kind": "pending", "tieCount": 0}
    if sg_round.get("result") == expected:
        return {"kind": "sg", "tieCount": 1 if expected == "T" else 0}
    tie_count = 1 if sg_round.get("result") == "T" else 0
    if not g1_round:
        return {"kind": "pending", "tieCount": tie_count}
    if g1_round.get("result") == expected:
        return {"kind": "g1", "tieCount": tie_count + (1 if expected == "T" else 0)}
    tie_count += 1 if g1_round.get("result") == "T" else 0
    if tie_count > 0 and expected != "T":
        return {"kind": "tie", "tieCount": tie_count}
    return {"kind": "red", "tieCount": tie_count}


def direct_sequence_variants(rounds: list[dict[str, Any]], start: int, length: int) -> list[tuple[str, ...]]:
    sequences: list[tuple[str, ...]] = [()]
    for round_item in rounds[start:start + length]:
        options = direct_pattern_token_options(round_item)
        sequences = [(*sequence, option) for sequence in sequences for option in options]
    return sequences


def direct_pattern_token_options(round_item: dict[str, Any]) -> list[str]:
    result = str(round_item.get("result") or "")
    score = direct_score_for_result(round_item, result)
    if result == "T":
        return [f"T{score}", "T"] if score else ["T"]
    return [f"{result}{score}", result] if score else [result]


def direct_matches_sequence(rounds: list[dict[str, Any]], sequence: list[str]) -> bool:
    return len(rounds) == len(sequence) and all(direct_matches_token(round_item, token) for round_item, token in zip(rounds, sequence))


def direct_matches_token(round_item: dict[str, Any], token: str) -> bool:
    token = str(token or "")
    if not token:
        return False
    side = token[0]
    if round_item.get("result") != side:
        return False
    if len(token) == 1:
        return True
    expected_score = direct_int(token[1:])
    return expected_score == 0 or direct_score_for_result(round_item, side) == expected_score


def direct_score_for_result(round_item: dict[str, Any], side: str) -> int:
    if side == "B":
        return direct_int(round_item.get("bankerScore"))
    if side == "P":
        return direct_int(round_item.get("playerScore"))
    tie_multiplier = direct_int(round_item.get("tieMultiplier"))
    if tie_multiplier:
        return tie_multiplier
    banker = direct_int(round_item.get("bankerScore"))
    player = direct_int(round_item.get("playerScore"))
    return banker if banker == player else max(banker, player)


def direct_numeric_specificity(sequence: list[str]) -> int:
    return sum(1 for token in sequence if re.match(r"^[BPT]\d+$", str(token or ""))) * 4 + len(sequence)


def direct_pattern_assertiveness(stats: dict[str, Any]) -> float | None:
    total = int(stats.get("totalValidated") or 0)
    if not total:
        return None
    return ((int(stats.get("sg") or 0) + int(stats.get("g1") or 0)) / total) * 100


def direct_stable_pattern_id(sequence: list[str]) -> str:
    value = ">".join(str(item) for item in sequence)
    hash_value = 0
    for char in value:
        hash_value = ((hash_value * 31) + ord(char)) & 0xFFFFFFFF
    return f"pm-{hash_value:x}"


def direct_ai_pattern_entry_allowed(entry: str) -> bool:
    return entry in {"BANKER", "PLAYER"}


def direct_ai_pattern_from_engine(payload: dict[str, Any], round_id: int) -> dict[str, Any] | None:
    decision = payload.get("engineDecision") if isinstance(payload.get("engineDecision"), dict) else {}
    if direct_engine_state(decision) != "ENTRADA":
        return None
    signal = payload.get("currentSignal") if isinstance(payload.get("currentSignal"), dict) else {}
    entry = direct_telegram_entry(
        signal.get("side")
        or signal.get("entry")
        or signal.get("expectedSide")
        or decision.get("entry")
        or decision.get("side")
    )
    if not direct_ai_pattern_entry_allowed(entry):
        return None
    confidence = direct_float(decision.get("confidence"))
    variables = {
        "table": "Bac Bo",
        "pattern": direct_pattern_text_from_decision(decision, signal),
        "confidence": f"{confidence:.2f}%" if confidence else "--",
        "status": direct_engine_state(decision),
    }
    key = str(signal.get("id") or signal.get("key") or signal.get("triggerRoundKey") or "")
    if not key:
        key = f"{round_id}:{entry}:{variables['pattern']}:{variables['confidence']}"
    return {
        "moduleKey": "ai_patterns",
        "signalKey": f"publisher:ai:{round_id}:{entry}:{key}",
        "roundId": round_id,
        "entry": entry,
        "variables": variables,
        "message": build_direct_telegram_message("ai_patterns", entry, variables),
    }


def direct_ai_patterns_from_alerts(payload: dict[str, Any], round_id: int) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for alert in pattern_entry_alerts(payload):
        if not isinstance(alert, dict):
            continue
        if str(alert.get("kind") or "").strip().casefold() not in {"validated", "entry", "entrada"}:
            continue
        strategy = alert.get("strategy") if isinstance(alert.get("strategy"), dict) else {}
        entry = direct_telegram_entry(
            strategy.get("expectedResult")
            or strategy.get("expectedSide")
            or strategy.get("entry")
            or alert.get("entry")
        )
        if not direct_ai_pattern_entry_allowed(entry):
            continue
        sequence = strategy.get("sequence") if isinstance(strategy.get("sequence"), list) else []
        pattern = " > ".join(str(item) for item in sequence if item) or str(alert.get("title") or "Padrao validado")
        confidence = direct_float(strategy.get("assertiveness") or strategy.get("accuracy") or alert.get("confidence"))
        variables = {
            "table": "Bac Bo",
            "pattern": pattern,
            "confidence": f"{confidence:.2f}%" if confidence else "--",
            "status": str(strategy.get("status") or alert.get("title") or "VALIDADO"),
        }
        key = str(alert.get("id") or strategy.get("id") or pattern)
        candidates.append({
            "moduleKey": "ai_patterns",
            "signalKey": f"publisher:ai-alert:{round_id}:{entry}:{key}",
            "roundId": round_id,
            "entry": entry,
            "variables": variables,
            "message": build_direct_telegram_message("ai_patterns", entry, variables),
        })
    return candidates


def direct_telegram_signals(payload: dict[str, Any], pattern_round_bank: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    round_id = direct_round_id(payload)
    candidates: list[dict[str, Any]] = []
    signal = payload.get("currentSignal") if isinstance(payload.get("currentSignal"), dict) else {}
    neural_state = payload.get("neuralEntryState") if isinstance(payload.get("neuralEntryState"), dict) else {}
    neural_reading = payload.get("neuralReading") if isinstance(payload.get("neuralReading"), dict) else {}
    visual_entry = direct_visual_paying_entry(neural_reading)
    status = direct_visual_paying_status(neural_reading) or direct_signal_status(neural_state, signal, neural_reading)
    entry = visual_entry or direct_telegram_entry(
        neural_state.get("expectedSide")
        or signal.get("side")
        or signal.get("entry")
        or neural_reading.get("direcao")
        or neural_reading.get("origem")
    )
    if entry in {"BANKER", "PLAYER"} and (visual_entry or direct_status_is_open(status)):
        key = (
            str(neural_state.get("key") or "")
            or str(neural_state.get("triggerRoundKey") or "")
            or ":".join(
                str(value or "")
                for value in (
                    neural_reading.get("numero"),
                    neural_reading.get("direcao"),
                    neural_reading.get("origem"),
                    neural_reading.get("paganteStatus"),
                )
                if value
            )
            or entry_identity(signal)
            or str(round_id)
        )
        variables = {
            "number": neural_reading.get("numero") or neural_state.get("numero") or "",
            "status": status.upper() or "CONFIRMADO",
            "table": "Bac Bo",
        }
        candidates.append({
            "moduleKey": "paying_numbers",
            "signalKey": f"publisher:paying:{round_id}:{entry}:{key}",
            "roundId": round_id,
            "entry": entry,
            "variables": variables,
            "message": build_direct_telegram_message("paying_numbers", entry, variables),
        })

    ai_candidate = direct_first_ai_candidate(direct_ai_patterns_from_alerts(payload, round_id))
    if ai_candidate:
        candidates.append(ai_candidate)

    surf = payload.get("currentSurfAlert") if isinstance(payload.get("currentSurfAlert"), dict) else {}
    surf_side = direct_telegram_entry(
        surf.get("surf_prediction_side") or surf.get("surf_side") or surf.get("side") or surf.get("entry")
    )
    surf_status = str(surf.get("surf_status") or surf.get("status") or surf.get("phase") or "").strip().casefold()
    surf_risk = surf.get("surf_break_risk") or surf.get("surf_risk") or surf.get("risk") or ""
    if surf_side and (surf_status in {"active", "ativo", "confirmado", "confirmed"} or direct_float(surf_risk) >= 70):
        variables = {"risk": surf_risk, "table": "Bac Bo"}
        candidates.append({
            "moduleKey": "surf_alert",
            "signalKey": f"publisher:surf:{round_id}:{surf_side}:{surf_status}:{surf_risk}",
            "roundId": round_id,
            "entry": surf_side,
            "variables": variables,
            "message": build_direct_telegram_message("surf_alert", surf_side, variables),
        })

    tie = payload.get("currentTieAlert") if isinstance(payload.get("currentTieAlert"), dict) else {}
    tie_status = str(tie.get("status") or "").strip().casefold()
    if tie_status == "active":
        level = str(tie.get("level") or tie.get("nivel") or "Ativo")
        variables = {"level": level, "table": "Bac Bo"}
        candidates.append({
            "moduleKey": "ties_only",
            "signalKey": f"publisher:tie:{round_id}:{level}",
            "roundId": round_id,
            "entry": "TIE",
            "variables": variables,
            "message": build_direct_telegram_message("ties_only", "TIE", variables),
        })

    return dedupe_direct_telegram_candidates(candidates)


def dedupe_direct_telegram_candidates(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_key: dict[tuple[int, str, str], dict[str, Any]] = {}
    for candidate in candidates:
        round_id = int(candidate.get("roundId") or 0)
        entry = str(candidate.get("entry") or "")
        module_key = str(candidate.get("moduleKey") or "")
        key = (round_id, entry, module_key)
        current = by_key.get(key)
        if not current or direct_signal_priority(candidate) < direct_signal_priority(current):
            by_key[key] = candidate
    return list(by_key.values())


def direct_signal_priority(candidate: dict[str, Any]) -> int:
    module_key = str(candidate.get("moduleKey") or "")
    entry = str(candidate.get("entry") or "")
    if entry == "TIE" and module_key == "ties_only":
        return 0
    if module_key == "paying_numbers":
        return 1
    if module_key == "ai_patterns":
        return 2
    if module_key == "surf_alert":
        return 3
    return 9


def publish_direct_telegram_signal(
    config: dict[str, str],
    signal: dict[str, Any],
) -> tuple[bool, int, float, str]:
    url = config.get("url", "").rstrip("/")
    secret = config.get("secret", "")
    user_id = config.get("user_id", "")
    channel_id = config.get("channel_id", "")
    if not url or not secret:
        return False, 0, 0.0, "not_configured"
    body, status_code, upload_ms = request_json_with_meta(
        f"{url}/engine/signal",
        method="POST",
        token=secret,
        payload={
            **({"userId": user_id} if user_id else {}),
            **({"channelId": channel_id} if channel_id else {}),
            "moduleKey": signal["moduleKey"],
            "signalKey": signal["signalKey"],
            "roundId": signal["roundId"],
            "entry": signal["entry"],
            "message": decorate_direct_telegram_message(str(signal["message"])),
            "variables": signal.get("variables") or {},
            **({"result": signal["result"]} if signal.get("result") else {}),
            **({"protection": signal["protection"]} if signal.get("protection") else {}),
            "buttonLabel": "Abrir Sniper Bo IA",
        },
        timeout=(0.25, 1.0),
    )
    sent = body.get("sent") if isinstance(body, dict) else []
    blocked = body.get("blocked") if isinstance(body, dict) else []
    if isinstance(sent, list) and sent:
        blocked_reasons = sorted({
            str((item or {}).get("reason") or "blocked")
            for item in blocked
            if isinstance(item, dict)
        }) if isinstance(blocked, list) else []
        reason = f"sent_count={len(sent)}"
        if blocked_reasons:
            reason += f";blocked={','.join(blocked_reasons)}"
        return True, status_code, upload_ms, reason
    if isinstance(blocked, list) and blocked:
        counts: dict[str, int] = {}
        for item in blocked:
            if not isinstance(item, dict):
                continue
            block_reason = str(item.get("reason") or "blocked")
            counts[block_reason] = counts.get(block_reason, 0) + 1
        detail = ",".join(f"{key}={value}" for key, value in sorted(counts.items()))
        reason = f"blocked_count={len(blocked)}"
        if detail:
            reason += f";{detail}"
        return False, status_code, upload_ms, reason
    return False, status_code, upload_ms, "not_sent"


def direct_telegram_block_handled(reason: str) -> bool:
    clean = str(reason or "")
    return clean in DIRECT_TELEGRAM_HANDLED_BLOCK_REASONS or clean.startswith("blocked_count=")


def direct_telegram_payload(
    published_payload: dict[str, Any] | None,
    local_payload: dict[str, Any] | None,
) -> tuple[dict[str, Any], str]:
    if isinstance(published_payload, dict) and published_payload:
        return published_payload, "published"
    if isinstance(local_payload, dict) and local_payload:
        return local_payload, "local"
    return {}, "none"


def direct_round_side(round_item: Any) -> str:
    if not isinstance(round_item, dict):
        return ""
    return direct_telegram_entry(round_item.get("result") or round_item.get("resultado"))


def direct_tie_multiplier(round_item: dict[str, Any]) -> str:
    explicit = direct_float(round_item.get("tieMultiplier") or round_item.get("tie_multiplier") or round_item.get("multiplier"))
    if explicit > 0:
        return f"{int(explicit)}x"
    if direct_round_side(round_item) != "TIE":
        return ""
    banker = direct_float(round_item.get("bankerScore") or round_item.get("banker_score"))
    player = direct_float(round_item.get("playerScore") or round_item.get("player_score"))
    if banker != player:
        return ""
    score = int(round(banker))
    if score in {2, 12}:
        return "88x"
    if score in {3, 11}:
        return "25x"
    if score in {4, 10}:
        return "10x"
    if score in {5, 9}:
        return "6x"
    if score in {6, 7, 8}:
        return "4x"
    return ""


def direct_result_message(pending: dict[str, Any], outcome: dict[str, Any]) -> str:
    entry = direct_telegram_entry_label(str(pending.get("entry") or ""))
    status = str(outcome.get("status") or "")
    label = str(outcome.get("label") or status)
    gale = str(outcome.get("gale") or "SG")
    tie_multiplier = str(outcome.get("tieMultiplier") or "")
    variables = pending.get("variables") if isinstance(pending.get("variables"), dict) else {}
    pattern = str(variables.get("pattern") or pending.get("pattern") or "").strip()
    pattern_line = [f"🧩 <b>Padrão:</b> {pattern}"] if pattern else []
    if status == "RED":
        return "\n".join([
            "❌ <b>RED</b>",
            "",
            *pattern_line,
            f"🎯 <b>Entrada:</b> {entry}",
            f"🛡️ <b>Proteção:</b> {gale}",
        ])
    if status == "TIE":
        tie_text = f"EMPATE {tie_multiplier}".strip()
        return "\n".join([
            f"🟡 <b>{tie_text}</b>",
            "",
            *pattern_line,
            f"🎯 <b>Entrada:</b> {entry}",
            "✅ <b>Empate confirmado</b>",
        ])
    return "\n".join([
        f"✅ <b>{label}</b>",
        "",
        *pattern_line,
        f"🎯 <b>Entrada:</b> {entry}",
        f"🛡️ <b>Proteção:</b> {gale}",
    ])


def direct_result_dedupe_key(pending: dict[str, Any], outcome: dict[str, Any]) -> str:
    return ":".join([
        "result",
        str(outcome.get("roundId") or ""),
        str(pending.get("entry") or ""),
        str(outcome.get("status") or ""),
        str(outcome.get("label") or ""),
    ]).lower()


def resolve_direct_telegram_outcome(pending: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any] | None:
    rounds = payload.get("rounds") if isinstance(payload.get("rounds"), list) else []
    if not rounds:
        return None
    trigger_round_id = int(pending.get("roundId") or 0)
    trigger_index = -1
    for index, round_item in enumerate(rounds):
        if not isinstance(round_item, dict):
            continue
        try:
            round_id = int(float(round_item.get("id") or round_item.get("round_id") or round_item.get("roundId") or 0))
        except (TypeError, ValueError):
            round_id = 0
        if round_id == trigger_round_id:
            trigger_index = index
            break
    if trigger_index < 0:
        return None

    entry = str(pending.get("entry") or "")
    max_gale = int(pending.get("maxGale") or 1)
    attempts = 0
    for round_item in rounds[trigger_index + 1:]:
        if not isinstance(round_item, dict):
            continue
        side = direct_round_side(round_item)
        try:
            round_id = int(float(round_item.get("id") or round_item.get("round_id") or round_item.get("roundId") or 0))
        except (TypeError, ValueError):
            round_id = 0
        if side == "TIE":
            return {
                "status": "TIE",
                "label": "Empate",
                "roundId": round_id,
                "gale": "SG" if attempts <= 0 else f"G{min(4, attempts)}",
                "tieMultiplier": direct_tie_multiplier(round_item),
            }
        if side == entry:
            gale = "SG" if attempts <= 0 else f"G{min(4, attempts)}"
            return {
                "status": "GREEN",
                "label": "Green" if attempts <= 0 else f"Green G{min(4, attempts)}",
                "roundId": round_id,
                "gale": gale,
                "tieMultiplier": "",
            }
        attempts += 1
        if attempts > max_gale:
            return {
                "status": "RED",
                "label": "Red",
                "roundId": round_id,
                "gale": f"G{max_gale}" if max_gale > 0 else "SG",
                "tieMultiplier": "",
            }
    return None


def dashboard_fingerprint(payload: dict[str, Any]) -> str:
    rounds = payload.get("rounds") if isinstance(payload.get("rounds"), list) else []
    last_round = rounds[-1] if rounds and isinstance(rounds[-1], dict) else {}
    compact = {
        "roundId": last_round.get("id"),
        "roundResult": last_round.get("result") or last_round.get("resultado"),
    }
    return json.dumps(compact, sort_keys=True, separators=(",", ":"))
def main() -> int:
    default_signals_port = os.getenv("SIGNALS_API_PORT") or os.getenv("VITE_SIGNALS_API_PORT") or "8787"
    default_local_url = os.getenv("SNIPER_LOCAL_DASHBOARD_URL") or f"http://127.0.0.1:{default_signals_port}/dashboard"
    parser = argparse.ArgumentParser(description="Publish local live dashboard to sniperbo.com.")
    parser.add_argument("--env-file", type=Path, required=True)
    parser.add_argument("--local-url", default=default_local_url)
    parser.add_argument("--remote-base-url", default="https://sniperbo.com")
    parser.add_argument("--remote-url", default="https://sniperbo.com/dashboard/publish")
    parser.add_argument("--signal-url", default="")
    parser.add_argument("--interval", type=float, default=0.25)
    parser.add_argument("--local-timeout", type=float, default=2.0)
    parser.add_argument("--remote-timeout", type=float, default=8.0)
    parser.add_argument("--repeat-interval", type=float, default=1.5)
    parser.add_argument("--urgent-retry-interval", type=float, default=0.25)
    parser.add_argument("--non-entry-urgent-interval", type=float, default=0.5)
    parser.add_argument("--urgent-signal", action="store_true", default=True, help="Publish a minimal signal payload before the full dashboard.")
    parser.add_argument("--no-urgent-signal", dest="urgent_signal", action="store_false", help="Disable urgent signal publishing.")
    parser.add_argument("--skip-full-publish", action="store_true", help="Only publish urgent signal payloads; do not POST the heavy full dashboard.")
    parser.add_argument("--log-file", type=Path, default=Path("official_dashboard_publisher.log"))
    args = parser.parse_args()
    if not acquire_process_lock(args):
        return 0
    if not args.signal_url:
        args.signal_url = f"{args.remote_base_url.rstrip('/')}/dashboard/signal"

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        filename=args.log_file,
        filemode="a",
    )

    env = load_env_file(args.env_file)
    admin_email = env_value(env, "SNIPER_ADMIN_EMAIL") or env_value(env, "SNIPER_ADMIN_EMAILS").split(",", 1)[0].strip()
    admin_password = env_value(env, "SNIPER_ADMIN_PASSWORD")
    if not admin_password:
        logging.error("SNIPER_ADMIN_PASSWORD is empty in %s — publish will return HTTP 401.", args.env_file)
    local_token = (
        env_value(env, "SNIPER_LOCAL_DASHBOARD_TOKEN")
        or env_value(env, "SNIPER_DASHBOARD_TOKEN")
        or env_value(env, "VITE_SNIPER_DASHBOARD_TOKEN")
        or env_value(env, "SNIPER_PUBLISHER_TOKEN")
        or env_value(env, "SNIPER_ADMIN_TOKEN")
    )
    remote_tokens = unique_tokens(
        env_value(env, "SNIPER_REMOTE_DASHBOARD_TOKEN"),
        env_value(env, "SNIPER_PUBLISHER_TOKEN"),
        env_value(env, "SNIPER_DASHBOARD_TOKEN"),
        env_value(env, "SNIPER_ADMIN_TOKEN"),
    )
    direct_telegram_enabled = (
        str(args.remote_base_url).rstrip("/").lower() == "https://sniperbo.com" or
        str(args.remote_url).lower().startswith("https://sniperbo.com/")
    )
    direct_telegram_single_target = (
        env_value(env, "TELEGRAM_ENGINE_TARGET_SINGLE").strip().lower() in {"1", "true", "yes", "on"}
    )
    direct_telegram_config = {
        "url": (env_value(env, "TELEGRAM_ENGINE_URL") or env_value(env, "CLOUDFLARE_TELEGRAM_ENGINE_URL")) if direct_telegram_enabled else "",
        "secret": (env_value(env, "TELEGRAM_ENGINE_SECRET") or env_value(env, "CLOUDFLARE_TELEGRAM_ENGINE_SECRET")) if direct_telegram_enabled else "",
        "user_id": env_value(env, "TELEGRAM_ENGINE_USER_ID") if direct_telegram_enabled and direct_telegram_single_target else "",
        "channel_id": env_value(env, "TELEGRAM_ENGINE_CHANNEL_ID") if direct_telegram_enabled and direct_telegram_single_target else "",
    }
    if not local_token:
        logging.error("Missing local dashboard token in env file.")
        return 2

    token = ""
    token_index = 0
    using_admin_session = False
    direct_publisher_endpoint = args.remote_url.rstrip("/").endswith("/dashboard/publish")
    direct_publisher_token = (
        env.get("SNIPER_PUBLISHER_TOKEN", "").strip()
        or os.getenv("SNIPER_PUBLISHER_TOKEN", "").strip()
        or (remote_tokens[0] if remote_tokens else "")
    )
    rate_limit_sleep = 0.0
    last_fingerprint = ""
    last_signal_fingerprint = ""
    last_signal_attempt_at = 0.0
    urgent_backoff_until = 0.0
    urgent_failures = 0
    last_publish_at = 0.0
    last_published_payload: dict[str, Any] | None = None
    last_round_id = ""
    queued_locked_urgent_payload: dict[str, Any] | None = None
    full_publish_failures = 0
    full_publish_backoff_until = 0.0
    local_read_backoff_until = 0.0
    direct_telegram_sent_keys: set[str] = set()
    direct_telegram_pending: list[dict[str, Any]] = []
    direct_telegram_result_keys: set[str] = set()
    direct_telegram_module_hold_until: dict[str, float] = {}
    last_direct_payload_mismatch_key = ""
    direct_pattern_bank_file = direct_pattern_bank_path(args, env)
    direct_pattern_round_bank = load_direct_pattern_round_bank(direct_pattern_bank_file)
    direct_pattern_bank_last_save = 0.0
    logging.info("Pattern miner bank loaded: rounds=%s path=%s", len(direct_pattern_round_bank), direct_pattern_bank_file)
    logging.info("Official dashboard publisher started: %s -> %s", args.local_url, args.remote_url)
    while True:
        try:
            if rate_limit_sleep > 0:
                time.sleep(rate_limit_sleep)
            if direct_publisher_endpoint:
                token = direct_publisher_token
                using_admin_session = False
            elif not token:
                if token_index < len(remote_tokens):
                    token = remote_tokens[token_index]
                    token_index += 1
                    using_admin_session = False
                    logging.info("Using dashboard publisher token candidate %s/%s.", token_index, len(remote_tokens))
                else:
                    if not admin_email or not admin_password:
                        logging.error("Missing admin email/password and no valid remote dashboard token is configured.")
                        time.sleep(max(1.0, args.interval))
                        continue
                    token = admin_login(args.remote_base_url, admin_email, admin_password, args.remote_timeout)
                    using_admin_session = True
                    logging.info("Admin session created.")
            now_read = time.monotonic()
            if now_read < local_read_backoff_until:
                time.sleep(max(0.75, args.interval))
                continue
            t0_iso = iso_now_ms()
            t0_perf = time.perf_counter()
            try:
                raw_local_payload = suppress_late_open_entries(
                    read_local_dashboard(args, local_token, admin_email, admin_password, direct_publisher_token)
                )
            except HTTPError as exc:
                status_code, body = http_error_summary(exc)
                if status_code == 429:
                    local_read_backoff_until = time.monotonic() + 5.0
                    logging.warning("Local dashboard HTTP 429; backing off local reads for 5.0s: %s", body)
                    time.sleep(max(0.75, args.interval))
                    continue
                raise
            local_read_backoff_until = 0.0
            local_payload, g1_blocked, blocked_round = apply_g1_publication_lock(raw_local_payload, last_published_payload)
            local_payload = attach_direct_pattern_miner_snapshot(local_payload, direct_pattern_round_bank)
            direct_pattern_round_bank = update_direct_pattern_round_bank(direct_pattern_round_bank, local_payload)
            if time.monotonic() - direct_pattern_bank_last_save >= PATTERN_MINER_BANK_SAVE_INTERVAL:
                save_direct_pattern_round_bank(direct_pattern_bank_file, direct_pattern_round_bank)
                direct_pattern_bank_last_save = time.monotonic()
            if g1_blocked:
                queued_locked_urgent_payload = raw_local_payload
                logging.warning(
                    "entrada nova bloqueada â€” aguardando G1 da rodada %s.",
                    blocked_round or extract_round_id(raw_local_payload),
                )
            elif queued_locked_urgent_payload is not None:
                logging.info("entrada bloqueada liberada apos resolucao de G1.")
                queued_locked_urgent_payload = None

            signal_fingerprint = dashboard_signal_fingerprint(local_payload)
            current_round_id = extract_round_id(local_payload)
            round_changed = bool(current_round_id and current_round_id != last_round_id)
            if round_changed:
                last_round_id = current_round_id
            signal_changed = bool(
                args.urgent_signal
                and signal_fingerprint
                and (signal_fingerprint != last_signal_fingerprint or round_changed)
            )
            telegram_result_payload, _telegram_result_source = direct_telegram_payload(last_published_payload, local_payload)
            next_direct_pending: list[dict[str, Any]] = []
            for pending in direct_telegram_pending:
                outcome = resolve_direct_telegram_outcome(pending, telegram_result_payload)
                if not outcome:
                    next_direct_pending.append(pending)
                    continue
                result_key = f"{pending.get('signalKey')}:result:{outcome.get('status')}:{outcome.get('roundId')}"
                aggregate_result_key = direct_result_dedupe_key(pending, outcome)
                if result_key in direct_telegram_result_keys or aggregate_result_key in direct_telegram_result_keys:
                    continue
                result_signal = {
                    "moduleKey": pending.get("moduleKey"),
                    "signalKey": result_key,
                    "roundId": outcome.get("roundId"),
                    "entry": pending.get("entry"),
                    "variables": {
                        **(pending.get("variables") if isinstance(pending.get("variables"), dict) else {}),
                        "result": outcome.get("label"),
                        "gale": outcome.get("gale"),
                        "tieMultiplier": outcome.get("tieMultiplier"),
                        "triggerRoundId": pending.get("roundId"),
                    },
                    "triggerRoundId": pending.get("roundId"),
                    "result": outcome.get("label"),
                    "protection": outcome.get("gale"),
                    "message": direct_result_message(pending, outcome),
                }
                try:
                    result_ok, result_status, result_ms, result_reason = publish_direct_telegram_signal(
                        direct_telegram_config,
                        result_signal,
                    )
                    if result_reason == "not_configured":
                        next_direct_pending.append(pending)
                        continue
                    log_fn = logging.info if result_ok and result_ms <= DIRECT_TELEGRAM_TARGET_MS else logging.warning
                    log_fn(
                        "direct telegram result %s: module=%s round=%s upload_ms=%.0f status_code=%s reason=%s outcome=%s",
                        "sent" if result_ok else "blocked",
                        pending.get("moduleKey"),
                        outcome.get("roundId"),
                        result_ms,
                        result_status,
                        result_reason,
                        outcome.get("label"),
                    )
                    if result_ok or result_reason == "duplicate_signal":
                        direct_telegram_result_keys.add(result_key)
                        direct_telegram_result_keys.add(aggregate_result_key)
                        module_key = str(pending.get("moduleKey") or "")
                        if module_key:
                            direct_telegram_module_hold_until[module_key] = (
                                time.monotonic() + DIRECT_TELEGRAM_RESULT_TO_ENTRY_DELAY_SECONDS
                            )
                    else:
                        next_direct_pending.append(pending)
                except (HTTPError, URLError, TimeoutError, OSError, RuntimeError) as exc:
                    logging.warning("direct telegram result publish failed: %s", exc)
                    next_direct_pending.append(pending)
            direct_telegram_pending = next_direct_pending[-100:]

            telegram_entry_payload, telegram_entry_source = direct_telegram_payload(last_published_payload, local_payload)
            telegram_entry_round_id = direct_round_id(telegram_entry_payload) if telegram_entry_payload else 0
            local_round_id = direct_round_id(local_payload)
            if (
                telegram_entry_payload
                and local_payload
                and telegram_entry_source == "published"
                and telegram_entry_round_id
                and local_round_id
                and telegram_entry_round_id != local_round_id
            ):
                mismatch_key = f"{telegram_entry_round_id}:{local_round_id}"
                if mismatch_key != last_direct_payload_mismatch_key:
                    logging.info(
                        "direct telegram entries using published dashboard payload: reason=published_payload_round_mismatch published_round=%s local_round=%s",
                        telegram_entry_round_id,
                        local_round_id,
                    )
                    last_direct_payload_mismatch_key = mismatch_key

            for direct_signal in direct_telegram_signals(
                telegram_entry_payload or {},
                direct_pattern_round_bank,
            ):
                direct_key = str(direct_signal.get("signalKey") or "")
                if not direct_key or direct_key in direct_telegram_sent_keys:
                    continue
                direct_module_key = str(direct_signal.get("moduleKey") or "")
                module_hold_until = direct_telegram_module_hold_until.get(direct_module_key, 0.0)
                if module_hold_until and time.monotonic() < module_hold_until:
                    continue
                if direct_module_has_pending(direct_telegram_pending, direct_module_key):
                    logging.info(
                        "direct telegram skipped: module=%s entry=%s round=%s reason=pending_module_open",
                        direct_signal.get("moduleKey"),
                        direct_signal.get("entry"),
                        direct_signal.get("roundId"),
                    )
                    direct_telegram_sent_keys.add(direct_key)
                    continue
                try:
                    direct_ok, direct_status, direct_ms, direct_reason = publish_direct_telegram_signal(
                        direct_telegram_config,
                        direct_signal,
                    )
                    if direct_reason == "not_configured":
                        continue
                    log_fn = logging.info if direct_ok and direct_ms <= DIRECT_TELEGRAM_TARGET_MS else logging.warning
                    log_fn(
                        "direct telegram %s: module=%s entry=%s round=%s pattern=%s upload_ms=%.0f status_code=%s reason=%s",
                        "sent" if direct_ok else "blocked",
                        direct_signal.get("moduleKey"),
                        direct_signal.get("entry"),
                        direct_signal.get("roundId"),
                        (direct_signal.get("variables") if isinstance(direct_signal.get("variables"), dict) else {}).get("pattern"),
                        direct_ms,
                        direct_status,
                        direct_reason,
                    )
                    if direct_ok or direct_telegram_block_handled(direct_reason):
                        direct_telegram_sent_keys.add(direct_key)
                        if direct_ok:
                            direct_telegram_pending = [
                                item for item in direct_telegram_pending
                                if item.get("signalKey") != direct_key
                                and not (
                                    item.get("moduleKey") == direct_signal.get("moduleKey")
                                    and item.get("roundId") == direct_signal.get("roundId")
                                    and item.get("entry") == direct_signal.get("entry")
                                )
                            ]
                            direct_telegram_pending.append({
                                "moduleKey": direct_signal.get("moduleKey"),
                                "signalKey": direct_key,
                                "roundId": direct_signal.get("roundId"),
                                "entry": direct_signal.get("entry"),
                                "variables": direct_signal.get("variables") if isinstance(direct_signal.get("variables"), dict) else {},
                                "maxGale": 4 if direct_signal.get("moduleKey") == "ties_only" else 1,
                            })
                        if len(direct_telegram_sent_keys) > 500:
                            direct_telegram_sent_keys = set(list(direct_telegram_sent_keys)[-250:])
                        if len(direct_telegram_result_keys) > 500:
                            direct_telegram_result_keys = set(list(direct_telegram_result_keys)[-250:])
                except (HTTPError, URLError, TimeoutError, OSError, RuntimeError) as exc:
                    logging.warning("direct telegram publish failed: %s", exc)
            urgent_published = False
            if signal_changed:
                now_signal = time.monotonic()
                if now_signal < urgent_backoff_until:
                    logging.info("Urgent signal in backoff; publishing full dashboard with latest payload instead.")
                    signal_changed = False
                min_urgent_interval = urgent_signal_min_interval(local_payload, args)
                if (now_signal - last_signal_attempt_at) >= min_urgent_interval:
                    last_signal_attempt_at = now_signal
                    try:
                        t1_perf = time.perf_counter()
                        signal_response, signal_status_code, signal_upload_ms = publish_urgent_signal(
                            args,
                            token,
                            local_payload,
                            admin_email,
                            admin_password,
                        )
                        log_publish_timing(
                            "urgent",
                            local_payload,
                            t0_iso,
                            (t1_perf - t0_perf) * 1000.0,
                            signal_upload_ms,
                            signal_status_code,
                        )
                        signal_dashboard = signal_response.get("dashboard") if isinstance(signal_response, dict) else {}
                        signal = (signal_dashboard or local_payload).get("currentSignal") or {}
                        neural_result = (signal_dashboard or local_payload).get("neuralEntryLastResult") or {}
                        logging.info(
                            "Published urgent signal: signal=%s side=%s neural=%s result=%s:%s",
                            signal.get("status"),
                            signal.get("side"),
                            ((signal_dashboard or local_payload).get("neuralEntryState") or {}).get("status"),
                            neural_result.get("outcome"),
                            neural_result.get("kind"),
                        )
                        last_signal_fingerprint = signal_fingerprint
                        last_published_payload = signal_dashboard or local_payload
                        urgent_failures = 0
                        urgent_backoff_until = 0.0
                        urgent_published = True
                    except HTTPError as exc:
                        if requests is not None and hasattr(exc, "response"):
                            status_code = exc.response.status_code if exc.response is not None else 0
                            body = exc.response.text[:180] if exc.response is not None else str(exc)[:180]
                        else:
                            status_code = getattr(exc, "code", 0)
                            body = exc.read().decode("utf-8", errors="replace")[:180] if hasattr(exc, "read") else str(exc)[:180]
                        urgent_failures += 1
                        if status_code == 429:
                            urgent_backoff_seconds = min(60.0, max(10.0, 10.0 * urgent_failures))
                            urgent_backoff_until = time.monotonic() + urgent_backoff_seconds
                            logging.warning(
                                "Urgent signal HTTP 429; backing off urgent channel for %.1fs: %s",
                                urgent_backoff_seconds,
                                body,
                            )
                        else:
                            urgent_backoff_until = time.monotonic() + min(30.0, max(2.0, 2.0 * urgent_failures))
                            logging.warning("Urgent signal HTTP %s: %s", status_code, body)
                    except (URLError, TimeoutError, OSError, RuntimeError) as exc:
                        urgent_failures += 1
                        urgent_backoff_until = time.monotonic() + min(20.0, max(2.0, 2.0 * urgent_failures))
                        logging.warning("Urgent signal publish failed once for this signal: %s; publishing full dashboard with latest payload instead.", exc)

            if args.skip_full_publish:

                time.sleep(max(0.1, args.interval))

                continue

            fingerprint = dashboard_fingerprint(local_payload)
            now = time.monotonic()
            if now < full_publish_backoff_until:
                time.sleep(max(0.1, args.interval))
                continue
            if fingerprint == last_fingerprint and not round_changed and (now - last_publish_at) < max(args.interval, args.repeat_interval):
                time.sleep(max(0.1, args.interval))
                continue

            t1_perf = time.perf_counter()
            response, status_code, upload_ms = publish_payload(args, token, local_payload, admin_email, admin_password)
            log_publish_timing(
                "dashboard",
                local_payload,
                t0_iso,
                (t1_perf - t0_perf) * 1000.0,
                upload_ms,
                status_code,
            )
            token_index = 0
            dashboard = response.get("dashboard") if isinstance(response, dict) else {}
            rounds = len((dashboard or {}).get("rounds") or [])
            signal = (dashboard or {}).get("currentSignal") or {}
            logging.info(
                "Published official dashboard: rounds=%s signal=%s side=%s",
                rounds,
                signal.get("status"),
                signal.get("side"),
            )
            last_fingerprint = fingerprint
            if signal_fingerprint:
                last_signal_fingerprint = signal_fingerprint
            urgent_failures = 0
            last_published_payload = dashboard or local_payload
            last_publish_at = time.monotonic()
            full_publish_failures = 0
            full_publish_backoff_until = 0.0
            rate_limit_sleep = 0.0
        except HTTPError as exc:
            if requests is not None and hasattr(exc, "response"):
                status_code = exc.response.status_code if exc.response is not None else 0
                body = exc.response.text[:180] if exc.response is not None else str(exc)[:180]
            else:
                status_code = getattr(exc, "code", 0)
                body = exc.read().decode("utf-8", errors="replace")[:180] if hasattr(exc, "read") else str(exc)[:180]
            logging.warning("Publish HTTP %s: %s", status_code, body)
            if status_code == 429:
                full_backoff_seconds = 120.0
                rate_limit_sleep = 0.0
                full_publish_backoff_until = time.monotonic() + full_backoff_seconds
                logging.warning(
                    "Rate limited by remote dashboard; full dashboard backoff for %.1fs; urgent signal remains active.",
                    full_backoff_seconds,
                )
            if status_code in {401, 403}:
                if using_admin_session:
                    token_index = 0
                token = ""
                using_admin_session = False
        except (URLError, TimeoutError, OSError, RuntimeError) as exc:
            logging.warning("Publish failed: %s", exc)
            full_publish_failures += 1
            full_backoff_seconds = min(180.0, max(60.0, 30.0 * full_publish_failures))
            full_publish_backoff_until = time.monotonic() + full_backoff_seconds
            logging.warning("Full dashboard publish backoff for %.1fs; urgent signal remains active.", full_backoff_seconds)
            # Do not mark failed payloads as published; next loop must send the latest state.

        time.sleep(max(0.1, args.interval))


if __name__ == "__main__":
    raise SystemExit(main())









