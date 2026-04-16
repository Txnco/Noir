"""
Profile + org-membership + platform-role models.

These mirror Supabase's auth model:
  - auth.users        → identity, owned by Supabase (not mapped here)
  - public.profiles   → 1:1 extension table, PK = auth.users.id
  - user_platform_roles → platform-wide role (admin/staff/user)
  - organization_members → org-scoped role (owner/admin/staff)
  - user_preferences  → optional per-user settings

We never write to auth.users from Python — Supabase owns it. profiles is
populated by the `on_auth_user_created` trigger.
"""
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Date, Text, DECIMAL, Integer, Enum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid

from app.models.base import Base


class Profile(Base):
    __tablename__ = "profiles"

    # PK is the auth.users.id — same UUID, not a separate key.
    id = Column(UUID(as_uuid=True), primary_key=True)
    first_name = Column(String(100), nullable=True)
    last_name = Column(String(100), nullable=True)
    avatar_url = Column(Text, nullable=True)
    date_of_birth = Column(Date, nullable=True)
    phone = Column(String(50), nullable=True)
    city = Column(String(100), nullable=True)
    claimed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    platform_role = relationship("UserPlatformRole", uselist=False, back_populates="profile", lazy="joined")
    memberships = relationship("OrganizationMember", back_populates="profile", lazy="selectin")
    preferences = relationship("UserPreference", uselist=False, back_populates="profile")


class UserPlatformRole(Base):
    __tablename__ = "user_platform_roles"

    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), primary_key=True)
    role = Column(
        Enum("admin", "staff", "user", name="platform_role", create_type=False),
        nullable=False,
    )
    granted_by = Column(UUID(as_uuid=True), nullable=True)
    granted_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    profile = relationship("Profile", back_populates="platform_role")


class OrganizationMember(Base):
    __tablename__ = "organization_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    role = Column(
        Enum("owner", "admin", "staff", name="org_member_role", create_type=False),
        nullable=False,
        default="staff",
    )
    invited_by = Column(UUID(as_uuid=True), nullable=True)
    invited_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    joined_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    __table_args__ = (UniqueConstraint("org_id", "user_id", name="uq_org_member"),)

    profile = relationship("Profile", back_populates="memberships")


class UserPreference(Base):
    __tablename__ = "user_preferences"

    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"), primary_key=True)
    interest_tags = Column(ARRAY(Text), default=list, nullable=False)
    preferred_days = Column(ARRAY(Integer), default=list, nullable=False)
    price_cap = Column(DECIMAL(8, 2), nullable=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    profile = relationship("Profile", back_populates="preferences")
