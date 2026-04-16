"""
Supabase Auth — JWT validation + FastAPI dependencies.

We never read from `auth.users` directly; we trust the JWT `sub` as the
authoritative user id (same UUID used as `profiles.id`).
"""
from __future__ import annotations

from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.profile import Profile


bearer_scheme = HTTPBearer(auto_error=True)


class CurrentUser(BaseModel):
    """The authenticated caller, derived purely from the Supabase JWT.

    `id` is the `auth.users.id` UUID, which is also the `profiles.id`.
    No DB lookup is required to build this — any profile/role data is
    fetched on demand by handlers that actually need it.
    """
    id: UUID
    email: Optional[EmailStr] = None
    email_verified: bool = False
    provider: str = "email"
    raw_claims: Dict[str, Any] = {}


def decode_supabase_token(token: str) -> Dict[str, Any]:
    """Validate and decode a Supabase-issued JWT."""
    try:
        return jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},  # Supabase sets aud='authenticated'
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid auth token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def _email_verified(payload: Dict[str, Any]) -> bool:
    if payload.get("email_confirmed_at"):
        return True
    user_meta = payload.get("user_metadata") or {}
    if user_meta.get("email_verified") is True:
        return True
    app_meta = payload.get("app_metadata") or {}
    # OAuth providers (Google, etc.) come pre-verified.
    return app_meta.get("provider") not in (None, "email")


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentUser:
    """FastAPI dependency: validate the bearer JWT and return the caller."""
    payload = decode_supabase_token(creds.credentials)

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing sub claim",
        )

    app_meta = payload.get("app_metadata") or {}
    return CurrentUser(
        id=sub,
        email=payload.get("email"),
        email_verified=_email_verified(payload),
        provider=app_meta.get("provider") or "email",
        raw_claims=payload,
    )


async def get_current_profile(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Profile:
    """FastAPI dependency: require an existing profile row for the caller.

    The profile is created by the `on_auth_user_created` trigger on
    `auth.users` insert. If it's missing, either the trigger isn't installed
    or the user predates it — treat as a server error.
    """
    result = await db.execute(select(Profile).where(Profile.id == user.id))
    profile = result.scalars().first()
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Profile row missing for authenticated user",
        )
    return profile
