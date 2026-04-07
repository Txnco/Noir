from pydantic import BaseModel, ConfigDict
from uuid import UUID
from typing import Optional, List
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
    status: str

class VenueBase(BaseModel):
    name: str
    city: str
    address: str
    venue_type: str

# ======================
# Output Schemas (for API responses)
# ======================
class VenueOut(VenueBase):
    id: UUID
    model_config = ConfigDict(from_attributes=True)

class EventDiscoveryOut(EventBase):
    """Schema for the swipe/discovery feed."""
    id: UUID
    # We will include venue info in the discovery card
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class EventDetailOut(EventDiscoveryOut):
    """Detailed event info including occurrences and tiers."""
    organizer_org_id: UUID
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
