"""
Logging Middleware
Automatically logs all HTTP requests and responses with timing.
"""
import time
import uuid
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.logger import (
    request_id_ctx,
    user_id_ctx,
    log_access,
    get_logger,
)

logger = get_logger("jetapi.middleware")


class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware that logs all HTTP requests and responses.
    
    Features:
    - Assigns unique request ID to each request
    - Tracks response time
    - Logs to access log in Apache/Nginx combined format
    - Sets context variables for request tracking throughout the app
    """
    
    def __init__(self, app: ASGIApp, exclude_paths: list[str] | None = None):
        super().__init__(app)
        self.exclude_paths = exclude_paths or ["/health", "/metrics", "/favicon.ico"]
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip logging for excluded paths
        if any(request.url.path.startswith(path) for path in self.exclude_paths):
            return await call_next(request)
        
        # Generate request ID
        request_id = str(uuid.uuid4())
        
        # Set context variables
        request_id_token = request_id_ctx.set(request_id)
        
        # Try to get user ID from request state (set by auth middleware)
        user_id = getattr(request.state, "user_id", None)
        user_id_token = user_id_ctx.set(str(user_id) if user_id else None)
        
        # Get client IP
        client_ip = self._get_client_ip(request)
        
        # Get user agent
        user_agent = request.headers.get("user-agent", "-")
        
        # Start timing
        start_time = time.perf_counter()
        
        # Add request ID to response headers
        try:
            response = await call_next(request)
            
            # Calculate response time
            response_time_ms = (time.perf_counter() - start_time) * 1000
            
            # Add headers
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Response-Time"] = f"{response_time_ms:.2f}ms"
            
            # Log access
            log_access(
                client_ip=client_ip,
                method=request.method,
                path=str(request.url.path),
                status_code=response.status_code,
                response_time_ms=response_time_ms,
                user_agent=user_agent[:100] if user_agent else "-",
            )
            
            return response
            
        except Exception as exc:
            # Calculate response time even on error
            response_time_ms = (time.perf_counter() - start_time) * 1000
            
            # Log error access
            log_access(
                client_ip=client_ip,
                method=request.method,
                path=str(request.url.path),
                status_code=500,
                response_time_ms=response_time_ms,
                user_agent=user_agent[:100] if user_agent else "-",
            )
            
            logger.exception(f"Request failed: {request.method} {request.url.path}")
            raise
            
        finally:
            # Reset context variables
            request_id_ctx.reset(request_id_token)
            user_id_ctx.reset(user_id_token)
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP, considering proxy headers."""
        # Check X-Forwarded-For (from reverse proxy)
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            # Get first IP in the chain (original client)
            return forwarded.split(",")[0].strip()
        
        # Check X-Real-IP
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip
        
        # Fall back to direct connection
        if request.client:
            return request.client.host
        
        return "unknown"
