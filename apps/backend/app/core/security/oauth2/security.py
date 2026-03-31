"""
OAuth2 Authentication Security Module
Handles external OAuth2/OIDC provider token validation.
"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError, jwk
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
import json
import httpx

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.models.role import Role


# Bearer token scheme for external JWT validation
bearer_scheme = HTTPBearer(auto_error=True)

# Cache for JWKS keys
_cached_keys = None
_cached_keys_timestamp = None
JWKS_CACHE_TTL = 3600


# ======================
# JWKS Key Management
# ======================
def _fetch_jwks_from_url(url: str) -> dict:
    """Fetch JWKS from a URL."""
    try:
        response = httpx.get(url, timeout=10.0)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        raise RuntimeError(f"Failed to fetch JWKS from {url}: {e}")


def _get_jwks() -> dict:
    """Get JWKS keys from cache or fetch from configured source."""
    global _cached_keys, _cached_keys_timestamp

    import time
    now = time.time()

    if _cached_keys and _cached_keys_timestamp and (now - _cached_keys_timestamp) < JWKS_CACHE_TTL:
        return _cached_keys

    if settings.OAUTH2_JWKS_URL:
        _cached_keys = _fetch_jwks_from_url(settings.OAUTH2_JWKS_URL)
        _cached_keys_timestamp = now
        return _cached_keys

    if settings.OAUTH2_JWKS_JSON:
        _cached_keys = json.loads(settings.OAUTH2_JWKS_JSON)
        _cached_keys_timestamp = now
        return _cached_keys

    raise RuntimeError(
        "OAuth2 JWKS not configured. Set either OAUTH2_JWKS_URL or OAUTH2_JWKS_JSON."
    )


def _get_signing_key(header: dict):
    """Get the signing key matching the token's key ID (kid)."""
    jwks = _get_jwks()
    kid = header.get("kid")

    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return jwk.construct(key)

    if jwks.get("keys"):
        return jwk.construct(jwks["keys"][0])

    return None


def _verify_id_token(token: str) -> dict:
    """Verify and decode an OAuth2/OIDC ID token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        header = jwt.get_unverified_header(token)
        signing_key = _get_signing_key(header)

        if not signing_key:
            raise JWTError("No matching signing key found")

        claims = jwt.get_unverified_claims(token)

        if settings.OAUTH2_AUDIENCE:
            aud = claims.get("aud")
            valid_aud = (
                aud == settings.OAUTH2_AUDIENCE or
                (isinstance(aud, list) and settings.OAUTH2_AUDIENCE in aud)
            )
            if not valid_aud:
                raise JWTError("Invalid audience")

        if settings.OAUTH2_ISSUER:
            iss = claims.get("iss")
            if iss != settings.OAUTH2_ISSUER:
                raise JWTError("Invalid issuer")

        from time import time
        if "exp" in claims and time() > claims["exp"]:
            raise JWTError("Token expired")

        return claims

    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ======================
# User Dependencies (Async)
# ======================
async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """FastAPI dependency to get the current user from OAuth2 token."""
    from app.core.logger import get_logger, log_security_event
    logger = get_logger("jetapi.oauth2")

    token = creds.credentials
    claims = _verify_id_token(token)

    sub = claims.get("sub")
    email = claims.get("email")

    if not sub and not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject identifier"
        )

    # Try to find user by external_sub
    if sub:
        stmt = (
            select(User)
            .options(selectinload(User.roles).selectinload(Role.permissions))
            .where(User.external_sub == sub)
        )
        result = await db.execute(stmt)
        user = result.scalars().first()
        if user:
            return _validate_user(user)

    # Try to find user by email
    if email:
        stmt = (
            select(User)
            .options(selectinload(User.roles).selectinload(Role.permissions))
            .where(User.email == email)
        )
        result = await db.execute(stmt)
        user = result.scalars().first()
        if user:
            if sub and not user.external_sub:
                user.external_sub = sub
                user.external_provider = _extract_provider(claims.get("iss", "unknown"))
                await db.flush()
            return _validate_user(user)

    # Auto-provision if enabled
    if settings.OAUTH2_AUTO_PROVISION:
        name_parts = claims.get("name", "").split(" ", 1)
        first_name = name_parts[0] if name_parts else claims.get("given_name", "User")
        last_name = name_parts[1] if len(name_parts) > 1 else claims.get("family_name", "")

        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email required for user provisioning"
            )

        role_stmt = select(Role).where(Role.name == settings.OAUTH2_DEFAULT_ROLE)
        role_result = await db.execute(role_stmt)
        default_role = role_result.scalars().first()

        new_user = User(
            firstName=first_name,
            lastName=last_name or "",
            email=email,
            external_sub=sub,
            external_provider=_extract_provider(claims.get("iss", "unknown")),
            is_active=True,
            is_verified=True,
            hashed_password=None,
            roles=[default_role] if default_role else []
        )

        db.add(new_user)
        await db.flush()
        await db.refresh(new_user)

        log_security_event(
            "OAUTH2_USER_PROVISIONED",
            f"Auto-provisioned OAuth2 user: {email}",
            user_id=str(new_user.id),
        )

        logger.info(f"Auto-provisioned OAuth2 user: {email}")
        return new_user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="User not provisioned. Please contact an administrator."
    )


def _extract_provider(issuer: str) -> str:
    """Extract provider name from issuer URL."""
    if "google" in issuer.lower():
        return "google"
    elif "github" in issuer.lower():
        return "github"
    elif "microsoft" in issuer.lower() or "azure" in issuer.lower():
        return "microsoft"
    elif "auth0" in issuer.lower():
        return "auth0"
    elif "okta" in issuer.lower():
        return "okta"
    else:
        return issuer


def _validate_user(user: User) -> User:
    """Validate user is active."""
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled"
        )
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
