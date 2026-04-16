"""
Auth routes.

Sign-in / sign-up / password-reset / email-verification are handled by
Supabase Auth directly from the client (see apps/web/lib/auth/actions.ts).
The only endpoint we expose here is `/auth/me` — it returns the caller's
profile, platform role, and org memberships in a single hop so the
frontend does not have to stitch them together.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user
from app.models.profile import OrganizationMember, UserPlatformRole, Profile
from app.schemas.auth import (
    CurrentUserResponse,
    OrgMembershipOut,
    ProfileOut,
    ProfileUpdate,
)


router = APIRouter(prefix="/auth", tags=["Authentication"])


async def _load_current(user: CurrentUser, db: AsyncSession) -> CurrentUserResponse:
    profile = (
        await db.execute(select(Profile).where(Profile.id == user.id))
    ).scalars().first()

    if profile is None:
        profile = Profile(id=user.id)
        db.add(profile)
        await db.commit()
        await db.refresh(profile)

    platform_role = (
        await db.execute(
            select(UserPlatformRole.role).where(UserPlatformRole.user_id == user.id)
        )
    ).scalar() or "user"

    memberships_rows = (
        await db.execute(
            select(OrganizationMember).where(OrganizationMember.user_id == user.id)
        )
    ).scalars().all()

    return CurrentUserResponse(
        id=user.id,
        email=user.email,
        email_verified=user.email_verified,
        profile=ProfileOut.model_validate(profile),
        platform_role=platform_role,
        memberships=[
            OrgMembershipOut(org_id=m.org_id, role=m.role, is_active=m.is_active)
            for m in memberships_rows
        ],
    )


@router.get("/me", response_model=CurrentUserResponse)
async def get_me(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the authenticated caller's profile + roles.

    Identity comes from the Supabase JWT; `profiles` is the single source
    of truth for name/avatar/etc. The row is created by the
    `on_auth_user_created` trigger on `auth.users` insert — if it's missing
    here we self-heal with a blank row so the frontend isn't wedged.
    """
    return await _load_current(user, db)


@router.patch("/me", response_model=CurrentUserResponse)
async def update_me(
    payload: ProfileUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the caller's own profile fields.

    This is the only write path for profile data — `auth.users.raw_user_meta_data`
    is ignored after signup, so all subsequent name changes flow through here.
    """
    profile = (
        await db.execute(select(Profile).where(Profile.id == user.id))
    ).scalars().first()

    if profile is None:
        profile = Profile(id=user.id)
        db.add(profile)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)

    await db.commit()
    return await _load_current(user, db)


__all__ = ["router"]
