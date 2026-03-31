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
    # Security - General
    # ======================
    SECRET_KEY: str = Field(..., repr=False)

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_strength(cls, v):
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 chars")
        return v

    # ======================
    # Authentication Settings
    # ======================
    ENABLE_LOCAL_AUTH: bool = True
    ENABLE_OAUTH2: bool = False
    OAUTH2_AUTO_PROVISION: bool = True
    OAUTH2_DEFAULT_ROLE: str = "user"
    REQUIRE_EMAIL_VERIFICATION: bool = False

    # ======================
    # JWT Settings
    # ======================
    JWT_SECRET_KEY: Optional[str] = Field(default=None, repr=False)
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ======================
    # OAuth2 Settings (External Providers)
    # ======================
    OAUTH2_ISSUER: Optional[str] = None
    OAUTH2_AUDIENCE: Optional[str] = None
    OAUTH2_JWKS_URL: Optional[str] = None
    OAUTH2_JWKS_JSON: Optional[str] = None

    # ======================
    # RBAC Settings
    # ======================
    ENABLE_RBAC: bool = True

    # ======================
    # Password Policy
    # ======================
    PASSWORD_MIN_LENGTH: int = 8
    PASSWORD_REQUIRE_UPPERCASE: bool = True
    PASSWORD_REQUIRE_LOWERCASE: bool = True
    PASSWORD_REQUIRE_DIGIT: bool = True
    PASSWORD_REQUIRE_SPECIAL: bool = False

    # ======================
    # Rate Limiting
    # ======================
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60
    AUTH_RATE_LIMIT_ATTEMPTS: int = 5
    AUTH_RATE_LIMIT_WINDOW: int = 300

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
    # Email - General
    # ======================
    EMAIL_FROM: Optional[str] = None
    EMAIL_FROM_NAME: Optional[str] = None

    # ======================
    # Email - SMTP Provider
    # ======================
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = Field(default=None, repr=False)
    SMTP_TLS: bool = True
    SMTP_SSL: bool = False

    # ======================
    # Email - AWS SES Provider
    # ======================
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
    def jwt_secret(self) -> str:
        """Get JWT secret. Requires explicit key in production."""
        if self.JWT_SECRET_KEY:
            return self.JWT_SECRET_KEY
        if self.DEBUG or self.ENV == "dev":
            return self.SECRET_KEY
        raise ValueError(
            "JWT_SECRET_KEY must be set in production. "
            "Generate with: python -c \"import secrets; print(secrets.token_urlsafe(64))\""
        )

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def async_database_url(self) -> str:
        """Convert DATABASE_URL to async driver format for SQLAlchemy async engine."""
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+asyncpg://", 1)
        if url.startswith("sqlite:///"):
            return url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
        if url.startswith("mysql+mysqlconnector://"):
            return url.replace("mysql+mysqlconnector://", "mysql+aiomysql://", 1)
        if url.startswith("mysql://"):
            return url.replace("mysql://", "mysql+aiomysql://", 1)
        return url

    @property
    def sync_database_url(self) -> str:
        """Get sync DATABASE_URL (for Alembic migrations)."""
        url = self.DATABASE_URL
        url = url.replace("postgresql+asyncpg://", "postgresql://")
        url = url.replace("sqlite+aiosqlite:///", "sqlite:///")
        url = url.replace("mysql+aiomysql://", "mysql+mysqlconnector://")
        return url

    @property
    def is_sqlite(self) -> bool:
        return "sqlite" in self.DATABASE_URL

    @property
    def is_production(self) -> bool:
        return self.ENV == "prod"


settings = Settings()
