from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from typing import Optional, List, Any
from datetime import datetime
from decimal import Decimal

# ======================
# Base Schemas
# ======================
class EventBase(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    min_age: int = 0
    is_free: bool = False
    status: str = "draft"

class VenueBase(BaseModel):
    name: str
    slug: str
    city: str
    address: str
    venue_type: str
    country: str = "HR"

class OrganizationBase(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    contact_email: Optional[str] = None
    website: Optional[str] = None

# ======================
# Create/Update Schemas
# ======================
class OrganizationCreate(OrganizationBase):
    pass

class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None

class VenueCreate(VenueBase):
    org_id: UUID
    description: Optional[str] = None
    lat: Optional[Decimal] = None
    lng: Optional[Decimal] = None
    total_capacity: Optional[int] = None

class VenueUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    total_capacity: Optional[int] = None
    is_active: Optional[bool] = None

class EventCreate(EventBase):
    organizer_org_id: UUID

class EventUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    min_age: Optional[int] = None
    is_free: Optional[bool] = None
    status: Optional[str] = None

# ======================
# Output Schemas (for API responses)
# ======================
class OrganizationOut(OrganizationBase):
    id: UUID
    is_verified: bool
    is_active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class VenueOut(VenueBase):
    id: UUID
    org_id: UUID
    total_capacity: Optional[int] = None
    photos: List[str] = []
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

class EventDiscoveryOut(EventBase):
    """Schema for the swipe/discovery feed."""
    id: UUID
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class EventDetailOut(EventDiscoveryOut):
    """Detailed event info including occurrences and tiers."""
    organizer_org_id: UUID
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

# ======================
# Detailed Output Schemas (with relationships)
# ======================
class OrganizationDetail(OrganizationOut):
    venues: List[VenueOut] = []

class EventOccurrenceOut(BaseModel):
    id: UUID
    occurrence_date: datetime
    start_time: datetime
    end_time: Optional[datetime] = None
    status: str
    sold_count: int
    total_capacity: int
    model_config = ConfigDict(from_attributes=True)
