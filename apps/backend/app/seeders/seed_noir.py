"""
Noir Data Seeder
Seeds organizations and events for testing the Noir discovery feed.
"""
import asyncio
import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.noir import Organization, Event

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
                is_active=True,
                is_verified=True
            )
            db.add(org)
            await db.flush()
            print(f"✅ Created Organization: {org.name} ({org.id})")
        else:
            print(f"ℹ️ Organization already exists: {org.name}")

        # 2. Create test events
        events_to_seed = [
            {
                "name": "Midnight Noir Session",
                "slug": "midnight-noir-session",
                "description": "An exclusive night of deep house and techno.",
                "status": "published",
                "min_age": 21
            },
            {
                "name": "Skyline Rooftop Party",
                "slug": "skyline-rooftop-party",
                "description": "Summer vibes with a view.",
                "status": "published",
                "min_age": 18
            }
        ]

        for ev_data in events_to_seed:
            res = await db.execute(select(Event).where(Event.slug == ev_data["slug"]))
            existing_ev = res.scalars().first()
            
            if not existing_ev:
                new_event = Event(
                    id=uuid.uuid4(),
                    organizer_org_id=org.id,
                    name=ev_data["name"],
                    slug=ev_data["slug"],
                    description=ev_data["description"],
                    status=ev_data["status"],
                    min_age=ev_data["min_age"],
                    is_free=False
                )
                db.add(new_event)
                print(f"✅ Created Event: {ev_data['name']}")
            else:
                print(f"ℹ️ Event already exists: {ev_data['name']}")

        await db.commit()
        print("✨ Noir seeding complete!")

if __name__ == "__main__":
    asyncio.run(seed_noir_data())
