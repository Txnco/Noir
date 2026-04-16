"""
Role-Based Access Control.

Two scopes:
  - Platform roles (admin/staff/user) live in `user_platform_roles`.
  - Org roles (owner/admin/staff) live in `organization_members`.

Callers are identified by the Supabase JWT (`CurrentUser`). Role lookups
run against the DB on demand — no state is stuffed into the JWT.
"""
from __future__ import annotations

from typing import Callable, Iterable

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user
from app.models.profile import OrganizationMember, UserPlatformRole


async def get_platform_role(db: AsyncSession, user_id) -> str:
    """Return the user's platform role, defaulting to 'user'."""
    result = await db.execute(
        select(UserPlatformRole.role).where(UserPlatformRole.user_id == user_id)
    )
    return result.scalar() or "user"


async def get_org_roles(db: AsyncSession, user_id) -> dict[str, str]:
    """Return {org_id: role} for every active org membership."""
    result = await db.execute(
        select(OrganizationMember.org_id, OrganizationMember.role).where(
            OrganizationMember.user_id == user_id,
            OrganizationMember.is_active.is_(True),
        )
    )
    return {str(org_id): role for org_id, role in result.all()}


def require_platform_roles(*allowed: str) -> Callable:
    """Dependency factory: require any of the given platform roles."""
    needed = {r.strip().lower() for r in allowed if r}

    async def dep(
        user: CurrentUser = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> CurrentUser:
        if not settings.ENABLE_RBAC or not needed:
            return user
        role = await get_platform_role(db, user.id)
        if role not in needed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient platform role",
            )
        return user

    return dep


def require_org_roles(*allowed: str) -> Callable:
    """Dependency factory: require any of the given org roles in ANY org.

    For org-scoped endpoints that need to check a specific `org_id`, use
    `get_org_roles()` directly inside the handler.
    """
    needed = {r.strip().lower() for r in allowed if r}

    async def dep(
        user: CurrentUser = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> CurrentUser:
        if not settings.ENABLE_RBAC or not needed:
            return user
        roles = await get_org_roles(db, user.id)
        if not any(r in needed for r in roles.values()):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient org role",
            )
        return user

    return dep


# Backwards-compatible alias so existing `Depends(require_roles(["admin"]))`
# in admin_routes keeps working. "admin" here means platform-level admin.
def require_roles(roles: Iterable[str]) -> Callable:
    return require_platform_roles(*roles)
