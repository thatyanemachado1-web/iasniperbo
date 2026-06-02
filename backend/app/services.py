import json
import logging
import secrets
import smtplib
import uuid
from datetime import date, datetime, timedelta
from email.message import EmailMessage
from typing import Any

from fastapi import Request
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from .config import PlanId, Settings
from .models import Payment, Subscription, User, WebhookLog
from .security import hash_password, verify_hubla_webhook

logger = logging.getLogger("sniperbo.hubla")

ACCEPTED_STATUSES = {"paid", "refunded", "chargeback", "canceled"}


def process_hubla_webhook(
    *,
    db: Session,
    request: Request,
    payload: dict[str, Any],
    raw_body: bytes,
    settings: Settings,
) -> dict[str, Any]:
    verify_hubla_webhook(request, raw_body, settings)
    event = normalize_hubla_payload(payload, request, settings)
    log_webhook(db, request, payload, event, settings, "received", "Webhook Hubla recebido.")

    if not event["email"] or not event["status"]:
        log_webhook(db, request, payload, event, settings, "ignored", "Payload Hubla incompleto.")
        db.commit()
        return {"ok": True, "ignored": True, "reason": "payload_incompleto"}

    if event["status"] not in ACCEPTED_STATUSES:
        log_webhook(db, request, payload, event, settings, "ignored", f"Status ignorado: {event['status']}.")
        db.commit()
        return {"ok": True, "ignored": True, "status": event["status"]}

    user, user_created = get_or_create_user(db, event)

    if event["status"] == "paid":
        should_create_temporary_password = user_created or not user.password_hash
        temporary_password = generate_temporary_password() if should_create_temporary_password else ""
        if should_create_temporary_password:
            user.password_hash = hash_password(temporary_password)
            user.temporary_password_must_change = True
        user.is_active = True

        subscription = activate_subscription(db, user, event, settings)
        payment = register_payment(db, user, subscription, event, payload)
        email_result = send_welcome_email(user.email, temporary_password, settings)
        log_webhook(
            db,
            request,
            payload,
            event,
            settings,
            "activated",
            f"Acesso liberado. user_created={user_created}; temporary_password_created={should_create_temporary_password}; email_sent={email_result['sent']}; email_detail={email_result['detail']}",
        )
        db.commit()
        logger.info("Hubla paid processed for %s transaction=%s", user.email, event["transaction_id"])
        return {
            "ok": True,
            "provider": "hubla",
            "environment": settings.hubla_environment,
            "status": "paid",
            "activated": True,
            "user_created": user_created,
            "email_sent": email_result["sent"],
            "payment_id": payment.id,
        }

    subscription = deactivate_subscription(db, user, event)
    payment = register_payment(db, user, subscription, event, payload)
    log_webhook(db, request, payload, event, settings, "deactivated", f"Acesso desativado por status {event['status']}.")
    db.commit()
    logger.warning("Hubla reversed for %s status=%s transaction=%s", user.email, event["status"], event["transaction_id"])
    return {
        "ok": True,
        "provider": "hubla",
        "environment": settings.hubla_environment,
        "status": event["status"],
        "deactivated": True,
        "payment_id": payment.id,
    }


def normalize_hubla_payload(payload: dict[str, Any], request: Request, settings: Settings) -> dict[str, Any]:
    event = as_dict(payload.get("event"))
    user = as_dict(event.get("user"))
    subscription = as_dict(event.get("subscription"))
    invoice = as_dict(event.get("invoice"))
    payment = as_dict(event.get("payment"))
    product = as_dict(event.get("product"))

    first_name = read_string(user, "firstName") or read_string(user, "first_name")
    last_name = read_string(user, "lastName") or read_string(user, "last_name")
    full_name = f"{first_name} {last_name}".strip() or read_string(user, "name")
    product_id = read_string(product, "id") or first_product_id(event)
    product_name = read_string(product, "name") or first_product_name(event)
    plan = resolve_plan(product_id, product_name, settings)
    status = normalize_status(payload)
    purchase_date = (
        parse_date(read_string(invoice, "saleDate"))
        or parse_date(read_string(payment, "paidAt"))
        or parse_date(read_string(subscription, "activatedAt"))
        or parse_date(read_string(subscription, "createdAt"))
        or date.today()
    )
    expiration_date = (
        parse_date(read_string(subscription, "expiresAt"))
        or parse_date(read_string(subscription, "currentPeriodEnd"))
        or parse_date(read_string(subscription, "current_period_end"))
        or purchase_date + timedelta(days=settings.plan_days(plan))
    )
    transaction_id = (
        read_string(invoice, "id")
        or read_string(payment, "id")
        or read_string(payload, "transaction_id")
        or read_string(payload, "transactionId")
        or request.headers.get("x-hubla-idempotency", "")
        or str(uuid.uuid4())
    )

    return {
        "email": (
            read_string(user, "email")
            or read_string(subscription, "email")
            or read_string(invoice, "email")
            or read_string(payment, "email")
            or read_string(payload, "email")
        ).lower(),
        "full_name": full_name,
        "phone": read_string(user, "phone") or read_string(subscription, "phone"),
        "status": status,
        "plan": plan,
        "product_id": product_id,
        "product_name": product_name,
        "subscription_id": read_string(subscription, "id"),
        "transaction_id": transaction_id,
        "payment_id": transaction_id,
        "event_id": request.headers.get("x-hubla-idempotency", "") or read_string(payload, "id") or transaction_id,
        "event_type": read_string(payload, "type"),
        "amount": read_amount(invoice, payment),
        "currency": read_string(invoice, "currency") or read_string(payment, "currency") or "BRL",
        "purchase_date": purchase_date,
        "expiration_date": expiration_date,
        "paid_at": parse_datetime(
            read_string(invoice, "saleDate")
            or read_string(payment, "paidAt")
            or read_string(subscription, "activatedAt")
        ),
    }


