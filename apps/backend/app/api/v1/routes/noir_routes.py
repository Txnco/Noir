from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.core.database import get_db
from app.models.noir import Event
from app.schemas.noir import EventDiscoveryOut

router = APIRouter(prefix="/noir", tags=["Noir Core"])

@router.get("/events", response_model=List[EventDiscoveryOut])
async def list_events_discovery(
    db: AsyncSession = Depends(get_db)
):
    """
    Discovery Feed: Get a list of published events for the swipe discovery screen.
    """
    # Fetch all events with 'published' status
    stmt = select(Event).where(Event.status == "published")
    result = await db.execute(stmt)
    events = result.scalars().all()
    
    return events
