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
    admin_password: str = "Admin#@!2468"

    # SMTP for login OTP emails. Leave smtp_host blank to disable actual sending —
    # the OTP is then just printed to the server log, so the flow stays testable
    # before a real mailbox/service is configured.
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "Exicom Quote Form <no-reply@exicom.in>"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
