from sqlalchemy import Table, Column, Integer, String, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.models.base import Base


user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Index("ix_user_roles_user_id", "user_id"),
    Index("ix_user_roles_role_id", "role_id"),
)


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    firstName = Column(String(100), index=True, nullable=False)
    lastName = Column(String(100), index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True)  # Nullable for OAuth2 users
    
    # Account status
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    
    # OAuth2 / External provider support
    external_sub = Column(String(255), unique=True, index=True, nullable=True)
    external_provider = Column(String(50), nullable=True)  # e.g., "google", "github"
    
    # Password reset - STORE HASH, NOT TOKEN (security fix)
    password_reset_token_hash = Column(String(255), nullable=True, index=True)
    password_reset_expires = Column(DateTime(timezone=True), nullable=True)
    
    # Email verification - STORE HASH, NOT TOKEN (security fix)
    email_verification_token_hash = Column(String(255), nullable=True, index=True)
    
    # Refresh token - STORE HASH, NOT TOKEN (security fix)
    refresh_token_hash = Column(String(255), nullable=True)
    
    # Failed login tracking (for rate limiting)
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), 
                        onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    last_login = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    roles = relationship("Role", secondary="user_roles", backref="users", lazy="selectin")
    
    def has_role(self, role_name: str) -> bool:
        """Check if user has a specific role."""
        if hasattr(self, "_cached_roles"):
            return role_name.lower() in self._cached_roles
        return any(r.name == role_name.lower() for r in self.roles)
    
    def has_permission(self, permission_code: str) -> bool:
        """Check if user has a specific permission through any of their roles."""
        for role in self.roles:
            if any(p.code == permission_code.lower() for p in role.permissions):
                return True
        return False
    
    def get_permissions(self) -> set:
        """Get all permission codes for this user."""
        if hasattr(self, "_cached_permissions"):
            return set(self._cached_permissions)
        perms = set()
        for role in self.roles:
            perms.update(p.code for p in role.permissions)
        return perms
    
    def is_locked(self) -> bool:
        """Check if account is temporarily locked."""
        if self.locked_until is None:
            return False
        return datetime.now(timezone.utc) < self.locked_until