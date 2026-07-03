"""Login automatico 77super — tudo em C:\\SNIPERBO."""
from __future__ import annotations

import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("ERRO: pip install playwright && python -m playwright install chromium")
    raise SystemExit(1)

from sniperbo_paths import browser_profile, project_root

GAME_URL = "https://77super.com/en/game/101803005-Bac%20Bo"
LOGIN_URL = "https://77super.com/en/login"


def read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def first_visible(page, selectors: list[str], timeout_ms: int = 3000):
    deadline = time.time() + (timeout_ms / 1000.0)
    while time.time() < deadline:
        for selector in selectors:
            try:
                locator = page.locator(selector).first
                if locator.count() > 0 and locator.is_visible():
                    return locator
            except Exception:
                continue
        time.sleep(0.25)
    return None


def click_text(page, texts: list[str]) -> bool:
    for text in texts:
        try:
            locator = page.get_by_text(text, exact=False).first
            if locator.count() > 0 and locator.is_visible():
                locator.click(timeout=3000)
                return True
        except Exception:
            continue
    return False


def fill_login(page, email: str, password: str) -> bool:
    email_box = first_visible(
        page,
        [
            'input[type="email"]',
            'input[name="email"]',
            'input[name="username"]',
            'input[autocomplete="username"]',
            'input[placeholder*="mail" i]',
        ],
        timeout_ms=8000,
    )
    if not email_box:
        return False
    pass_box = first_visible(page, ['input[type="password"]', 'input[name="password"]'], 5000)
    if not pass_box:
        return False
    email_box.fill(email)
    pass_box.fill(password)
    if click_text(page, ["Login", "Log in", "Sign in", "Entrar", "Submit"]):
        return True
    submit = first_visible(page, ['button[type="submit"]', 'input[type="submit"]'], 3000)
    if submit:
        submit.click(timeout=3000)
        return True
    return False


def dismiss_popups(page) -> None:
    click_text(page, ["Accept", "OK", "Continue", "Aceitar", "Concordo", "Close"])


def looks_logged_in(page) -> bool:
    url = page.url.lower()
    if "login" in url and "game" not in url:
        return False
    if "game" in url and "101803005" in url:
        return True
    try:
        body = page.inner_text("body", timeout=3000).lower()
    except Exception:
        return False
    return "bac bo" in body or "banker" in body or "player" in body


def main() -> int:
    root = project_root(sys.argv[1] if len(sys.argv) > 1 else None)
    env = read_env_file(root / "collector_login.local.env")
    email = env.get("COLLECTOR_LOGIN_EMAIL") or os.getenv("COLLECTOR_LOGIN_EMAIL", "")
    password = env.get("COLLECTOR_LOGIN_PASSWORD") or os.getenv("COLLECTOR_LOGIN_PASSWORD", "")
    if not email or not password:
        print("ERRO: credenciais vazias em collector_login.local.env")
        return 1

    profile = browser_profile(root)
    edge = Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")
    if not edge.exists():
        edge = Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe")
    channel = "msedge" if edge.exists() else "chrome"

    print(f"Pasta: {root}")
    print(f"Perfil Chrome: {profile}")
    print(f"Login: {email}")

    with sync_playwright() as playwright:
        context = playwright.chromium.launch_persistent_context(
            user_data_dir=str(profile),
            headless=False,
            channel=channel,
            args=["--start-maximized", "--disable-blink-features=AutomationControlled"],
            ignore_default_args=["--enable-automation"],
            viewport=None,
        )
        page = context.pages[0] if context.pages else context.new_page()
        page.goto(GAME_URL, wait_until="domcontentloaded", timeout=90000)
        time.sleep(4)
        dismiss_popups(page)

        if not looks_logged_in(page):
            if not fill_login(page, email, password):
                page.goto(LOGIN_URL, wait_until="domcontentloaded", timeout=90000)
                time.sleep(3)
                dismiss_popups(page)
                if not fill_login(page, email, password):
                    print("ERRO: login automatico falhou")
                    context.close()
                    return 1
                time.sleep(5)
                page.goto(GAME_URL, wait_until="domcontentloaded", timeout=90000)
                time.sleep(5)

        print("Aguardando Bac Bo carregar...")
        time.sleep(15)
        context.close()

    print("OK sessao salva em C:\\SNIPERBO\\browser_profile_77super")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
