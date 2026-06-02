import hashlib
import hmac
import os
from datetime import date, datetime, timedelta, timezone

import jwt
from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from .config import Settings, get_settings
from .database import get_db
from .models import Subscription, User


def verify_hubla_webhook(request: Request, raw_body: bytes, settings: Settings) -> None:
    expected_token = clean_secret(settings.effective_hubla_webhook_token())
    incoming_token = request.headers.get("x-hubla-token", "")
    if not expected_token or not hmac.compare_digest(expected_token, incoming_token.strip()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Hubla webhook token")

    hmac_secret = clean_secret(settings.hubla_webhook_hmac_secret)
    if not hmac_secret:
        return

    incoming_signature = (
        request.headers.get("x-hubla-signature")
        or request.headers.get("x-signature")
        or ""
    ).replace("sha256=", "").strip()
    expected_signature = hmac.new(hmac_secret.encode(), raw_body, hashlib.sha256).hexdigest()
    if not incoming_signature or not hmac.compare_digest(expected_signature, incoming_signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Hubla webhook signature")


def clean_secret(value: str) -> str:
    raw = value.strip().strip("\"'")
    prefixes = ("Bearer ", "Token ", "HUBLA_WEBHOOK_TOKEN=", "HUBLA_WEBHOOK_HMAC_SECRET=")
    changed = True
    while changed:
        changed = False
        for prefix in prefixes:
            if raw.lower().startswith(prefix.lower()):
                raw = raw[len(prefix):].strip().strip("\"'")
                changed = True
    return "".join(raw.split())


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 120_000)
    return f"pbkdf2_sha256$120000${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, iterations_text, salt_hex, digest_hex = stored_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        iterations = int(iterations_text)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(digest_hex)
    except (ValueError, TypeError):
        return False
    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(expected, actual)


def issue_access_token(email: str, settings: Settings) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": email.lower(),
        "email": email.lower(),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.app_jwt_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.app_jwt_secret, algorithm="HS256")


def get_current_email(
    authorization: str = Header(default=""),
    settings: Settings = Depends(get_settings),
) -> str:
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token")
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, settings.app_jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    email = str(payload.get("email") or payload.get("sub") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return email


def require_active_subscription(
    email: str = Depends(get_current_email),
    db: Session = Depends(get_db),
) -> User:
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User not found")

    subscription = db.scalar(
        select(Subscription)
        .where(Subscription.email == email, Subscription.status == "active")
        .order_by(desc(Subscription.updated_at))
    )
    if not subscription or not subscription.expires_at or subscription.expires_at < date.today():
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Active subscription required")
    return user
