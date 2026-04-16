"""
Profile-related schemas (non-auth).

Auth/session shapes live in app/schemas/auth.py.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ProfileUpdate(BaseModel):
    """Fields a user can change on their own profile."""
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    avatar_url: Optional[str] = None
    phone: Optional[str] = Field(None, max_length=50)
    city: Optional[str] = Field(None, max_length=100)


class ProfileOut(BaseModel):
    id: UUID
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    avatar_url: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    claimed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProfileList(BaseModel):
    items: List[ProfileOut]
    total: int
    page: int
    page_size: int
    total_pages: int
