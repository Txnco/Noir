"""Platform super-admin dashboard endpoints.

Cross-organization oversight for the Noir team. All routes require a
platform role: read endpoints accept `super_admin` or `support`; mutations
require `super_admin`.

Kept separate from `admin_routes.py` (cache/jobs/system ops) — same
`/admin` prefix, different concern.
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import CurrentUser
from app.schemas.admin import (
    AdminEventOut,
    AdminMetrics,
    AdminOrganizationDetail,
    AdminOrganizationOut,
    AdminUserDetail,
    AdminUserOut,
    AdminVenueOut,
    Page,
    UpdateOrganization,
    UpdateUserRole,
)
from app.services.admin import AdminService
from app.services.rbac import require_platform_roles

router = APIRouter(prefix="/admin", tags=["Admin Dashboard"])

read_access = require_platform_roles("super_admin", "support")
write_access = require_platform_roles("super_admin")


# ------------------------------------------------------------------ overview
@router.get("/metrics", response_model=AdminMetrics, summary="Platform metrics")
async def get_metrics(
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(read_access),
) -> AdminMetrics:
    return await AdminService.metrics(db)


# --------------------------------------------------------------------- users
@router.get("/users", response_model=Page[AdminUserOut], summary="List users")
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None, description="Filter by platform role"),
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(read_access),
) -> Page[AdminUserOut]:
    return await AdminService.list_users(db, page, page_size, search, role)


@router.get(
    "/users/{user_id}", response_model=AdminUserDetail, summary="User detail"
)
async def get_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(read_access),
) -> AdminUserDetail:
    return await AdminService.get_user(db, user_id)


@router.patch(
    "/users/{user_id}/role",
    response_model=AdminUserDetail,
    summary="Change a user's platform role",
)
async def update_user_role(
    user_id: UUID,
    payload: UpdateUserRole,
    db: AsyncSession = Depends(get_db),
    actor: CurrentUser = Depends(write_access),
) -> AdminUserDetail:
    return await AdminService.update_user_role(db, user_id, payload, actor.id)


# ------------------------------------------------------------- organizations
@router.get(
    "/organizations",
    response_model=Page[AdminOrganizationOut],
    summary="List organizations",
)
async def list_organizations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    verified: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(read_access),
) -> Page[AdminOrganizationOut]:
    return await AdminService.list_organizations(
        db, page, page_size, search, verified
    )


@router.get(
    "/organizations/{org_id}",
    response_model=AdminOrganizationDetail,
    summary="Organization detail",
)
async def get_organization(
    org_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(read_access),
) -> AdminOrganizationDetail:
    return await AdminService.get_organization(db, org_id)


@router.patch(
    "/organizations/{org_id}",
    response_model=AdminOrganizationDetail,
    summary="Verify / suspend / set capabilities",
)
async def update_organization(
    org_id: UUID,
    payload: UpdateOrganization,
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(write_access),
) -> AdminOrganizationDetail:
    return await AdminService.update_organization(db, org_id, payload)


# -------------------------------------------------------------------- venues
@router.get("/venues", response_model=Page[AdminVenueOut], summary="List venues")
async def list_venues(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    org_id: Optional[UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(read_access),
) -> Page[AdminVenueOut]:
    return await AdminService.list_venues(db, page, page_size, search, org_id)


# -------------------------------------------------------------------- events
@router.get("/events", response_model=Page[AdminEventOut], summary="List events")
async def list_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None, description="Filter by event status"),
    db: AsyncSession = Depends(get_db),
    _: CurrentUser = Depends(read_access),
) -> Page[AdminEventOut]:
    return await AdminService.list_events(db, page, page_size, search, status)
