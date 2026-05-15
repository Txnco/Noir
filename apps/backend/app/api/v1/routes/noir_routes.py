from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID

from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user
from app.services.rbac import require_platform_roles
from app.services.noir import NoirService
from app.schemas.noir import (
    EventDiscoveryOut, 
    EventDetailOut, 
    EventCreate,
    EventUpdate,
    OrganizationOut, 
    OrganizationDetail, 
    OrganizationCreate,
    OrganizationUpdate,
    VenueOut,
    VenueCreate
)

router = APIRouter(prefix="/noir", tags=["Noir Core"])

@router.get("/test-db")
async def test_db(db: AsyncSession = Depends(get_db)):
    """Test database connectivity and profiles table."""
    try:
        from app.models.profile import Profile
        from sqlalchemy import select
        result = await db.execute(select(Profile).limit(1))
        profile = result.scalars().first()
        return {
            "status": "connected",
            "database": "reachable",
            "profiles_table": "found",
            "sample_profile_id": str(profile.id) if profile else None
        }
    except Exception as e:
        return {
            "status": "error",
            "detail": str(e)
        }

# ======================
# Events
# ======================
@router.get("/events", response_model=List[EventDiscoveryOut])
async def list_events(
    status: Optional[str] = Query("published", description="Filter by status"),
    org_id: Optional[UUID] = Query(None, description="Filter by organization"),
    db: AsyncSession = Depends(get_db)
):
    """Get a list of events with basic discovery info."""
    return await NoirService.list_events(db, status, org_id)

@router.get("/events/{event_id}", response_model=EventDetailOut)
async def get_event(event_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get detailed information about a specific event."""
    return await NoirService.get_event(db, event_id)

@router.post("/events", response_model=EventDetailOut, status_code=status.HTTP_201_CREATED)
async def create_event(
    payload: EventCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new event. Requires 'owner' or 'admin' role in the organization."""
    return await NoirService.create_event(db, user.id, payload)

@router.patch("/events/{event_id}", response_model=EventDetailOut)
async def update_event(
    event_id: UUID,
    payload: EventUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update an event. Requires 'owner' or 'admin' role in the organization."""
    return await NoirService.update_event(db, user.id, event_id, payload)

# ======================
# Organizations
# ======================
@router.get("/organizations", response_model=List[OrganizationOut])
async def list_organizations(db: AsyncSession = Depends(get_db)):
    """List all active organizations."""
    return await NoirService.list_organizations(db)

@router.get("/organizations/{org_id}", response_model=OrganizationDetail)
async def get_organization(org_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get detailed info for an organization including its venues."""
    return await NoirService.get_organization(db, org_id)

@router.post("/organizations", response_model=OrganizationOut, status_code=status.HTTP_201_CREATED)
async def create_organization(
    payload: OrganizationCreate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_platform_roles("super_admin"))
):
    """Create a new organization. Platform super-admin only."""
    return await NoirService.create_organization(db, payload)

@router.patch("/organizations/{org_id}", response_model=OrganizationOut)
async def update_organization(
    org_id: UUID,
    payload: OrganizationUpdate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user)
):
    """Update an organization. Requires org 'owner' or platform 'super_admin'."""
    return await NoirService.update_organization(db, user.id, org_id, payload)

# ======================
# Venues
# ======================
@router.get("/venues", response_model=List[VenueOut])
async def list_venues(city: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    """List active venues, optionally filtered by city."""
    return await NoirService.list_venues(db, city)

@router.get("/venues/{venue_id}", response_model=VenueOut)
async def get_venue(venue_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get a specific venue."""
    return await NoirService.get_venue(db, venue_id)

@router.post("/venues", response_model=VenueOut, status_code=status.HTTP_201_CREATED)
async def create_venue(
    payload: VenueCreate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user)
):
    """Create a new venue. Requires 'owner' or 'admin' of the organization."""
    return await NoirService.create_venue(db, user.id, payload)