def get_or_create_user(db: Session, event: dict[str, Any]) -> tuple[User, bool]:
    email = event["email"]
    user = db.scalar(select(User).where(User.email == email))
    if user:
        user.full_name = event["full_name"] or user.full_name
        user.phone = event["phone"] or user.phone
        user.is_active = True
        return user, False

    user = User(
        email=email,
        full_name=event["full_name"] or email.split("@", 1)[0],
        phone=event["phone"] or "",
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user, True


def activate_subscription(db: Session, user: User, event: dict[str, Any], settings: Settings) -> Subscription:
    subscription = find_subscription(db, user.email, event)
    if not subscription:
        provider_subscription_id = event["subscription_id"] or str(uuid.uuid4())
        subscription = Subscription(
            id=provider_subscription_id,
            user_id=user.id,
            email=user.email,
            provider="hubla",
            provider_subscription_id=provider_subscription_id,
        )
        db.add(subscription)
    subscription.plan = event["plan"] or settings.hubla_default_plan
    subscription.status = "active"
    subscription.provider_product_id = event["product_id"] or ""
    subscription.transaction_id = event["transaction_id"] or ""
    subscription.starts_at = event["purchase_date"]
    subscription.expires_at = event["expiration_date"]
    return subscription


def deactivate_subscription(db: Session, user: User, event: dict[str, Any]) -> Subscription:
    subscription = find_subscription(db, user.email, event)
    if not subscription:
        provider_subscription_id = event["subscription_id"] or str(uuid.uuid4())
        subscription = Subscription(
            id=provider_subscription_id,
            user_id=user.id,
            email=user.email,
            provider="hubla",
            provider_subscription_id=provider_subscription_id,
        )
        db.add(subscription)
    subscription.plan = event["plan"] or subscription.plan or "mensal"
    subscription.status = "cancelled"
    subscription.transaction_id = event["transaction_id"] or subscription.transaction_id
    subscription.expires_at = date.today()
    return subscription


def register_payment(
    db: Session,
    user: User,
    subscription: Subscription,
    event: dict[str, Any],
    raw_payload: dict[str, Any],
) -> Payment:
    payment = db.scalar(
        select(Payment).where(Payment.provider == "hubla", Payment.provider_payment_id == event["transaction_id"])
    )
    if not payment:
        payment = Payment(
            id=event["event_id"] or str(uuid.uuid4()),
            user_id=user.id,
            subscription_id=subscription.id,
            email=user.email,
            provider="hubla",
            provider_payment_id=event["transaction_id"],
        )
        db.add(payment)
    payment.plan = event["plan"]
    payment.status = event["status"]
    payment.amount = event["amount"]
    payment.currency = event["currency"]
    payment.provider_event_id = event["event_id"] or ""
    payment.transaction_id = event["transaction_id"] or ""
    payment.purchase_date = event["purchase_date"]
    payment.expiration_date = event["expiration_date"]
    payment.raw_payload = json.dumps(raw_payload, ensure_ascii=False)
    payment.paid_at = event["paid_at"] if event["status"] == "paid" else None
    return payment


def find_subscription(db: Session, email: str, event: dict[str, Any]) -> Subscription | None:
    subscription_id = event["subscription_id"]
    if subscription_id:
        found = db.scalar(select(Subscription).where(Subscription.provider == "hubla", Subscription.id == subscription_id))
        if found:
            return found
    return db.scalar(
        select(Subscription)
        .where(Subscription.email == email, Subscription.provider == "hubla")
        .order_by(desc(Subscription.updated_at))
    )


def resolve_plan(product_id: str, product_name: str, settings: Settings) -> PlanId:
    lower_name = product_name.lower()
    if product_id in settings.hubla_anual_ids or any(word in lower_name for word in ["anual", "annual", "ano", "year"]):
        return "anual"
    if product_id in settings.hubla_trimestral_ids or any(word in lower_name for word in ["trimestral", "quarter", "3 meses"]):
        return "trimestral"
    if product_id in settings.hubla_mensal_ids or any(word in lower_name for word in ["mensal", "monthly", "mes", "vip"]):
        return "mensal"
    if "free" in lower_name or "gratis" in lower_name:
        return "free"
    return settings.hubla_default_plan


def normalize_status(payload: dict[str, Any]) -> str:
    event = as_dict(payload.get("event"))
    subscription = as_dict(event.get("subscription"))
    invoice = as_dict(event.get("invoice"))
    payment = as_dict(event.get("payment"))
    text = (
        read_string(payload, "status")
        or read_string(invoice, "status")
        or read_string(payment, "status")
        or read_string(subscription, "status")
        or read_string(payload, "type")
    ).lower().replace(".", "_")

    if text in {"paid", "invoice_paid", "payment_paid", "subscription_activated", "active"}:
        return "paid"
    if text in {"refunded", "invoice_refunded", "refund_succeeded"}:
        return "refunded"
    if text in {"chargeback", "charged_back", "invoice_chargeback"}:
        return "chargeback"
    if text in {"canceled", "cancelled", "subscription_deactivated", "deactivated", "inactive"}:
        return "canceled"
    return text


def send_welcome_email(email: str, temporary_password: str, settings: Settings) -> dict[str, Any]:
    if not settings.email_enabled:
        return {"sent": False, "detail": "email_disabled"}
    if not settings.smtp_host or not settings.smtp_from:
        logger.warning("SMTP not configured; welcome email not sent to %s", email)
        return {"sent": False, "detail": "smtp_not_configured"}

    message = EmailMessage()
    message["Subject"] = "Bem-vindo ao Sniper Bo IA"
    message["From"] = settings.smtp_from
    message["To"] = email
    if temporary_password:
        body_lines = [
            "Seu acesso foi liberado.",
            f"Email: {email}",
            f"Senha temporaria: {temporary_password}",
            "",
            f"Acesse: {settings.frontend_login_url}",
            "",
            "Por seguranca, altere sua senha apos o primeiro acesso.",
        ]
    else:
        body_lines = [
            "Seu acesso foi liberado.",
            f"Email: {email}",
            "Use a mesma senha que voce cadastrou no app.",
            "",
            f"Acesse: {settings.frontend_login_url}",
        ]

    message.set_content("\n".join(body_lines))

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=12) as smtp:
            if settings.smtp_tls:
                smtp.starttls()
            if settings.smtp_user:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)
        return {"sent": True, "detail": "sent"}
    except Exception as exc:  # SMTP errors vary by provider.
        logger.exception("Failed to send welcome email to %s", email)
        return {"sent": False, "detail": exc.__class__.__name__}


