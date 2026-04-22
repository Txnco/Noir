"""
Auth-related response schemas.

Login and registration are handled entirely by Supabase Auth on the client
(see apps/web/lib/auth/actions.ts). The backend only exposes `/auth/me`
so authenticated callers can load their profile + roles in one hop.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr


class ProfileOut(BaseModel):
    id: UUID
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    avatar_url: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    claimed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    avatar_url: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None


class OrgMembershipOut(BaseModel):
    org_id: UUID
    role: str  # owner | admin | staff
    is_active: bool


class CurrentUserResponse(BaseModel):
    id: UUID
    email: Optional[EmailStr] = None
    email_verified: bool
    profile: ProfileOut
    platform_role: str  # admin | staff | user
    memberships: List[OrgMembershipOut] = []


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    firstName: str
    lastName: str


class UserShort(BaseModel):
    id: UUID
    email: EmailStr


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_token: str
    user: UserShort
