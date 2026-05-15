"""Schemas for the platform super-admin dashboard.

These power the global admin UI — list/detail views and oversight actions
that span all organizations. Authority is checked at the route layer
(`require_platform_roles`).
"""
from datetime import datetime
from typing import Generic, List, Optional, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int


# --------------------------------------------------------------------------
# Overview metrics
# --------------------------------------------------------------------------
class AdminMetrics(BaseModel):
    users: int
    super_admins: int
    organizations: int
    organizations_unverified: int
    venues: int
    events: int
    events_published: int
    occurrences: int


# --------------------------------------------------------------------------
# Users
# --------------------------------------------------------------------------
class AdminMembershipOut(BaseModel):
    org_id: UUID
    org_name: Optional[str] = None
    role: str
    is_active: bool


class AdminUserOut(BaseModel):
    id: UUID
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    onboarding_completed: bool = False
    platform_role: str = "user"
    is_ghost: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminUserDetail(AdminUserOut):
    memberships: List[AdminMembershipOut] = []
    last_login: Optional[datetime] = None


class UpdateUserRole(BaseModel):
    platform_role: str  # super_admin | support | finance_admin | user


# --------------------------------------------------------------------------
# Organizations
# --------------------------------------------------------------------------
class AdminOrganizationOut(BaseModel):
    id: UUID
    name: str
    slug: str
    city: Optional[str] = None
    contact_email: Optional[str] = None
    can_organize: bool
    can_own_venues: bool
    is_verified: bool
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminOrgMemberOut(BaseModel):
    user_id: UUID
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: str
    is_active: bool


class AdminVenueOut(BaseModel):
    id: UUID
    org_id: UUID
    org_name: Optional[str] = None
    name: str
    slug: str
    city: str
    venue_type: str
    visibility: str
    total_capacity: Optional[int] = None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class AdminOrganizationDetail(AdminOrganizationOut):
    description: Optional[str] = None
    website: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    members: List[AdminOrgMemberOut] = []
    venues: List[AdminVenueOut] = []


class UpdateOrganization(BaseModel):
    """Platform-admin overrides for an organization."""
    is_verified: Optional[bool] = None
    is_active: Optional[bool] = None
    can_organize: Optional[bool] = None
    can_own_venues: Optional[bool] = None


# --------------------------------------------------------------------------
# Events
# --------------------------------------------------------------------------
class AdminEventOut(BaseModel):
    id: UUID
    name: str
    slug: str
    status: str
    is_free: bool
    organizer_org_id: UUID
    organizer_org_name: Optional[str] = None
    occurrence_count: int = 0
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
