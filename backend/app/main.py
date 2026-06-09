import json

from fastapi import Depends, FastAPI, HTTPException, Request, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from .config import Settings, get_settings
from .database import get_db, init_db
from .models import Payment, Subscription, User
from .schemas import LoginRequest, LoginResponse, PaymentResponse, SubscriptionResponse
from .security import (
    get_current_email,
    hash_password,
    issue_access_token,
    password_hash_needs_upgrade,
    require_active_subscription,
    verify_password,
)
from .services import process_hubla_webhook, subscription_is_active

app = FastAPI(title="Sniper BO IA API", version="1.0.0")


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.post("/api/webhook/hubla")
@app.post("/api/webhooks/hubla")
async def hubla_webhook(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    raw_body = await request.body()
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON") from exc
    return process_hubla_webhook(db=db, request=request, payload=payload, raw_body=raw_body, settings=settings)


@app.post("/api/auth/login", response_model=LoginResponse)
def login(
    body: LoginRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> LoginResponse:
    email = body.email.strip().lower()
    user = db.scalar(select(User).where(User.email == email))
    if not user or not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email ou senha invalidos")
    if password_hash_needs_upgrade(user.password_hash):
        user.password_hash = hash_password(body.password)
        db.add(user)
        db.commit()

    subscription = db.scalar(
        select(Subscription)
        .where(Subscription.email == email)
        .order_by(desc(Subscription.updated_at))
    )
    return LoginResponse(
        access_token=issue_access_token(email, settings),
        must_change_password=user.temporary_password_must_change,
        plan=subscription.plan if subscription else "free",
        expires_at=subscription.expires_at if subscription else None,
    )


@app.get("/api/me/subscription", response_model=SubscriptionResponse)
def my_subscription(
    email: str = Depends(get_current_email),
    db: Session = Depends(get_db),
) -> SubscriptionResponse:
    subscription = db.scalar(
        select(Subscription)
        .where(Subscription.email == email)
        .order_by(desc(Subscription.updated_at))
    )
    active = subscription_is_active(subscription)
    return SubscriptionResponse(
        email=email,
        plan=subscription.plan if subscription else "free",
        status=subscription.status if subscription else "free",
        active=active,
        expires_at=subscription.expires_at if subscription else None,
    )


@app.get("/api/payments/history", response_model=list[PaymentResponse])
def payment_history(
    email: str = Depends(get_current_email),
    db: Session = Depends(get_db),
) -> list[PaymentResponse]:
    payments = db.scalars(
        select(Payment)
        .where(Payment.email == email)
        .order_by(desc(Payment.created_at))
        .limit(50)
    ).all()
    return [
        PaymentResponse(
            id=payment.id,
            transaction_id=payment.transaction_id,
            provider=payment.provider,
            status=payment.status,
            plan=payment.plan,
            amount=payment.amount,
            currency=payment.currency,
            purchase_date=payment.purchase_date,
            expiration_date=payment.expiration_date,
            paid_at=payment.paid_at,
            created_at=payment.created_at,
        )
        for payment in payments
    ]


@app.get("/api/analyses/live")
def protected_live_analyses(user: User = Depends(require_active_subscription)) -> dict:
    return {
        "ok": True,
        "email": user.email,
        "message": "Assinatura ativa. Conecte aqui o motor de sinais real.",
    }
