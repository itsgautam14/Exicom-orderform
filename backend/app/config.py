"""Application configuration loaded from environment variables."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # PostgreSQL
    database_url: str = "postgresql+psycopg://exicom:exicom@localhost:5432/exicom_orders"

    # CORS — the Next.js dev origin
    frontend_origin: str = "http://localhost:3000"

    # Misc
    app_name: str = "Exicom Order Form Service"

    # Password for the Catalog / Pricing admin area (server-side only).
    # Legacy shared-password gate — superseded by per-person login/OTP below,
    # kept only so old dependencies that still reference it don't crash.
    admin_password: str = "Admin#@!2468"

    # ---- Auth (JWT) -----------------------------------------------------
    # HS256 signing secret for access tokens. MUST be overridden in production —
    # change it in .env to a long random string (e.g. `openssl rand -hex 32`).
    jwt_secret: str = "change-me-dev-only-not-secure"
    jwt_algorithm: str = "HS256"
    jwt_expires_minutes: int = 60 * 12  # 12 hours

    # OTP settings
    otp_expires_minutes: int = 10
    otp_max_requests_per_window: int = 5
    otp_request_window_minutes: int = 15

    # ---- SMTP (generic — any provider: Gmail, Outlook/365, org mailbox) --
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    from_email: str = ""

    # ---- Default admin, seeded once on first boot if `users` is empty ---
    default_admin_username: str = "admin"
    default_admin_email: str = ""
    default_admin_password: str = ""
    default_admin_full_name: str = "Administrator"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
