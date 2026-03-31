"""
Authentication Routes
Exposes JWT auth routes when ENABLE_LOCAL_AUTH is enabled.
OAuth2 authentication is handled via the unified security module.
"""
from app.core.config import settings

# Only expose local auth routes if enabled
if settings.ENABLE_LOCAL_AUTH:
    from app.core.security.jwt.auth_routes import router
else:
    # Create an empty router if local auth is disabled
    from fastapi import APIRouter
    router = APIRouter()

__all__ = ["router"]
