from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from uuid import UUID

from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user
from app.services.rbac import require_platform_roles, get_org_roles
from app.models.noir import Event, Organization, Venue
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
    VenueCreate,
    VenueUpdate
)

router = APIRouter(prefix="/noir", tags=["Noir Core"])

# ======================
# Events
# ======================
@router.get("/events", response_model=List[EventDiscoveryOut])
async def list_events(
    status: Optional[str] = Query("published", description="Filter by status"),
    org_id: Optional[UUID] = Query(None, description="Filter by organization"),
    db: AsyncSession = Depends(get_db)
):
    """Get a list of events. Defaults to published events."""
    stmt = select(Event)
    if status:
        stmt = stmt.where(Event.status == status)
    if org_id:
        stmt = stmt.where(Event.organizer_org_id == org_id)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/events/{event_id}", response_model=EventDetailOut)
async def get_event(event_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get detailed information about a specific event."""
    stmt = select(Event).where(Event.id == event_id)
    result = await db.execute(stmt)
    event = result.scalars().first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event

@router.post("/events", response_model=EventDetailOut, status_code=status.HTTP_201_CREATED)
async def create_event(
    payload: EventCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new event. Requires 'owner' or 'admin' role in the organization."""
    roles = await get_org_roles(db, user.id)
    if roles.get(str(payload.organizer_org_id)) not in ("owner", "admin"):
        # Check platform admin fallback
        from app.services.rbac import get_platform_role
        if await get_platform_role(db, user.id) != "admin":
            raise HTTPException(status_code=403, detail="Not authorized for this organization")
    
    new_event = Event(**payload.model_dump())
    db.add(new_event)
    await db.commit()
    await db.refresh(new_event)
    return new_event

@router.patch("/events/{event_id}", response_model=EventDetailOut)
async def update_event(
    event_id: UUID,
    payload: EventUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update an event. Requires 'owner' or 'admin' role in the organization."""
    stmt = select(Event).where(Event.id == event_id)
    result = await db.execute(stmt)
    event = result.scalars().first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    roles = await get_org_roles(db, user.id)
    if roles.get(str(event.organizer_org_id)) not in ("owner", "admin"):
        from app.services.rbac import get_platform_role
        if await get_platform_role(db, user.id) != "admin":
            raise HTTPException(status_code=403, detail="Not authorized for this organization")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(event, field, value)
    
    await db.commit()
    await db.refresh(event)
    return event

# ======================
# Organizations
# ======================
@router.get("/organizations", response_model=List[OrganizationOut])
async def list_organizations(db: AsyncSession = Depends(get_db)):
    """List all active organizations."""
    stmt = select(Organization).where(Organization.is_active == True)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/organizations/{org_id}", response_model=OrganizationDetail)
async def get_organization(org_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get detailed info for an organization including its venues."""
    stmt = select(Organization).where(Organization.id == org_id).options(
        selectinload(Organization.venues)
    )
    result = await db.execute(stmt)
    org = result.scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org

@router.post("/organizations", response_model=OrganizationOut, status_code=status.HTTP_201_CREATED)
async def create_organization(
    payload: OrganizationCreate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(require_platform_roles("admin"))
):
    """Create a new organization. Platform Admin only."""
    new_org = Organization(**payload.model_dump())
    db.add(new_org)
    await db.commit()
    await db.refresh(new_org)
    return new_org

@router.patch("/organizations/{org_id}", response_model=OrganizationOut)
async def update_organization(
    org_id: UUID,
    payload: OrganizationUpdate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user)
):
    """Update an organization. Requires 'owner' or platform 'admin'."""
    stmt = select(Organization).where(Organization.id == org_id)
    result = await db.execute(stmt)
    org = result.scalars().first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
        
    roles = await get_org_roles(db, user.id)
    if roles.get(str(org_id)) != "owner":
        from app.services.rbac import get_platform_role
        if await get_platform_role(db, user.id) != "admin":
            raise HTTPException(status_code=403, detail="Only the organization owner can update details")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(org, field, value)
    
    await db.commit()
    await db.refresh(org)
    return org

# ======================
# Venues
# ======================
@router.get("/venues", response_model=List[VenueOut])
async def list_venues(city: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    """List active venues, optionally filtered by city."""
    stmt = select(Venue).where(Venue.is_active == True)
    if city:
        stmt = stmt.where(Venue.city.ilike(f"%{city}%"))
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/venues/{venue_id}", response_model=VenueOut)
async def get_venue(venue_id: UUID, db: AsyncSession = Depends(get_db)):
    """Get a specific venue."""
    stmt = select(Venue).where(Venue.id == venue_id)
    result = await db.execute(stmt)
    venue = result.scalars().first()
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    return venue

@router.post("/venues", response_model=VenueOut, status_code=status.HTTP_201_CREATED)
async def create_venue(
    payload: VenueCreate,
    db: AsyncSession = Depends(get_db),
    user: CurrentUser = Depends(get_current_user)
):
    """Create a new venue. Requires 'owner' or 'admin' of the organization."""
    roles = await get_org_roles(db, user.id)
    if roles.get(str(payload.org_id)) not in ("owner", "admin"):
        from app.services.rbac import get_platform_role
        if await get_platform_role(db, user.id) != "admin":
            raise HTTPException(status_code=403, detail="Not authorized for this organization")
            
    new_venue = Venue(**payload.model_dump())
    db.add(new_venue)
    await db.commit()
    await db.refresh(new_venue)
    return new_venue
