"""
Profile routes.

Read + self-edit profile data. Identity management (email/password) lives
in Supabase — we don't expose endpoints for it.
"""
from math import ceil
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user
from app.models.profile import Profile, UserPreference
from app.models.tags import Tag
from app.schemas.user import OnboardingRequest, ProfileList, ProfileOut, ProfileUpdate
from app.services.rbac import require_platform_roles


router = APIRouter(prefix="/profiles", tags=["Profiles"])


@router.get("/me", response_model=ProfileOut)
async def get_my_profile(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = (
        await db.execute(select(Profile).where(Profile.id == user.id))
    ).scalars().first()
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")
    return ProfileOut.model_validate(profile)


@router.patch("/me", response_model=ProfileOut)
async def update_my_profile(
    patch: ProfileUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    profile = (
        await db.execute(select(Profile).where(Profile.id == user.id))
    ).scalars().first()
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")

    for field, value in patch.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)

    await db.commit()
    await db.refresh(profile)
    return ProfileOut.model_validate(profile)


from sqlalchemy.orm import selectinload

from app.core.logger import get_logger
log = get_logger("jetapi.user")

@router.post("/me/onboarding", response_model=ProfileOut)
async def complete_onboarding(
    payload: OnboardingRequest,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    One-shot onboarding finaliser. Writes `city`, `date_of_birth`,
    `onboarding_completed=true` to the profile, upserts the interest tags
    onto `user_preferences`, and returns the updated profile.

    Unknown tag slugs are silently dropped so callers can't poison the array.
    """
    log.info(f"Starting onboarding for user {user.id}")
    # Fetch profile with preferences in one go
    result = await db.execute(
        select(Profile)
        .where(Profile.id == user.id)
        .options(selectinload(Profile.preferences))
    )
    profile = result.scalars().first()
    
    if profile is None:
        log.warning(f"Profile not found for user {user.id}")
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")

    # Filter interest_tags against the taxonomy
    valid_slugs: List[str] = []
    if payload.interest_tags:
        log.info(f"Filtering {len(payload.interest_tags)} interest tags")
        rows = (
            await db.execute(
                select(Tag.slug).where(
                    Tag.slug.in_(payload.interest_tags),
                    Tag.is_active.is_(True),
                )
            )
        ).scalars().all()
        valid_slugs = list(rows)

    # Update profile fields
    profile.city = payload.city.strip()
    profile.date_of_birth = payload.date_of_birth
    profile.onboarding_completed = True

    # Upsert user_preferences
    if profile.preferences:
        log.info(f"Updating preferences for user {user.id}")
        profile.preferences.interest_tags = valid_slugs
    else:
        log.info(f"Creating new preferences for user {user.id}")
        prefs = UserPreference(user_id=user.id, interest_tags=valid_slugs)
        db.add(prefs)

    log.info(f"Committing onboarding for user {user.id}")
    await db.commit()
    log.info(f"Refreshing profile for user {user.id}")
    await db.refresh(profile)
    log.info(f"Onboarding complete for user {user.id}")
    return ProfileOut.model_validate(profile)


@router.get("", response_model=ProfileList)
async def list_profiles(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_platform_roles("super_admin", "support")),
):
    query = select(Profile)
    count_query = select(func.count(Profile.id))

    if search:
        term = f"%{search}%"
        flt = or_(
            Profile.first_name.ilike(term),
            Profile.last_name.ilike(term),
            Profile.city.ilike(term),
        )
        query = query.where(flt)
        count_query = count_query.where(flt)

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * page_size
    rows = (await db.execute(query.offset(offset).limit(page_size))).scalars().all()

    return ProfileList(
        items=[ProfileOut.model_validate(p) for p in rows],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=ceil(total / page_size) if total else 1,
    )


@router.get("/{user_id}", response_model=ProfileOut)
async def get_profile(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_platform_roles("super_admin", "support")),
):
    profile = (
        await db.execute(select(Profile).where(Profile.id == user_id))
    ).scalars().first()
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")
    return ProfileOut.model_validate(profile)
