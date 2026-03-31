"""
Centralized Exception Handling
Consistent error envelope for all API responses.
"""
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.logger import get_logger, request_id_ctx

logger = get_logger("jetapi.exceptions")


# =============================================================================
# Domain Exception Hierarchy
# =============================================================================
class AppException(Exception):
    """Base application exception with consistent error shape."""

    def __init__(self, code: str, message: str, status_code: int = 400, details: list | None = None):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or []
        super().__init__(message)


class NotFoundError(AppException):
    def __init__(self, resource: str, resource_id=None):
        msg = f"{resource} not found" if resource_id is None else f"{resource} with id {resource_id} not found"
        super().__init__(
            code=f"{resource.upper()}_NOT_FOUND",
            message=msg,
            status_code=404,
        )


class ConflictError(AppException):
    def __init__(self, message: str):
        super().__init__(code="CONFLICT", message=message, status_code=409)


class ForbiddenError(AppException):
    def __init__(self, message: str = "Access denied"):
        super().__init__(code="FORBIDDEN", message=message, status_code=403)


class UnauthorizedError(AppException):
    def __init__(self, message: str = "Could not validate credentials"):
        super().__init__(code="UNAUTHORIZED", message=message, status_code=401)


class RateLimitError(AppException):
    def __init__(self, retry_after: int = 60):
        super().__init__(
            code="RATE_LIMIT_EXCEEDED",
            message="Too many requests",
            status_code=429,
            details=[{"retry_after": retry_after}],
        )
        self.retry_after = retry_after


# =============================================================================
# Error Envelope Builder
# =============================================================================
def _error_envelope(code: str, message: str, request_id: str | None = None, details: list | None = None) -> dict:
    """Standard error response shape — never expose internals."""
    return {
        "error": {
            "code": code,
            "message": message,
            "request_id": request_id or request_id_ctx.get() or "",
            "details": details or [],
        }
    }


# =============================================================================
# Exception Handlers (register in main.py)
# =============================================================================
async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """Handle domain exceptions with consistent error shape."""
    request_id = getattr(request.state, "request_id", None) or request_id_ctx.get()
    headers = {}
    if isinstance(exc, RateLimitError):
        headers["Retry-After"] = str(exc.retry_after)
    if isinstance(exc, UnauthorizedError):
        headers["WWW-Authenticate"] = "Bearer"

    return JSONResponse(
        status_code=exc.status_code,
        content=_error_envelope(exc.code, exc.message, request_id, exc.details),
        headers=headers,
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Handle FastAPI/Starlette HTTPException with consistent error shape."""
    request_id = getattr(request.state, "request_id", None) or request_id_ctx.get()
    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    code = {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        409: "CONFLICT",
        422: "VALIDATION_ERROR",
        429: "RATE_LIMIT_EXCEEDED",
    }.get(exc.status_code, "ERROR")

    return JSONResponse(
        status_code=exc.status_code,
        content=_error_envelope(code, detail, request_id),
        headers=getattr(exc, "headers", None) or {},
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handle Pydantic validation errors with field-level details."""
    request_id = getattr(request.state, "request_id", None) or request_id_ctx.get()
    details = []
    for error in exc.errors():
        details.append({
            "field": ".".join(str(loc) for loc in error["loc"]),
            "message": error["msg"],
            "type": error["type"],
        })

    return JSONResponse(
        status_code=422,
        content=_error_envelope("VALIDATION_ERROR", "Request validation failed", request_id, details),
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all for unhandled exceptions — never expose internals."""
    request_id = getattr(request.state, "request_id", None) or request_id_ctx.get()
    logger.exception("Unhandled exception", exc_info=exc, extra={"request_id": request_id})

    return JSONResponse(
        status_code=500,
        content=_error_envelope("INTERNAL_ERROR", "Internal server error", request_id),
    )
