"""
JetApi Caching System
Redis-backed cache with in-memory LRU fallback.
L1: In-memory (microsecond, per-process) | L2: Redis (millisecond, shared)
"""
import asyncio
import functools
import hashlib
import json
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Any, Callable, Optional, TypeVar, ParamSpec

from app.core.logger import get_logger
from app.core.config import settings

logger = get_logger("jetapi.cache")

P = ParamSpec("P")
T = TypeVar("T")


# =============================================================================
# L1: In-Memory LRU Cache (per-process, fast)
# =============================================================================
@dataclass
class CacheEntry:
    """Single cache entry with value and metadata."""
    value: Any
    expires_at: float
    created_at: float = field(default_factory=time.time)
    hits: int = 0

    @property
    def is_expired(self) -> bool:
        return time.time() > self.expires_at

    @property
    def ttl_remaining(self) -> float:
        return max(0, self.expires_at - time.time())


class InMemoryCache:
    """Thread-safe in-memory LRU cache with TTL."""

    def __init__(self, max_size: int = 1000, default_ttl: int = 300):
        self._cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self._max_size = max_size
        self._default_ttl = default_ttl
        self._lock = asyncio.Lock()
        self._hits = 0
        self._misses = 0
        self._evictions = 0

    async def get(self, key: str, default: Any = None) -> Any:
        async with self._lock:
            entry = self._cache.get(key)
            if entry is None:
                self._misses += 1
                return default
            if entry.is_expired:
                del self._cache[key]
                self._misses += 1
                return default
            self._cache.move_to_end(key)
            entry.hits += 1
            self._hits += 1
            return entry.value

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        async with self._lock:
            while len(self._cache) >= self._max_size:
                oldest_key = next(iter(self._cache))
                del self._cache[oldest_key]
                self._evictions += 1
            expires_at = time.time() + (ttl or self._default_ttl)
            self._cache[key] = CacheEntry(value=value, expires_at=expires_at)

    async def delete(self, key: str) -> bool:
        async with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False

    async def exists(self, key: str) -> bool:
        value = await self.get(key)
        return value is not None

    async def clear(self, namespace: Optional[str] = None) -> int:
        async with self._lock:
            if namespace:
                keys_to_delete = [k for k in self._cache if k.startswith(f"{namespace}:")]
                for key in keys_to_delete:
                    del self._cache[key]
                return len(keys_to_delete)
            else:
                count = len(self._cache)
                self._cache.clear()
                return count

    async def get_stats(self) -> dict:
        async with self._lock:
            total_requests = self._hits + self._misses
            hit_rate = (self._hits / total_requests * 100) if total_requests > 0 else 0
            return {
                "size": len(self._cache),
                "max_size": self._max_size,
                "hits": self._hits,
                "misses": self._misses,
                "hit_rate": f"{hit_rate:.2f}%",
                "evictions": self._evictions,
            }

    async def cleanup_expired(self) -> int:
        async with self._lock:
            expired_keys = [key for key, entry in self._cache.items() if entry.is_expired]
            for key in expired_keys:
                del self._cache[key]
            if expired_keys:
                logger.debug(f"Cleaned up {len(expired_keys)} expired cache entries")
            return len(expired_keys)


# =============================================================================
# L2: Redis Cache (shared across processes)
# =============================================================================
class RedisCache:
    """Redis-backed cache for cross-process shared caching."""

    def __init__(self, default_ttl: int = 300, key_prefix: str = "cache"):
        self._default_ttl = default_ttl
        self._prefix = key_prefix

    def _key(self, key: str) -> str:
        return f"{self._prefix}:{key}"

    async def get(self, key: str, default: Any = None) -> Any:
        from app.core.redis import get_redis
        redis = get_redis()
        if redis is None:
            return default
        try:
            value = await redis.get(self._key(key))
            if value is None:
                return default
            return json.loads(value)
        except Exception:
            return default

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        from app.core.redis import get_redis
        redis = get_redis()
        if redis is None:
            return
        try:
            await redis.setex(self._key(key), ttl or self._default_ttl, json.dumps(value, default=str))
        except Exception as e:
            logger.warning(f"Redis cache set failed: {e}")

    async def delete(self, key: str) -> bool:
        from app.core.redis import get_redis
        redis = get_redis()
        if redis is None:
            return False
        try:
            result = await redis.delete(self._key(key))
            return result > 0
        except Exception:
            return False

    async def clear(self, namespace: Optional[str] = None) -> int:
        from app.core.redis import get_redis
        redis = get_redis()
        if redis is None:
            return 0
        try:
            pattern = f"{self._prefix}:{namespace}:*" if namespace else f"{self._prefix}:*"
            keys = []
            async for key in redis.scan_iter(match=pattern, count=100):
                keys.append(key)
            if keys:
                await redis.delete(*keys)
            return len(keys)
        except Exception:
            return 0


