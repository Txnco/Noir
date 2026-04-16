"""
JetApi - FastAPI Boilerplate Framework
Main application entry point.
"""
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from contextlib import asynccontextmanager
from sqlalchemy import text

from app.core.config import settings
from app.core.logger import setup_logging, get_logger
from app.exceptions import (
    AppException,
    app_exception_handler,
    http_exception_handler,
    validation_exception_handler,
    unhandled_exception_handler,
)


# -------------------------------------------------
# Lifespan Event Handler
# -------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events."""
    setup_logging()
    log = get_logger("jetapi.startup")

    # Startup
    log.info(f"{settings.PROJECT_NAME} v{settings.APP_VERSION} starting...")
    log.info(f"   Environment: {settings.ENV}")

    log.info("   Auth: Supabase")
    log.info(f"   RBAC Enabled: {settings.ENABLE_RBAC}")
    log.info(f"   Debug Mode: {settings.DEBUG}")

    # Initialize Redis
    redis_available = False
    if settings.REDIS_ENABLED:
        try:
            from app.core.redis import init_redis
            await init_redis()
            redis_available = True
            log.info("   Redis: connected")
        except Exception as e:
            log.warning(f"   Redis: unavailable ({e}) - using in-memory fallback")

    # Start background workers
    if settings.WORKER_COUNT > 0:
        from app.core.jobs.worker import start_workers
        from app.core.jobs.scheduler import scheduler
        await start_workers(count=settings.WORKER_COUNT)
        await scheduler.start()
        log.info(f"   Background Workers: {settings.WORKER_COUNT}")

    # Start cache cleanup task
    cleanup_task = None
    if settings.CACHE_ENABLED:
        import asyncio
        from app.core.cache import cache_cleanup_task
        cleanup_task = asyncio.create_task(cache_cleanup_task(interval=60))
        log.info("   Cache: enabled (L1 in-memory" + (" + L2 Redis)" if redis_available else ", Redis unavailable)"))

    log.info("Startup complete")

    yield

    # Shutdown
    log.info(f"{settings.PROJECT_NAME} shutting down...")

    if settings.WORKER_COUNT > 0:
        from app.core.jobs.worker import stop_workers
        from app.core.jobs.scheduler import scheduler
        await scheduler.stop()
        await stop_workers()

    if cleanup_task:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except Exception:
            pass

    if settings.REDIS_ENABLED:
        from app.core.redis import close_redis
        await close_redis()

    log.info("Shutdown complete")


# -------------------------------------------------
# App Initialization
# -------------------------------------------------
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.APP_VERSION,
    description="""
## JetApi - FastAPI Boilerplate Framework

A production-ready FastAPI boilerplate with:
-  **JWT / OAuth2 Authentication** - Configurable auth system
-  **RBAC** - Role-Based Access Control
-  **Redis Caching** - L1 in-memory + L2 Redis
-  **Rate Limiting** - Redis-backed sliding window
-  **Database Migrations** - Alembic integration
-  **Async PostgreSQL** - asyncpg with connection pooling
-  **Docker Ready** - Compose with Redis + Nginx
    """,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    lifespan=lifespan,
)


# -------------------------------------------------
# Exception Handlers
# -------------------------------------------------
app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)


# -------------------------------------------------
# Middleware Chain (last added = first executed)
# -------------------------------------------------
from app.core.middleware.logging import LoggingMiddleware
from app.core.middleware.rate_limit import RateLimitMiddleware
from app.core.middleware.security_headers import SecurityHeadersMiddleware
from app.core.middleware.idempotency import IdempotencyMiddleware

# 6. Idempotency (innermost — closest to handlers)
app.add_middleware(IdempotencyMiddleware)

# 5. Rate limiting
if settings.RATE_LIMIT_ENABLED:
    app.add_middleware(RateLimitMiddleware)

# 4. CORS (before auth — OPTIONS preflight must pass)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list if settings.is_production else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Security headers
app.add_middleware(SecurityHeadersMiddleware)

# 2. Request logging + Request ID (outermost — wraps everything)
app.add_middleware(LoggingMiddleware)


# -------------------------------------------------
# API Routes
# -------------------------------------------------
from app.api.v1.routes import auth_routes, user_routes, admin_routes, noir_routes

app.include_router(auth_routes.router, prefix=settings.API_V1_STR)
app.include_router(user_routes.router, prefix=settings.API_V1_STR)
app.include_router(admin_routes.router, prefix=settings.API_V1_STR)
app.include_router(noir_routes.router, prefix=settings.API_V1_STR)


# -------------------------------------------------
# Health Check Endpoints
# -------------------------------------------------
@app.get("/health/live", tags=["Health"])
async def liveness():
    """Is the process alive? Returns 200 if yes."""
    return {"status": "alive"}


@app.get("/health/ready", tags=["Health"])
async def readiness():
    """Is the app ready to accept traffic? Checks dependencies."""
    checks = {}

    # Check database
    try:
        from app.core.database import engine
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "error"

    # Check Redis
    try:
        from app.core.redis import get_redis
        redis = get_redis()
        if redis:
            await redis.ping()
            checks["redis"] = "ok"
        else:
            checks["redis"] = "not_configured"
    except Exception:
        checks["redis"] = "error"

    all_ok = all(v in ("ok", "not_configured") for v in checks.values())
    return {
        "status": "ready" if all_ok else "degraded",
        "checks": checks,
    }


@app.get("/health/startup", tags=["Health"])
async def startup_probe():
    """Used by orchestrators to know when app finished initialization."""
    return {
        "status": "started",
        "version": settings.APP_VERSION,
        "env": settings.ENV,
    }


# Keep legacy health endpoint for backwards compatibility
@app.get("/health", tags=["Health"])
async def health_check():
    """Legacy health check endpoint."""
    return await readiness()


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with API information."""
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs" if not settings.is_production else None,
        "health": "/health/ready",
    }


# -------------------------------------------------
# Entry Point
# -------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
    )
