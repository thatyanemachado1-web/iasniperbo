import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def new_id() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    phone: Mapped[str] = mapped_column(String(64), default="", nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    temporary_password_must_change: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="user")
    payments: Mapped[list["Payment"]] = relationship(back_populates="user")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    plan: Mapped[str] = mapped_column(String(32), default="mensal", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    provider: Mapped[str] = mapped_column(String(32), default="hubla", nullable=False)
    provider_subscription_id: Mapped[str] = mapped_column(String(128), default="", nullable=False)
    provider_product_id: Mapped[str] = mapped_column(String(128), default="", nullable=False)
    transaction_id: Mapped[str] = mapped_column(String(128), default="", nullable=False)
    starts_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    expires_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user: Mapped[User] = relationship(back_populates="subscriptions")

    __table_args__ = (
        Index("subscriptions_email_status_idx", "email", "status"),
        UniqueConstraint("provider", "provider_subscription_id", name="subscriptions_provider_subscription_uidx"),
    )


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    subscription_id: Mapped[str | None] = mapped_column(String(64), ForeignKey("subscriptions.id"), nullable=True)
    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    plan: Mapped[str] = mapped_column(String(32), default="mensal", nullable=False)
    provider: Mapped[str] = mapped_column(String(32), default="hubla", nullable=False)
    provider_payment_id: Mapped[str] = mapped_column(String(128), default="", nullable=False)
    provider_event_id: Mapped[str] = mapped_column(String(128), default="", nullable=False)
    transaction_id: Mapped[str] = mapped_column(String(128), default="", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    amount: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    currency: Mapped[str] = mapped_column(String(8), default="BRL", nullable=False)
    raw_payload: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expiration_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)

    user: Mapped[User] = relationship(back_populates="payments")

    __table_args__ = (
        UniqueConstraint("provider", "provider_payment_id", name="payments_provider_payment_uidx"),
        Index("payments_email_created_idx", "email", "created_at"),
    )


class WebhookLog(Base):
    __tablename__ = "webhook_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    provider: Mapped[str] = mapped_column(String(32), default="hubla", nullable=False)
    endpoint: Mapped[str] = mapped_column(String(128), default="", nullable=False)
    environment: Mapped[str] = mapped_column(String(32), default="production", nullable=False)
    event_type: Mapped[str] = mapped_column(String(128), default="", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="", nullable=False)
    email: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    transaction_id: Mapped[str] = mapped_column(String(128), default="", nullable=False)
    message: Mapped[str] = mapped_column(Text, default="", nullable=False)
    raw_payload: Mapped[str] = mapped_column(Text, default="{}", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=False)

    __table_args__ = (
        Index("webhook_logs_provider_created_idx", "provider", "created_at"),
        Index("webhook_logs_email_created_idx", "email", "created_at"),
    )
