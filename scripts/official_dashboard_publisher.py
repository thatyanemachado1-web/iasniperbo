from __future__ import annotations

import argparse
import json
import logging
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


def request_json(
    url: str,
    *,
    method: str = "GET",
    token: str = "",
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


def publish_once(args: argparse.Namespace, token: str, local_token: str) -> dict[str, Any]:
    local_payload = request_json(
        args.local_url,
        token=local_token,
        timeout=args.local_timeout,
    )
    return request_json(
        args.remote_url,
        method="POST",
        token=token,
        payload=local_payload,
        timeout=args.remote_timeout,
        ssl_context=ssl._create_unverified_context(),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Publish local live dashboard to sniperbo.com.")
    parser.add_argument("--env-file", type=Path, required=True)
    parser.add_argument("--local-url", default="http://127.0.0.1:8787/dashboard")
    parser.add_argument("--remote-base-url", default="https://sniperbo.com")
    parser.add_argument("--remote-url", default="https://sniperbo.com/dashboard")
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
    admin_email = env.get("SNIPER_ADMIN_EMAIL") or env.get("SNIPER_ADMIN_EMAILS", "").split(",", 1)[0].strip()
    admin_password = env.get("SNIPER_ADMIN_PASSWORD", "")
    local_token = env.get("SNIPER_ADMIN_TOKEN") or env.get("SNIPER_DASHBOARD_TOKEN", "")
    if not admin_email or not admin_password or not local_token:
        logging.error("Missing admin email/password or local token in env file.")
        return 2

    token = ""
    logging.info("Official dashboard publisher started: %s -> %s", args.local_url, args.remote_url)
    while True:
        try:
            if not token:
                token = admin_login(args.remote_base_url, admin_email, admin_password, args.remote_timeout)
                logging.info("Admin session created.")
            response = publish_once(args, token, local_token)
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
                token = ""
        except (TimeoutError, URLError, OSError, RuntimeError) as exc:
            logging.warning("Publish failed: %s", exc)

        time.sleep(max(0.25, args.interval))


if __name__ == "__main__":
    raise SystemExit(main())
