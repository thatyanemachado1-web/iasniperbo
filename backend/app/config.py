from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PlanId = Literal["free", "mensal", "trimestral", "anual"]
HublaEnvironment = Literal["sandbox", "production"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = Field(default="sqlite:///./sniperbo.db", alias="DATABASE_URL")
    app_jwt_secret: str = Field(alias="APP_JWT_SECRET")
    app_jwt_minutes: int = Field(default=720, alias="APP_JWT_MINUTES")
    frontend_login_url: str = Field(default="https://sniperbo.com/login", alias="FRONTEND_LOGIN_URL")

    hubla_environment: HublaEnvironment = Field(default="production", alias="HUBLA_ENVIRONMENT")
    hubla_webhook_token: str = Field(default="", alias="HUBLA_WEBHOOK_TOKEN")
    hubla_sandbox_webhook_token: str = Field(default="", alias="HUBLA_SANDBOX_WEBHOOK_TOKEN")
    hubla_production_webhook_token: str = Field(default="", alias="HUBLA_PRODUCTION_WEBHOOK_TOKEN")
    hubla_webhook_hmac_secret: str = Field(default="", alias="HUBLA_WEBHOOK_HMAC_SECRET")
    hubla_default_plan: PlanId = Field(default="mensal", alias="HUBLA_DEFAULT_PLAN")
    hubla_mensal_product_ids: str = Field(default="", alias="HUBLA_MENSAL_PRODUCT_IDS")
    hubla_trimestral_product_ids: str = Field(default="", alias="HUBLA_TRIMESTRAL_PRODUCT_IDS")
    hubla_anual_product_ids: str = Field(default="", alias="HUBLA_ANUAL_PRODUCT_IDS")
    hubla_vip_product_ids: str = Field(default="", alias="HUBLA_VIP_PRODUCT_IDS")
    hubla_premium_product_ids: str = Field(default="", alias="HUBLA_PREMIUM_PRODUCT_IDS")

    plan_mensal_days: int = Field(default=30, alias="PLAN_MENSAL_DAYS")
    plan_trimestral_days: int = Field(default=90, alias="PLAN_TRIMESTRAL_DAYS")
    plan_anual_days: int = Field(default=365, alias="PLAN_ANUAL_DAYS")

    email_enabled: bool = Field(default=True, alias="EMAIL_ENABLED")
    smtp_host: str = Field(default="", alias="SMTP_HOST")
    smtp_port: int = Field(default=587, alias="SMTP_PORT")
    smtp_user: str = Field(default="", alias="SMTP_USER")
    smtp_password: str = Field(default="", alias="SMTP_PASSWORD")
    smtp_from: str = Field(default="", alias="SMTP_FROM")
    smtp_tls: bool = Field(default=True, alias="SMTP_TLS")

    @field_validator("app_jwt_secret")
    @classmethod
    def validate_app_jwt_secret(cls, value: str) -> str:
        secret = value.strip().strip("\"'")
        weak_values = {
            "change" + "-me",
            "changeme",
            "secret",
            "jwt-secret",
            "app-jwt-secret",
            "sniperbo",
            "sniper-bo",
            "replace-with-at-least-32-random-characters",
        }
        if not secret:
            raise ValueError("APP_JWT_SECRET is required")
        if secret.lower() in weak_values:
            raise ValueError("APP_JWT_SECRET cannot use a default or example value")
        if len(secret) < 32:
            raise ValueError("APP_JWT_SECRET must be at least 32 characters")
        return secret

    @property
    def effective_hubla_webhook_token(self) -> str:
        if self.hubla_environment == "sandbox":
            return self.hubla_sandbox_webhook_token or self.hubla_webhook_token
        return self.hubla_production_webhook_token or self.hubla_webhook_token

    @property
    def hubla_mensal_ids(self) -> set[str]:
        return parse_csv(self.hubla_mensal_product_ids or self.hubla_vip_product_ids)

    @property
    def hubla_trimestral_ids(self) -> set[str]:
        return parse_csv(self.hubla_trimestral_product_ids)

    @property
    def hubla_anual_ids(self) -> set[str]:
        return parse_csv(self.hubla_anual_product_ids or self.hubla_premium_product_ids)

    def plan_days(self, plan: PlanId) -> int:
        if plan == "anual":
            return max(1, self.plan_anual_days)
        if plan == "trimestral":
            return max(1, self.plan_trimestral_days)
        if plan == "mensal":
            return max(1, self.plan_mensal_days)
        return 7


def parse_csv(value: str) -> set[str]:
    return {item.strip() for item in value.replace(";", ",").split(",") if item.strip()}


@lru_cache
def get_settings() -> Settings:
    return Settings()
