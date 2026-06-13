from __future__ import annotations

import argparse
import json
import logging
import os
import ssl
import time
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


USER_AGENT = "Mozilla/5.0 SNIPERBO-Official-Publisher/1.0"


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


def request_json(
    url: str,
    *,
    method: str = "GET",
    token: str = "",
    extra_headers: dict[str, str] | None = None,
    payload: Any | None = None,
    timeout: float = 8.0,
    ssl_context: ssl.SSLContext | None = None,
) -> Any:
    data = None
    headers = {
        "Accept": "application/json",
        "Cache-Control": "no-store",
        "User-Agent": USER_AGENT,
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if extra_headers:
        headers.update({key: value for key, value in extra_headers.items() if value})
    if payload is not None:
        data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = Request(url, data=data, headers=headers, method=method)
    with urlopen(request, timeout=timeout, context=ssl_context) as response:
        body = response.read().decode("utf-8", errors="replace")
    return json.loads(body) if body else {}


def admin_login(remote_base_url: str, email: str, password: str, timeout: float) -> str:
    response = request_json(
        f"{remote_base_url.rstrip('/')}/admin/login",
        method="POST",
        payload={"email": email, "password": password},
        timeout=timeout,
        ssl_context=ssl._create_unverified_context(),
    )
    token = str(response.get("token") or "")
    if not token:
        raise RuntimeError("admin login did not return a token")
    return token


def publish_once(
    args: argparse.Namespace,
    token: str,
    local_token: str,
    admin_email: str,
    admin_password: str,
) -> dict[str, Any]:
    local_payload = request_json(
        args.local_url,
        token=local_token,
        timeout=args.local_timeout,
    )
    publisher_headers = {
        "x-sniper-admin-email": admin_email,
        "x-sniper-admin-password": admin_password,
    }
    return request_json(
        args.remote_url,
        method="POST",
        token=token,
        extra_headers=publisher_headers,
        payload=local_payload,
        timeout=args.remote_timeout,
        ssl_context=ssl._create_unverified_context(),
    )


def main() -> int:
    default_signals_port = os.getenv("SIGNALS_API_PORT") or os.getenv("VITE_SIGNALS_API_PORT") or "8787"
    default_local_url = os.getenv("SNIPER_LOCAL_DASHBOARD_URL") or f"http://127.0.0.1:{default_signals_port}/dashboard"
    parser = argparse.ArgumentParser(description="Publish local live dashboard to sniperbo.com.")
    parser.add_argument("--env-file", type=Path, required=True)
    parser.add_argument("--local-url", default=default_local_url)
    parser.add_argument("--remote-base-url", default="https://sniperbo.com")
    parser.add_argument("--remote-url", default="https://sniperbo.com/dashboard/publish")
    parser.add_argument("--interval", type=float, default=0.7)
    parser.add_argument("--local-timeout", type=float, default=2.0)
    parser.add_argument("--remote-timeout", type=float, default=6.0)
    parser.add_argument("--log-file", type=Path, default=Path("official_dashboard_publisher.log"))
    args = parser.parse_args()

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
        or env_value(env, "SNIPER_ADMIN_TOKEN")
        or env_value(env, "SNIPER_DASHBOARD_TOKEN")
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
    logging.info("Official dashboard publisher started: %s -> %s", args.local_url, args.remote_url)
    while True:
        try:
            if not token:
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
            response = publish_once(args, token, local_token, admin_email, admin_password)
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
        except HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")[:180]
            logging.warning("Publish HTTP %s: %s", exc.code, body)
            if exc.code in {401, 403}:
                if using_admin_session:
                    token_index = 0
                token = ""
                using_admin_session = False
        except (TimeoutError, URLError, OSError, RuntimeError) as exc:
            logging.warning("Publish failed: %s", exc)

        time.sleep(max(0.25, args.interval))


if __name__ == "__main__":
    raise SystemExit(main())