def log_webhook(
    db: Session,
    request: Request,
    payload: dict[str, Any],
    event: dict[str, Any],
    settings: Settings,
    status: str,
    message: str,
) -> None:
    db.add(
        WebhookLog(
            provider="hubla",
            endpoint=request.url.path,
            environment=settings.hubla_environment,
            event_type=str(event.get("event_type") or payload.get("type") or ""),
            status=status,
            email=str(event.get("email") or ""),
            transaction_id=str(event.get("transaction_id") or ""),
            message=message,
            raw_payload=json.dumps(payload, ensure_ascii=False),
        )
    )


def generate_temporary_password() -> str:
    return secrets.token_urlsafe(12)


def as_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def read_string(source: dict[str, Any], key: str) -> str:
    value = source.get(key)
    return str(value).strip() if value is not None else ""


def first_product_id(event: dict[str, Any]) -> str:
    products = event.get("products")
    if not isinstance(products, list):
        return ""
    for product in products:
        product_id = read_string(as_dict(product), "id")
        if product_id:
            return product_id
    return ""


def first_product_name(event: dict[str, Any]) -> str:
    products = event.get("products")
    if not isinstance(products, list):
        return ""
    for product in products:
        product_name = read_string(as_dict(product), "name")
        if product_name:
            return product_name
    return ""


def read_amount(invoice: dict[str, Any], payment: dict[str, Any]) -> float:
    amount = as_dict(invoice.get("amount"))
    candidates = [
        (amount.get("totalCents"), True),
        (amount.get("subtotalCents"), True),
        (amount.get("total"), False),
        (invoice.get("totalCents"), True),
        (invoice.get("total"), False),
        (invoice.get("amount"), False),
        (payment.get("amount"), False),
        (payment.get("total"), False),
    ]
    for value, is_cents in candidates:
        try:
            number = float(str(value).replace(",", "."))
        except (TypeError, ValueError):
            continue
        if is_cents:
            return round(number / 100, 2)
        return number
    return 0.0


def parse_date(value: str) -> date | None:
    parsed = parse_datetime(value)
    return parsed.date() if parsed else None


def parse_datetime(value: str) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def subscription_is_active(subscription: Subscription | None) -> bool:
    return bool(subscription and subscription.status == "active" and subscription.expires_at and subscription.expires_at >= date.today())
