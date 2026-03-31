"""
Redis Client Module
Provides async Redis connection for caching, rate limiting, sessions, and JWT blocklist.
Dev: Docker Compose Redis | Prod: External managed Redis (e.g. ElastiCache)
"""
import redis.asyncio as aioredis
from typing import Optional

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("jetapi.redis")

# Global Redis client (initialized on startup, closed on shutdown)
_redis: Optional[aioredis.Redis] = None


async def init_redis() -> aioredis.Redis:
    """Initialize the Redis connection pool. Call during app startup."""
    global _redis
    if _redis is not None:
        return _redis

    _redis = aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
        max_connections=20,
        socket_connect_timeout=5,
        socket_timeout=5,
        retry_on_timeout=True,
    )

    # Verify connection
    try:
        await _redis.ping()
        logger.info("Redis connected successfully")
    except Exception as e:
        logger.warning(f"Redis connection failed: {e} — falling back to in-memory")
        _redis = None
        raise

    return _redis


async def close_redis() -> None:
    """Close the Redis connection pool. Call during app shutdown."""
    global _redis
    if _redis is not None:
        await _redis.close()
        _redis = None
        logger.info("Redis connection closed")


def get_redis() -> Optional[aioredis.Redis]:
    """Get the current Redis client instance. Returns None if not connected."""
    return _redis


async def get_redis_dependency() -> Optional[aioredis.Redis]:
    """FastAPI dependency: returns the Redis client or None."""
    return _redis
