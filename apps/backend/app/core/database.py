"""
Async SQLAlchemy Database Configuration
Supports PostgreSQL (asyncpg), MySQL (aiomysql), and SQLite (aiosqlite).
"""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from typing import AsyncGenerator

from app.core.config import settings

# =============================================================================
# Async Engine (for application runtime)
# =============================================================================
_engine_kwargs = {
    "echo": settings.DEBUG and settings.ENV == "dev",
}

# Connection pooling only for non-SQLite databases
if not settings.is_sqlite:
    _engine_kwargs.update({
        "pool_size": 20,
        "max_overflow": 10,
        "pool_timeout": 30,
        "pool_recycle": 1800,
        "pool_pre_ping": True,
    })

engine = create_async_engine(settings.async_database_url, **_engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency: yields an async DB session."""
    async with AsyncSessionLocal() as session:
        yield session


# =============================================================================
# Sync Engine (for Alembic migrations only)
# =============================================================================
sync_engine = create_engine(settings.sync_database_url, future=True)
SyncSessionLocal = sessionmaker(bind=sync_engine, autoflush=False, autocommit=False)
