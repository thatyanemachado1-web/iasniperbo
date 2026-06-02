from datetime import date, datetime

from pydantic import BaseModel


class SubscriptionResponse(BaseModel):
    email: str
    plan: str
    status: str
    active: bool
    expires_at: date | None


class PaymentResponse(BaseModel):
    id: str
    transaction_id: str
    provider: str
    status: str
    plan: str
    amount: float
    currency: str
    purchase_date: date | None
    expiration_date: date | None
    paid_at: datetime | None
    created_at: datetime


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    must_change_password: bool
    plan: str
    expires_at: date | None
