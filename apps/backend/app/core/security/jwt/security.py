"""
JWT Authentication Security Module
Handles JWT token creation, validation, and user authentication.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import secrets

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.models.role import Role
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import secrets
import bcrypt
from jose import jwt, JWTError
# from passlib.context import CryptContext # Deprecated/Broken with new bcrypt

...
# OAuth2 scheme for token extraction
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=True
)

# ======================
# Password Utilities
# ======================
def verify_password(plain: str, hashed: str) -> bool:
    """Verify a plain password against a hashed password using bcrypt directly."""
    try:
        if isinstance(hashed, str):
            hashed = hashed.encode('utf-8')
        return bcrypt.checkpw(plain.encode('utf-8'), hashed)
    except Exception:
        return False


def hash_password(plain: str) -> str:
    """Hash a plain password using bcrypt directly."""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(plain.encode('utf-8'), salt)
    return hashed.decode('utf-8')



# ======================
# Token Utilities
# ======================
def create_access_token(
    sub: str,
    roles: Optional[List[str]] = None,
    permissions: Optional[List[str]] = None,
    expires_minutes: Optional[int] = None
) -> str:
    """Create a JWT access token."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=expires_minutes or settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "sub": str(sub),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "type": "access",
        "roles": roles or [],
        "perms": permissions or [],
        "jti": secrets.token_hex(16),
    }

    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(sub: str, expires_days: Optional[int] = None) -> str:
    """Create a JWT refresh token."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=expires_days or settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)

    to_encode = {
        "sub": str(sub),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "type": "refresh",
        "jti": secrets.token_hex(16),
    }

    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT token."""
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.JWT_ALGORITHM])


def generate_password_reset_token() -> str:
    """Generate a secure password reset token."""
    return secrets.token_urlsafe(32)


def generate_email_verification_token() -> str:
    """Generate a secure email verification token."""
    return secrets.token_urlsafe(32)


# ======================
# User Dependencies (Async)
# ======================
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency to get the current authenticated user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_token(token)
        sub: str = payload.get("sub")
        token_type: str = payload.get("type", "access")
        jti: str = payload.get("jti")

        if not sub or not jti:
            raise credentials_exception

        # Check if token is blacklisted
        from app.core.redis import get_redis
        redis = get_redis()
        if redis is not None:
            is_blacklisted = await redis.get(f"bl:{jti}")
            if is_blacklisted:
                raise credentials_exception

        if token_type != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type",
                headers={"WWW-Authenticate": "Bearer"},
            )

    except JWTError:
        raise credentials_exception

    # Load user with cached RBAC data to prevent over-fetching
    from sqlalchemy.orm import noload
    stmt = select(User).options(noload(User.roles)).where(User.id == sub)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )
        
    # Load roles from cache
    from app.core.cache import cache
    rbac_data = await cache.get(f"rbac:{sub}")
    if rbac_data is None:
        # Load from DB if not in cache
        role_stmt = select(Role).join(Role.users).where(User.id == sub).options(selectinload(Role.permissions))
        roles = (await db.execute(role_stmt)).scalars().all()
        rbac_data = {
            "roles": [r.name for r in roles],
            "permissions": list({p.code for r in roles for p in r.permissions})
        }
        await cache.set(f"rbac:{sub}", rbac_data, ttl=3600)
        
    # Attach to user for RBAC service
    user._cached_roles = rbac_data["roles"]
    user._cached_permissions = rbac_data["permissions"]

    return user

async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """FastAPI dependency to get the current active user."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


async def get_optional_current_user(
    token: Optional[str] = Depends(OAuth2PasswordBearer(
        tokenUrl=f"{settings.API_V1_STR}/auth/login",
        auto_error=False
    )),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """FastAPI dependency to optionally get the current user."""
    if not token:
        return None

    try:
        payload = decode_token(token)
        sub: str = payload.get("sub")
        jti: str = payload.get("jti")

        if not sub or not jti:
            return None

        # Check if token is blacklisted
        from app.core.redis import get_redis
        redis = get_redis()
        if redis is not None:
            is_blacklisted = await redis.get(f"bl:{jti}")
            if is_blacklisted:
                return None

        # Load user with cached RBAC
        from sqlalchemy.orm import noload
        stmt = select(User).options(noload(User.roles)).where(User.id == sub)
        result = await db.execute(stmt)
        user = result.scalars().first()

        if user and user.is_active:
            from app.core.cache import cache
            rbac_data = await cache.get(f"rbac:{sub}")
            if rbac_data is None:
                role_stmt = select(Role).join(Role.users).where(User.id == sub).options(selectinload(Role.permissions))
                roles = (await db.execute(role_stmt)).scalars().all()
                rbac_data = {
                    "roles": [r.name for r in roles],
                    "permissions": list({p.code for r in roles for p in r.permissions})
                }
                await cache.set(f"rbac:{sub}", rbac_data, ttl=3600)
                
            user._cached_roles = rbac_data["roles"]
            user._cached_permissions = rbac_data["permissions"]
            
        return user
    except Exception:
        return None
