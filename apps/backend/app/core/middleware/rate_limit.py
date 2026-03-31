"""
Rate Limiting Middleware
Redis-backed sliding window (production) with in-memory token bucket fallback.
"""
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Callable, Optional

from fastapi import Request, Response, HTTPException, status, Depends
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.logger import get_logger, log_security_event
from app.core.config import settings

logger = get_logger("jetapi.ratelimit")


# =============================================================================
# Redis Sliding Window Rate Limiter
# =============================================================================
async def _redis_sliding_window_check(
    key: str,
    limit: int,
    window: int,
) -> tuple[bool, int]:
    """
    Redis-backed sliding window rate limiting.
    Returns (allowed: bool, remaining: int).
    """
    from app.core.redis import get_redis
    redis = get_redis()
    if redis is None:
        return True, limit  # Redis unavailable — allow through

    full_key = f"rl:{key}"
    now = time.time()

    try:
        async with redis.pipeline(transaction=True) as pipe:
            pipe.zremrangebyscore(full_key, 0, now - window)
            pipe.zadd(full_key, {str(now): now})
            pipe.zcard(full_key)
            pipe.expire(full_key, window)
            results = await pipe.execute()

        request_count = results[2]
        remaining = max(0, limit - request_count)

        if request_count > limit:
            return False, 0
        return True, remaining
    except Exception as e:
        logger.warning(f"Redis rate limit check failed: {e}")
        return True, limit  # Redis error — fail open


# =============================================================================
# In-Memory Token Bucket (Fallback)
# =============================================================================
@dataclass
class TokenBucket:
    """Token bucket for rate limiting."""
    capacity: int
    refill_rate: float
    tokens: float = field(default=0.0)
    last_refill: float = field(default_factory=time.time)

    def __post_init__(self):
        self.tokens = float(self.capacity)

    def consume(self, tokens: int = 1) -> bool:
        self._refill()
        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False

    def _refill(self) -> None:
        now = time.time()
        elapsed = now - self.last_refill
        self.tokens = min(self.capacity, self.tokens + elapsed * self.refill_rate)
        self.last_refill = now

    @property
    def wait_time(self) -> float:
        if self.tokens >= 1:
            return 0
        return (1 - self.tokens) / self.refill_rate


class InMemoryRateLimitStore:
    """In-memory rate limit storage (fallback when Redis is unavailable)."""

    def __init__(self, max_size: int = 10000):
        # Use an OrderedDict to act as a bounded LRU cache
        self._buckets: OrderedDict[str, TokenBucket] = OrderedDict()
        self._max_size = max_size
        self._cleanup_interval = 300
        self._last_cleanup = time.time()

    def get_bucket(self, key: str) -> TokenBucket:
        self._maybe_cleanup()
        
        if key in self._buckets:
            bucket = self._buckets.pop(key)
        else:
            bucket = TokenBucket(
                capacity=settings.RATE_LIMIT_REQUESTS,
                refill_rate=settings.RATE_LIMIT_REQUESTS / settings.RATE_LIMIT_WINDOW,
            )
            
        self._buckets[key] = bucket
        
        if len(self._buckets) > self._max_size:
            self._buckets.popitem(last=False)
            
        return bucket

    def _maybe_cleanup(self) -> None:
        now = time.time()
        if now - self._last_cleanup > self._cleanup_interval:
            self._cleanup()
            self._last_cleanup = now

    def _cleanup(self) -> None:
        threshold = time.time() - 3600
        keys_to_remove = [
            key for key, bucket in self._buckets.items()
            if bucket.last_refill < threshold
        ]
        for key in keys_to_remove:
            del self._buckets[key]
        if keys_to_remove:
            logger.debug(f"Cleaned up {len(keys_to_remove)} rate limit buckets")


_rate_limit_store = InMemoryRateLimitStore()


# =============================================================================
# Middleware
# =============================================================================
class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware.
    Uses Redis sliding window when available, falls back to in-memory token bucket.
    """

    def __init__(
        self,
        app: ASGIApp,
        requests_per_window: Optional[int] = None,
        window_seconds: Optional[int] = None,
        exclude_paths: Optional[list[str]] = None,
    ):
        super().__init__(app)
        self.requests_per_window = requests_per_window or settings.RATE_LIMIT_REQUESTS
        self.window_seconds = window_seconds or settings.RATE_LIMIT_WINDOW
        self.exclude_paths = exclude_paths or ["/health", "/metrics", "/docs", "/redoc", "/openapi.json"]
        self.enabled = settings.RATE_LIMIT_ENABLED

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if not self.enabled:
            return await call_next(request)

        if any(request.url.path.startswith(path) for path in self.exclude_paths):
            return await call_next(request)

        key = self._get_rate_limit_key(request)

        # Try Redis sliding window first
        allowed, remaining = await _redis_sliding_window_check(
            key, self.requests_per_window, self.window_seconds
        )

        if not allowed:
            log_security_event(
                event_type="RATE_LIMIT",
                message=f"Rate limit exceeded for {key}",
                ip_address=self._get_client_ip(request),
                path=str(request.url.path),
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded",
                headers={
                    "Retry-After": str(self.window_seconds),
                    "X-RateLimit-Limit": str(self.requests_per_window),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(time.time()) + self.window_seconds),
                },
            )

        # Fallback: also check in-memory bucket if Redis returned passthrough
        from app.core.redis import get_redis
        if get_redis() is None:
            bucket = _rate_limit_store.get_bucket(key)
            if not bucket.consume():
                retry_after = int(bucket.wait_time) + 1
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded",
                    headers={
                        "Retry-After": str(retry_after),
                        "X-RateLimit-Limit": str(self.requests_per_window),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": str(int(time.time()) + retry_after),
                    },
                )
            remaining = int(bucket.tokens)

        response = await call_next(request)

        response.headers["X-RateLimit-Limit"] = str(self.requests_per_window)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(time.time() + self.window_seconds))

        return response

    def _get_rate_limit_key(self, request: Request) -> str:
        user_id = getattr(request.state, "user_id", None)
        if user_id:
            return f"user:{user_id}"
        return f"ip:{self._get_client_ip(request)}"

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip
        if request.client:
            return request.client.host
        return "unknown"


# =============================================================================
# Dependency for route-specific rate limiting
# =============================================================================
def rate_limit(
    requests: int = 10,
    window: int = 60,
    key_prefix: str = "route",
):
    """
    Dependency for route-specific rate limiting.

    Usage:
        @router.post("/expensive-operation")
        async def expensive_operation(
            _: None = Depends(rate_limit(requests=5, window=60))
        ):
            ...
    """
    async def check_rate_limit(request: Request):
        key = f"{key_prefix}:{request.url.path}:{_get_client_key(request)}"

        allowed, _ = await _redis_sliding_window_check(key, requests, window)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded",
                headers={"Retry-After": str(window)},
            )

        # Fallback to in-memory
        from app.core.redis import get_redis
        if get_redis() is None:
            bucket = _rate_limit_store.get_bucket(key)
            if not bucket.consume():
                retry_after = int(bucket.wait_time) + 1
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded",
                    headers={"Retry-After": str(retry_after)},
                )

        return None

    return check_rate_limit


def _get_client_key(request: Request) -> str:
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return str(user_id)
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"
