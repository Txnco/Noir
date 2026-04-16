from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Literal, Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ======================
    # Core Settings
    # ======================
    PROJECT_NAME: str = "JetApi Boilerplate"
    APP_VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENV: Literal["dev", "staging", "prod"] = "dev"
    DEBUG: bool = False

    # ======================
    # Database
    # ======================
    DATABASE_URL: str

    # ======================
    # Redis
    # ======================
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_ENABLED: bool = True

    # ======================
    # Security
    # ======================
    # SECRET_KEY is used for app-level signing (e.g., idempotency keys, CSRF).
    # It is NOT used for auth — Supabase issues and validates auth JWTs.
    SECRET_KEY: str = Field(..., repr=False)
    SUPABASE_JWT_SECRET: str = Field(..., repr=False)
    SUPABASE_URL: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = Field(default=None, repr=False)

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_strength(cls, v):
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 chars")
        return v

    # ======================
    # RBAC Settings
    # ======================
    ENABLE_RBAC: bool = True

    # ======================
    # Rate Limiting
    # ======================
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60

    # ======================
    # Caching
    # ======================
    CACHE_ENABLED: bool = True
    CACHE_MAX_SIZE: int = 1000
    CACHE_DEFAULT_TTL: int = 300

    # ======================
    # Background Jobs
    # ======================
    WORKER_COUNT: int = 4
    JOB_QUEUE_MAX_SIZE: int = 10000

    # ======================
    # CORS
    # ======================
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # ======================
    # Email (optional — Supabase sends auth emails itself)
    # ======================
    EMAIL_FROM: Optional[str] = None
    EMAIL_FROM_NAME: Optional[str] = None
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = Field(default=None, repr=False)
    SMTP_TLS: bool = True
    SMTP_SSL: bool = False

    AWS_SES_ENABLED: bool = False
    AWS_SES_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: Optional[str] = Field(default=None, repr=False)
    AWS_SECRET_ACCESS_KEY: Optional[str] = Field(default=None, repr=False)
    AWS_SES_CONFIGURATION_SET: Optional[str] = None

    # ======================
    # Frontend URL
    # ======================
    FRONTEND_URL: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def async_database_url(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+asyncpg://", 1)
        if url.startswith("sqlite:///"):
            return url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
        return url

    @property
    def sync_database_url(self) -> str:
        url = self.DATABASE_URL
        url = url.replace("postgresql+asyncpg://", "postgresql://")
        url = url.replace("sqlite+aiosqlite:///", "sqlite:///")
        return url

    @property
    def is_sqlite(self) -> bool:
        return "sqlite" in self.DATABASE_URL

    @property
    def is_production(self) -> bool:
        return self.ENV == "prod"


settings = Settings()
