"""
Role-Based Access Control.

Two scopes:
  - Platform roles (super_admin/support/finance_admin/user) live in
    `user_platform_roles`.
  - Org roles (owner/admin/manager/staff/door_staff/bar_staff) live in
    `organization_members`.

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


# ... existing code ...
def require_org_roles(*allowed: str) -> Callable:
    # ... existing code ...
    return dep


def require_org_authority(allowed_org_roles: Iterable[str] = ("owner", "admin")) -> Callable:
    """
    Dependency factory: require authority over a specific org_id.
    
    The org_id is expected to be part of the request payload (e.g. create_event)
    or a path parameter. For now, since it varies, we provide a helper to be used
    inside handlers OR we can make a dependency that looks into path/body.
    
    Actually, to keep it clean for the refactor, let's provide a functional
    check that can be reused in service layer.
    """
    needed = {r.strip().lower() for r in allowed_org_roles if r}

    async def check(db: AsyncSession, user_id: str, org_id: str):
        if not settings.ENABLE_RBAC:
            return
            
        # 1. Check org membership
        roles = await get_org_roles(db, user_id)
        if roles.get(str(org_id)) in needed:
            return
            
        # 2. Fallback: platform super admin
        platform_role = await get_platform_role(db, user_id)
        if platform_role == "super_admin":
            return
            
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have authority over this organization",
        )

    return check


# Backwards-compatible alias for any callsite still passing a role list.
# Platform-level roles only (super_admin/support/finance_admin).
def require_roles(roles: Iterable[str]) -> Callable:
    return require_platform_roles(*roles)
