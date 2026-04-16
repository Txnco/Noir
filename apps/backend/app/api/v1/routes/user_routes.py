"""
Profile routes.

Read + self-edit profile data. Identity management (email/password) lives
in Supabase — we don't expose endpoints for it.
"""
from math import ceil
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user
from app.models.profile import Profile
from app.schemas.user import ProfileList, ProfileOut, ProfileUpdate
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


@router.get("", response_model=ProfileList)
async def list_profiles(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(require_platform_roles("admin", "staff")),
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
    _: CurrentUser = Depends(require_platform_roles("admin", "staff")),
):
    profile = (
        await db.execute(select(Profile).where(Profile.id == user_id))
    ).scalars().first()
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")
    return ProfileOut.model_validate(profile)
