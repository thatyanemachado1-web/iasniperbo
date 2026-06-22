from __future__ import annotations

import argparse
import copy
import json
import logging
import os
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
PENDING_ENTRY_STATUSES = {
    "pending",
    "g1",
    "tie_watch",
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

    previous_alerts = pattern_entry_alerts(last_published)
    incoming_alerts = pattern_entry_alerts(guarded)
    if blocked_fields and previous_alerts and incoming_alerts:
        pattern = guarded.get("patternMinerSnapshot") or guarded.get("patternMiner")
        if isinstance(pattern, dict):
            pattern["entryAlerts"] = copy.deepcopy(previous_alerts)
            blocked_fields.append("patternMinerSnapshot.entryAlerts")

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


def read_local_dashboard(args: argparse.Namespace, local_token: str) -> dict[str, Any]:
    payload = request_json(
        args.local_url,
        token=local_token,
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
    rounds = payload.get("rounds") if isinstance(payload.get("rounds"), list) else []
    last_round = rounds[-1] if rounds and isinstance(rounds[-1], dict) else {}
    signal_status = signal.get("status")
    compact = {
        "roundId": last_round.get("id"),
        "roundResult": last_round.get("result") or last_round.get("resultado"),
        "signalStatus": signal_status,
        "signalSide": signal.get("side"),
        "neuralResultId": neural_result.get("id"),
    }
    return json.dumps(compact, sort_keys=True, separators=(",", ":"))


def urgent_signal_min_interval(payload: dict[str, Any], args: argparse.Namespace) -> float:
    signal = payload.get("currentSignal") if isinstance(payload.get("currentSignal"), dict) else {}
    neural_result = payload.get("neuralEntryLastResult") if isinstance(payload.get("neuralEntryLastResult"), dict) else {}
    status = str(signal.get("status") or "").strip().casefold()
    priority_statuses = {"pending", "g1", "green", "green_g1", "red"}
    if status in priority_statuses or neural_result.get("id"):
        return max(0.2, float(args.urgent_retry_interval))
    return max(float(args.non_entry_urgent_interval), float(args.urgent_retry_interval))


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
    body, status_code, upload_ms = request_json_with_meta(
        args.signal_url,
        method="POST",
        token=token,
        extra_headers=publisher_headers,
        payload=build_urgent_signal_payload(local_payload),
        timeout=min(args.remote_timeout, 2.5),
    )
    return (body if isinstance(body, dict) else {}, status_code, upload_ms)
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
    parser.add_argument("--interval", type=float, default=0.7)
    parser.add_argument("--local-timeout", type=float, default=2.0)
    parser.add_argument("--remote-timeout", type=float, default=12.0)
    parser.add_argument("--repeat-interval", type=float, default=12.0)
    parser.add_argument("--urgent-retry-interval", type=float, default=0.8)
    parser.add_argument("--non-entry-urgent-interval", type=float, default=12.0)
    parser.add_argument("--urgent-signal", action="store_true", default=True, help="Publish a minimal signal payload before the full dashboard.")
    parser.add_argument("--no-urgent-signal", dest="urgent_signal", action="store_false", help="Disable urgent signal publishing.")
    parser.add_argument("--skip-full-publish", action="store_true", help="Only publish urgent signal payloads; do not POST the heavy full dashboard.")
    parser.add_argument("--log-file", type=Path, default=Path("official_dashboard_publisher.log"))
    args = parser.parse_args()
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
    local_token = (
        env_value(env, "SNIPER_LOCAL_DASHBOARD_TOKEN")
        or env_value(env, "SNIPER_DASHBOARD_TOKEN")
        or env_value(env, "VITE_SNIPER_DASHBOARD_TOKEN")
        or env_value(env, "SNIPER_ADMIN_TOKEN")
    )
    remote_tokens = unique_tokens(
        env_value(env, "SNIPER_REMOTE_DASHBOARD_TOKEN"),
        env_value(env, "SNIPER_PUBLISHER_TOKEN"),
        env_value(env, "SNIPER_DASHBOARD_TOKEN"),
        env_value(env, "SNIPER_ADMIN_TOKEN"),
    )
    if not local_token:
        logging.error("Missing local dashboard token in env file.")
        return 2

    token = ""
    token_index = 0
    using_admin_session = False
    direct_publisher_endpoint = args.remote_url.rstrip("/").endswith("/dashboard/publish")
    rate_limit_sleep = 0.0
    last_fingerprint = ""
    last_signal_fingerprint = ""
    last_signal_attempt_at = 0.0
    urgent_backoff_until = 0.0
    urgent_failures = 0
    last_publish_at = 0.0
    last_published_payload: dict[str, Any] | None = None
    queued_locked_urgent_payload: dict[str, Any] | None = None
    full_publish_failures = 0
    full_publish_backoff_until = 0.0
    local_read_backoff_until = 0.0
    logging.info("Official dashboard publisher started: %s -> %s", args.local_url, args.remote_url)
    while True:
        try:
            if rate_limit_sleep > 0:
                time.sleep(rate_limit_sleep)
            if direct_publisher_endpoint:
                token = ""
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
                raw_local_payload = read_local_dashboard(args, local_token)
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
            if g1_blocked:
                queued_locked_urgent_payload = raw_local_payload
                logging.warning(
                    "entrada nova bloqueada — aguardando G1 da rodada %s.",
                    blocked_round or extract_round_id(raw_local_payload),
                )
            elif queued_locked_urgent_payload is not None:
                logging.info("entrada bloqueada liberada apos resolucao de G1.")
                queued_locked_urgent_payload = None

            signal_fingerprint = dashboard_signal_fingerprint(local_payload)
            signal_changed = bool(args.urgent_signal and signal_fingerprint and signal_fingerprint != last_signal_fingerprint)
            urgent_published = False
            if signal_changed:
                now_signal = time.monotonic()
                if now_signal < urgent_backoff_until:
                    time.sleep(max(0.25, args.interval))
                    continue
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
                        time.sleep(max(0.25, args.interval))
                        continue
                    except (URLError, TimeoutError, OSError, RuntimeError) as exc:
                        urgent_failures += 1
                        urgent_backoff_until = time.monotonic() + min(20.0, max(2.0, 2.0 * urgent_failures))
                        logging.warning("Urgent signal publish failed once for this signal: %s", exc)
                        time.sleep(max(0.25, args.interval))
                        continue

            if args.skip_full_publish:

                time.sleep(max(0.25, args.interval))

                continue

            if urgent_published:
                time.sleep(max(0.25, args.interval))
                continue

            fingerprint = dashboard_fingerprint(local_payload)
            now = time.monotonic()
            if now < full_publish_backoff_until:
                time.sleep(max(0.25, args.interval))
                continue
            if fingerprint == last_fingerprint and (now - last_publish_at) < max(args.interval, args.repeat_interval):
                time.sleep(max(0.25, args.interval))
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
            if "fingerprint" in locals() and fingerprint:
                last_fingerprint = fingerprint
            last_publish_at = time.monotonic()

        time.sleep(max(0.25, args.interval))


if __name__ == "__main__":
    raise SystemExit(main())






