from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID, uuid4
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.security import CurrentUser, get_current_user
from app.models.noir import Ticket, EventOccurrence, EventTier
from pydantic import BaseModel, ConfigDict

router = APIRouter(prefix="/tickets", tags=["Tickets"])

# ======================
# Schemas
# ======================
class TicketPurchase(BaseModel):
    occurrence_id: UUID
    tier_id: UUID

class TicketOut(BaseModel):
    id: UUID
    occurrence_id: UUID
    tier_id: UUID
    qr_token: str
    status: str
    purchased_at: datetime
    model_config = ConfigDict(from_attributes=True)

# ======================
# Routes
# ======================

@router.post("/purchase", response_model=TicketOut, status_code=status.HTTP_201_CREATED)
async def purchase_ticket(
    payload: TicketPurchase,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Fake purchase endpoint. 
    Creates a ticket in 'active' status immediately.
    """
    # Verify occurrence and tier exist
    stmt = select(EventOccurrence).where(EventOccurrence.id == payload.occurrence_id)
    occ_result = await db.execute(stmt)
    occurrence = occ_result.scalars().first()
    if not occurrence:
        raise HTTPException(status_code=404, detail="Occurrence not found")

    stmt = select(EventTier).where(EventTier.id == payload.tier_id)
    tier_result = await db.execute(stmt)
    tier = tier_result.scalars().first()
    if not tier:
        raise HTTPException(status_code=404, detail="Tier not found")

    # Create ticket
    new_ticket = Ticket(
        id=uuid4(),
        occurrence_id=payload.occurrence_id,
        user_id=user.id,
        tier_id=payload.tier_id,
        qr_token=uuid4().hex + uuid4().hex,
        status="active",
        purchased_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc)
    )
    
    db.add(new_ticket)
    
    # Update sold counts (demo purposes)
    occurrence.sold_count += 1
    tier.sold_count += 1
    
    await db.commit()
    await db.refresh(new_ticket)
    
    return new_ticket

@router.get("/my", response_model=List[TicketOut])
async def get_my_tickets(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all tickets for the current user."""
    stmt = select(Ticket).where(Ticket.user_id == user.id).order_by(Ticket.purchased_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()
