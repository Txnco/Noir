"""
Noir Data Seeder
Seeds organizations, venues, layouts, and events for testing the Noir discovery feed.
"""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.noir import Organization, Event, Venue, VenueLayout, EventOccurrence, EventTier

async def seed_noir_data():
    async with AsyncSessionLocal() as db:
        print("🌱 Seeding Noir test data...")
        
        # 1. Create or get a test organization
        org_slug = "test-org"
        result = await db.execute(select(Organization).where(Organization.slug == org_slug))
        org = result.scalars().first()
        
        if not org:
            org = Organization(
                id=uuid.uuid4(),
                name="Test Entertainment Group",
                slug=org_slug,
                can_organize=True,
                can_own_venues=True,
                is_active=True,
                is_verified=True
            )
            db.add(org)
            await db.flush()
            print(f"✅ Created Organization: {org.name} ({org.id})")
        else:
            print(f"ℹ️ Organization already exists: {org.name}")

        # 2. Create a test venue
        venue_slug = "club-boogaloo"
        result = await db.execute(select(Venue).where(Venue.slug == venue_slug))
        venue = result.scalars().first()
        
        if not venue:
            venue = Venue(
                id=uuid.uuid4(),
                org_id=org.id,
                name="Club Boogaloo",
                slug=venue_slug,
                venue_type="club",
                address="Ulica grada Vukovara 68",
                city="Zagreb",
                total_capacity=500
            )
            db.add(venue)
            await db.flush()
            print(f"✅ Created Venue: {venue.name}")
        else:
            print(f"ℹ️ Venue already exists: {venue.name}")

        # 3. Create a venue layout
        result = await db.execute(select(VenueLayout).where(VenueLayout.venue_id == venue.id))
        layout = result.scalars().first()
        
        if not layout:
            layout = VenueLayout(
                id=uuid.uuid4(),
                venue_id=venue.id,
                version=1,
                file_path=f"/venues/{org.id}/{venue.id}/v1.json",
                total_capacity=500,
                is_current=True
            )
            db.add(layout)
            await db.flush()
            print(f"✅ Created Layout for {venue.name}")
        else:
            print(f"ℹ️ Layout already exists for {venue.name}")

        # 4. Create test events
        events_to_seed = [
            {
                "name": "Neon Nights",
                "slug": "neon-nights",
                "description": "An exclusive night of deep house and techno.",
                "status": "published",
                "min_age": 21,
                "price": 8.00
            },
            {
                "name": "Skyline Rooftop Party",
                "slug": "skyline-rooftop-party",
                "description": "Summer vibes with a view.",
                "status": "published",
                "min_age": 18,
                "price": 12.00
            }
        ]

        now = datetime.now(timezone.utc)

        for i, ev_data in enumerate(events_to_seed):
            res = await db.execute(select(Event).where(Event.slug == ev_data["slug"]))
            existing_ev = res.scalars().first()
            
            if not existing_ev:
                event = Event(
                    id=uuid.uuid4(),
                    organizer_org_id=org.id,
                    name=ev_data["name"],
                    slug=ev_data["slug"],
                    description=ev_data["description"],
                    status=ev_data["status"],
                    min_age=ev_data["min_age"],
                    is_free=False
                )
                db.add(event)
                await db.flush()
                
                # Add occurrence
                occ_date = now + timedelta(days=i+1)
                occurrence = EventOccurrence(
                    id=uuid.uuid4(),
                    event_id=event.id,
                    venue_id=venue.id,
                    venue_layout_id=layout.id,
                    occurrence_date=occ_date.replace(tzinfo=None),
                    start_time=occ_date.replace(hour=22, minute=0, second=0, microsecond=0, tzinfo=None),
                    status="on_sale",
                    total_capacity=500
                )
                db.add(occurrence)
                await db.flush()
                
                # Add Tier
                tier = EventTier(
                    id=uuid.uuid4(),
                    occurrence_id=occurrence.id,
                    name="Regular",
                    price=ev_data["price"],
                    total_count=500,
                    is_active=True
                )
                db.add(tier)
                
                print(f"✅ Created Event: {ev_data['name']} with occurrence and tier")
            else:
                print(f"ℹ️ Event already exists: {ev_data['name']}")

        await db.commit()
        print("✨ Noir seeding complete!")

if __name__ == "__main__":
    asyncio.run(seed_noir_data())
