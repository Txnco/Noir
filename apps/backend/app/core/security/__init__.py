"""
Unified Security Module
Supports both local JWT and OAuth2 authentication simultaneously.
"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.core.logger import get_logger

logger = get_logger("jetapi.security")

# Always available - local password management functions
from app.core.security.jwt.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)

# Bearer scheme that works for both JWT and OAuth2
bearer_scheme = HTTPBearer(auto_error=True)


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Unified user authentication dependency.
    Tries local JWT first, then OAuth2 if configured.
    """
    token = creds.credentials

    # Try local JWT validation first (if enabled)
    if settings.ENABLE_LOCAL_AUTH:
        try:
            from app.core.security.jwt.security import get_current_user as jwt_get_user
            return await jwt_get_user(creds, db)
        except HTTPException as e:
            if not settings.ENABLE_OAUTH2:
                raise
            logger.debug(f"JWT validation failed, trying OAuth2: {e.detail}")
        except Exception as e:
            logger.debug(f"JWT validation error: {e}")
            if not settings.ENABLE_OAUTH2:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Could not validate credentials",
                    headers={"WWW-Authenticate": "Bearer"},
                )

    # Try OAuth2 validation (if enabled)
    if settings.ENABLE_OAUTH2:
        try:
            from app.core.security.oauth2.security import get_current_user as oauth2_get_user
            return await oauth2_get_user(creds, db)
        except HTTPException:
            raise
        except Exception as e:
            logger.debug(f"OAuth2 validation error: {e}")

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current user and verify they are active."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


async def get_current_verified_user(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """Get current user and verify they have verified their email."""
    if settings.REQUIRE_EMAIL_VERIFICATION and not current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required"
        )
    return current_user


__all__ = [
    "get_current_user",
    "get_current_active_user",
    "get_current_verified_user",
    "hash_password",
    "verify_password",
    "create_access_token",
    "create_refresh_token",
    "decode_token",
]