# =============================================================================
# Hybrid Cache: L1 (in-memory) + L2 (Redis)
# =============================================================================
class HybridCache:
    """Two-tier cache: checks L1 first, falls back to L2, writes to both."""

    def __init__(self, l1: InMemoryCache, l2: RedisCache):
        self._l1 = l1
        self._l2 = l2

    async def get(self, key: str, default: Any = None) -> Any:
        # Try L1 first
        value = await self._l1.get(key)
        if value is not None:
            return value
        # Try L2
        value = await self._l2.get(key)
        if value is not None:
            # Populate L1 for next access
            await self._l1.set(key, value)
            return value
        return default

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        await self._l1.set(key, value, ttl)
        await self._l2.set(key, value, ttl)

    async def delete(self, key: str) -> bool:
        l1_deleted = await self._l1.delete(key)
        l2_deleted = await self._l2.delete(key)
        return l1_deleted or l2_deleted

    async def clear(self, namespace: Optional[str] = None) -> int:
        l1_count = await self._l1.clear(namespace)
        l2_count = await self._l2.clear(namespace)
        return l1_count + l2_count

    async def get_stats(self) -> dict:
        return await self._l1.get_stats()

    async def cleanup_expired(self) -> int:
        return await self._l1.cleanup_expired()


# =============================================================================
# Global Cache Instances
# =============================================================================
_l1_cache = InMemoryCache(
    max_size=settings.CACHE_MAX_SIZE if hasattr(settings, 'CACHE_MAX_SIZE') else 1000,
    default_ttl=settings.CACHE_DEFAULT_TTL if hasattr(settings, 'CACHE_DEFAULT_TTL') else 300,
)
_l2_cache = RedisCache(
    default_ttl=settings.CACHE_DEFAULT_TTL if hasattr(settings, 'CACHE_DEFAULT_TTL') else 300,
)

# Exported cache — hybrid L1+L2
cache = HybridCache(_l1_cache, _l2_cache)


# =============================================================================
# Cache Decorator
# =============================================================================
def cached(
    ttl: int = 300,
    namespace: str = "default",
    key_builder: Optional[Callable[..., str]] = None,
):
    """
    Decorator for caching function results.

    Usage:
        @cached(ttl=60, namespace="users")
        async def get_user(user_id: int):
            ...
    """
    def decorator(func: Callable[P, T]) -> Callable[P, T]:
        @functools.wraps(func)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> T:
            if key_builder:
                cache_key = f"{namespace}:{key_builder(*args, **kwargs)}"
            else:
                cache_key = _build_cache_key(namespace, func.__name__, args, kwargs)

            cached_value = await cache.get(cache_key)
            if cached_value is not None:
                return cached_value

            result = await func(*args, **kwargs)
            await cache.set(cache_key, result, ttl=ttl)
            return result

        return wrapper
    return decorator


def _build_cache_key(namespace: str, func_name: str, args: tuple, kwargs: dict) -> str:
    """Build a cache key from function arguments."""
    try:
        key_data = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True, default=str)
    except (TypeError, ValueError):
        key_data = f"{args}:{kwargs}"
    key_hash = hashlib.md5(key_data.encode()).hexdigest()[:16]
    return f"{namespace}:{func_name}:{key_hash}"


# =============================================================================
# Cache Invalidation Helpers
# =============================================================================
async def invalidate_cache(namespace: str) -> int:
    """Invalidate all cache entries in a namespace."""
    count = await cache.clear(namespace)
    logger.info(f"Invalidated {count} cache entries in namespace '{namespace}'")
    return count


async def invalidate_cache_key(key: str) -> bool:
    """Invalidate a specific cache key."""
    deleted = await cache.delete(key)
    if deleted:
        logger.debug(f"Invalidated cache key: {key}")
    return deleted


# =============================================================================
# Background Cache Cleanup Task
# =============================================================================
async def cache_cleanup_task(interval: int = 60):
    """Background task to clean up expired cache entries."""
    while True:
        try:
            await asyncio.sleep(interval)
            await cache.cleanup_expired()
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Cache cleanup error: {e}")
