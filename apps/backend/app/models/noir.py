from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, DECIMAL, Integer, JSON, ARRAY
from sqlalchemy.dialects.postgresql import UUID, JSONB, TSTZRANGE, ENUM
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from app.models.base import Base

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)

    # Capability flags
    can_organize = Column(Boolean, nullable=False, default=False)
    can_own_venues = Column(Boolean, nullable=False, default=False)

    # Currency
    default_currency = Column(String(3), nullable=False, default='EUR')

    # Profile info
    logo_url = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    website = Column(String(255), nullable=True)

    # Finance
    tax_id = Column(String(100), nullable=True)
    bank_account_iban = Column(String(50), nullable=True)
    bank_account_name = Column(String(255), nullable=True)

    # Location
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    country = Column(String(2), default='HR')

    # Status
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    venues = relationship("Venue", back_populates="organization")

class Venue(Base):
    __tablename__ = "venues"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    venue_type = Column(ENUM('club', 'bar', 'concert_hall', 'outdoor', 'sports_arena', 'theater', 'restaurant', 'rooftop', 'other', name='venue_type'), nullable=False)
    visibility = Column(ENUM('public', 'private', 'unlisted', name='venue_visibility'), nullable=False, default='public')
    description = Column(Text, nullable=True)
    address = Column(Text, nullable=False)
    city = Column(String(100), nullable=False)
    country = Column(String(2), default='HR')
    lat = Column(DECIMAL(10, 8), nullable=True)
    lng = Column(DECIMAL(11, 8), nullable=True)
    timezone = Column(String(50), nullable=False, default='Europe/Zagreb')

    total_capacity = Column(Integer, nullable=True)
    photos = Column(ARRAY(Text), default=[])
    amenities = Column(JSONB, nullable=True)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    organization = relationship("Organization", back_populates="venues")
    layouts = relationship("VenueLayout", back_populates="venue")

class VenueLayout(Base):
    __tablename__ = "venue_layouts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    venue_id = Column(UUID(as_uuid=True), ForeignKey("venues.id", ondelete="CASCADE"), nullable=False)
    version = Column(Integer, nullable=False)
    file_path = Column(String(500), nullable=False)
    total_capacity = Column(Integer, nullable=True)
    is_current = Column(Boolean, nullable=False, default=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(UUID(as_uuid=True), nullable=True) # Point to auth.users.id
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    venue = relationship("Venue", back_populates="layouts")
    occurrences = relationship("EventOccurrence", back_populates="layout")

class Event(Base):
    __tablename__ = "events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organizer_org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    cover_image_url = Column(Text, nullable=True)
    min_age = Column(Integer, default=0)
    is_free = Column(Boolean, default=False)
    status = Column(ENUM('draft', 'pending_venue', 'venue_confirmed', 'published', 'cancelled', 'completed', name='event_status'), nullable=False, default='draft')

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    occurrences = relationship("EventOccurrence", back_populates="event")

class EventOccurrence(Base):
    __tablename__ = "event_occurrences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="RESTRICT"), nullable=False)
    venue_id = Column(UUID(as_uuid=True), ForeignKey("venues.id"), nullable=False)
    venue_layout_id = Column(UUID(as_uuid=True), ForeignKey("venue_layouts.id"), nullable=False)
    
    occurrence_date = Column(DateTime, nullable=False)
    doors_time = Column(DateTime, nullable=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)

    status = Column(ENUM('scheduled', 'on_sale', 'sold_out', 'cancelled', 'completed', name='occurrence_status'), nullable=False, default='scheduled')
    total_capacity = Column(Integer, nullable=False)
    sold_count = Column(Integer, default=0)
    max_seats_per_checkout = Column(Integer, default=10)

    rental_terms_snapshot = Column(JSONB, nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    event = relationship("Event", back_populates="occurrences")
    layout = relationship("VenueLayout", back_populates="occurrences")
    tiers = relationship("EventTier", back_populates="occurrence")
    tickets = relationship("Ticket", back_populates="occurrence")

class EventTier(Base):
    __tablename__ = "event_tiers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    occurrence_id = Column(UUID(as_uuid=True), ForeignKey("event_occurrences.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    price = Column(DECIMAL(10, 2), nullable=False, default=0)
    currency = Column(String(3), default='EUR')
    total_count = Column(Integer, nullable=False)
    sold_count = Column(Integer, default=0)
    sale_start = Column(DateTime(timezone=True), nullable=True)
    sale_end = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)

    # Relationships
    occurrence = relationship("EventOccurrence", back_populates="tiers")
    tickets = relationship("Ticket", back_populates="tier")

class OccurrencePackage(Base):
    __tablename__ = "occurrence_packages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    occurrence_id = Column(UUID(as_uuid=True), ForeignKey("event_occurrences.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    price = Column(DECIMAL(10, 2), nullable=False, default=0)
    currency = Column(String(3), default='EUR')

    tier_id = Column(UUID(as_uuid=True), ForeignKey("event_tiers.id"), nullable=True)
    entries_included = Column(Integer, nullable=False, default=1)
    drinks_included = Column(Integer, default=0)
    items = Column(JSONB, nullable=True)
    
    max_quantity = Column(Integer, nullable=True)
    sold_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)

class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    occurrence_id = Column(UUID(as_uuid=True), ForeignKey("event_occurrences.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    tier_id = Column(UUID(as_uuid=True), ForeignKey("event_tiers.id"), nullable=False)
    package_id = Column(UUID(as_uuid=True), ForeignKey("occurrence_packages.id"), nullable=True)
    
    qr_token = Column(String(255), unique=True, nullable=False, default=lambda: uuid.uuid4().hex + uuid.uuid4().hex)
    status = Column(ENUM('reserved', 'pending_payment', 'active', 'scanned', 'cancelled', 'refunded', 'expired', name='ticket_status'), nullable=False, default='pending_payment')
    remaining_drinks = Column(Integer, default=0)
    
    scanned_at = Column(DateTime(timezone=True), nullable=True)
    purchased_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    occurrence = relationship("EventOccurrence", back_populates="tickets")
    tier = relationship("EventTier", back_populates="tickets")
