"""
Noir Dummy Data Seeder
Populates the database with realistic organizations, venues, and events for development.
"""
import asyncio
import uuid
import random
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.noir import Organization, Venue, VenueLayout, Event, EventOccurrence, EventTier

async def seed_dummy_data():
    async with AsyncSessionLocal() as db:
        print("🌱 Seeding rich dummy data for Noir...")
        
        # 1. Create Organizations
        orgs_data = [
            {
                "name": "Noir Events Zagreb",
                "slug": "noir-events-zg",
                "city": "Zagreb",
                "description": "Leading electronic music promoter in Croatia."
            },
            {
                "name": "Rooftop Nights",
                "slug": "rooftop-nights",
                "city": "Split",
                "description": "Premium summer experiences with the best views."
            },
            {
                "name": "Underground Pulse",
                "slug": "underground-pulse",
                "city": "Rijeka",
                "description": "Raw techno events in industrial locations."
            }
        ]
        
        org_objs = []
        for o_data in orgs_data:
            res = await db.execute(select(Organization).where(Organization.slug == o_data["slug"]))
            org = res.scalars().first()
            if not org:
                org = Organization(
                    id=uuid.uuid4(),
                    name=o_data["name"],
                    slug=o_data["slug"],
                    city=o_data["city"],
                    description=o_data["description"],
                    can_organize=True,
                    can_own_venues=True,
                    is_verified=True
                )
                db.add(org)
                print(f"✅ Created Org: {org.name}")
            org_objs.append(org)
        await db.flush()

        # 2. Create Venues for these Orgs
        venue_types = ['club', 'rooftop', 'concert_hall', 'outdoor']
        venue_objs = []
        for i, org in enumerate(org_objs):
            v_slug = f"venue-{org.slug}"
            res = await db.execute(select(Venue).where(Venue.slug == v_slug))
            venue = res.scalars().first()
            if not venue:
                venue = Venue(
                    id=uuid.uuid4(),
                    org_id=org.id,
                    name=f"{org.name} Venue",
                    slug=v_slug,
                    venue_type=venue_types[i % len(venue_types)],
                    address=f"Street {i+1}, {org.city}",
                    city=org.city,
                    total_capacity=500 + (i * 200),
                    is_active=True
                )
                db.add(venue)
                print(f"✅ Created Venue: {venue.name}")
            venue_objs.append(venue)
        await db.flush()

        # 3. Create Venue Layouts
        layout_objs = []
        for venue in venue_objs:
            res = await db.execute(select(VenueLayout).where(VenueLayout.venue_id == venue.id))
            layout = res.scalars().first()
            if not layout:
                layout = VenueLayout(
                    id=uuid.uuid4(),
                    venue_id=venue.id,
                    version=1,
                    file_path=f"/layouts/{venue.slug}-v1.json",
                    total_capacity=venue.total_capacity,
                    is_current=True
                )
                db.add(layout)
                print(f"✅ Created Layout for: {venue.name}")
            layout_objs.append(layout)
        await db.flush()

        # 4. Create Events
        event_names = [
            "Midnight Techno Session", "Solar Terrace Party", "Industrial Echo",
            "Neon Jungle", "Basement Rhythms", "Summit House"
        ]
        
        event_objs = []
        for i, name in enumerate(event_names):
            e_slug = name.lower().replace(" ", "-")
            res = await db.execute(select(Event).where(Event.slug == e_slug))
            event = res.scalars().first()
            if not event:
                event = Event(
                    id=uuid.uuid4(),
                    organizer_org_id=random.choice(org_objs).id,
                    name=name,
                    slug=e_slug,
                    description=f"An amazing {name} experience you won't forget.",
                    min_age=18 if i % 2 == 0 else 21,
                    status='published'
                )
                db.add(event)
                print(f"✅ Created Event: {event.name}")
            event_objs.append(event)
        await db.flush()

        # 5. Create Occurrences and Tiers
        now = datetime.now(timezone.utc)
        for i, event in enumerate(event_objs):
            # Check if occurrence already exists
            res = await db.execute(select(EventOccurrence).where(EventOccurrence.event_id == event.id))
            if not res.scalars().first():
                # Plan occurrence for future dates
                start_dt = now + timedelta(days=7 + (i * 3), hours=22)
                end_dt = start_dt + timedelta(hours=6)
                
                venue = random.choice(venue_objs)
                layout = next(l for l in layout_objs if l.venue_id == venue.id)
                
                occ = EventOccurrence(
                    id=uuid.uuid4(),
                    event_id=event.id,
                    venue_id=venue.id,
                    venue_layout_id=layout.id,
                    occurrence_date=start_dt.replace(tzinfo=None),
                    start_time=start_dt.replace(tzinfo=None),
                    end_time=end_dt.replace(tzinfo=None),
                    status='on_sale',
                    total_capacity=layout.total_capacity
                )
                db.add(occ)
                
                # Add Tiers for this occurrence
                tiers = [
                    {"name": "Early Bird", "price": 15.00, "count": int(occ.total_capacity * 0.2)},
                    {"name": "Regular", "price": 25.00, "count": int(occ.total_capacity * 0.7)},
                    {"name": "VIP", "price": 50.00, "count": int(occ.total_capacity * 0.1)}
                ]
                
                for t_data in tiers:
                    tier = EventTier(
                        id=uuid.uuid4(),
                        occurrence_id=occ.id,
                        name=t_data["name"],
                        price=t_data["price"],
                        total_count=t_data["count"]
                    )
                    db.add(tier)
                
                print(f"✅ Created Occurrence & Tiers for: {event.name}")

        await db.commit()
        print("✨ Rich dummy data seeding complete!")

if __name__ == "__main__":
    asyncio.run(seed_dummy_data())
