"""
Idempotency Middleware
Guarantees that repeating the same POST/PUT/PATCH request with the same
Idempotency-Key produces the same result — critical for payment and mutation endpoints.
Uses Redis when available, otherwise skips (no-op).
"""
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response as StarletteResponse
import base64

from app.core.redis import get_redis
from app.core.logger import get_logger

logger = get_logger("jetapi.idempotency")

IDEMPOTENT_METHODS = {"POST", "PUT", "PATCH"}
CACHE_TTL = 86400  # 24 hours


class IdempotencyMiddleware(BaseHTTPMiddleware):
    """
    If the client sends an `Idempotency-Key` header on a mutation request,
    the first response is cached in Redis.  Subsequent identical requests
    return the cached response instead of re-executing.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method not in IDEMPOTENT_METHODS:
            return await call_next(request)

        idempotency_key = request.headers.get("Idempotency-Key")
        if not idempotency_key:
            return await call_next(request)

        redis = get_redis()
        if redis is None:
            return await call_next(request)

        auth_header = request.headers.get("Authorization", "anonymous")
        cache_key = f"idempotency:{auth_header}:{idempotency_key}"

        # Check for cached response
        try:
            cached = await redis.hgetall(cache_key)
            if cached:
                logger.debug(f"Idempotency cache hit: {idempotency_key}")
                body_bytes = base64.b64decode(cached["body"])
                return Response(
                    content=body_bytes,
                    status_code=int(cached["status"]),
                    media_type=cached.get("content_type", "application/json"),
                )
        except Exception:
            pass  # Redis error — proceed normally

        # Execute the actual request
        response = await call_next(request)

        # Cache successful responses
        if response.status_code < 400:
            try:
                body = b""
                async for chunk in response.body_iterator:
                    body += chunk if isinstance(chunk, bytes) else chunk.encode()

                body_b64 = base64.b64encode(body).decode('ascii')

                await redis.hset(cache_key, mapping={
                    "body": body_b64,
                    "status": str(response.status_code),
                    "content_type": response.media_type or "application/json",
                })
                await redis.expire(cache_key, CACHE_TTL)

                return Response(
                    content=body,
                    status_code=response.status_code,
                    media_type=response.media_type,
                    headers=dict(response.headers),
                )
            except Exception as e:
                logger.warning(f"Idempotency cache write failed: {e}")
                return Response(
                    content=body,
                    status_code=response.status_code,
                    media_type=response.media_type,
                    headers=dict(response.headers),
                )

        return response
