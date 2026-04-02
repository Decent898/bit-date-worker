from pathlib import Path
from typing import Optional

from pydantic import EmailStr
from pydantic_settings import BaseSettings, SettingsConfigDict


ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(ENV_FILE), env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "Slow Social Matching"
    APP_ENV: str = "dev"
    SECRET_KEY: str = "replace_me"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/slow_social"
    REDIS_URL: str = "redis://localhost:6379/0"

    SMTP_HOST: str = "smtp.example.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = "no-reply@example.com"
    SMTP_PASSWORD: str = "replace_me"
    SMTP_FROM: EmailStr = "no-reply@example.com"
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False

    EMAIL_ADDR: Optional[EmailStr] = None
    EMAIL_AUTH_CODE: Optional[str] = None
    EMAIL_DELIVERY_MODE: str = "smtp"
    EMAIL_OUTBOX_FILE: str = "./dev_outbox.log"

    EDU_EMAIL_REGEX: str = r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.edu\\.cn$"

    LLM_BASE_URL: str = ""
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "local-model"

    DEEPSEEK_BASE_URL: str = "https://api.deepseek.com/v1"
    DEEPSEEK_API_KEY: str = ""
    DEEPSEEK_MODEL: str = "deepseek-chat"


settings = Settings()
