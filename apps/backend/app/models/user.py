from sqlalchemy import Table, Column, String, Boolean, DateTime, ForeignKey, Index, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from app.models.base import Base

# Many-to-many link between users and roles
user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Index("ix_user_roles_user_id", "user_id"),
    Index("ix_user_roles_role_id", "role_id"),
)

class User(Base):
    __tablename__ = "users"
    
    # Use UUID to match Supabase Auth
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    firstName = Column(String(100), index=True, nullable=False)
    lastName = Column(String(100), index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=True) 
    
    # Account status
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    
    # Supabase / OAuth2 Support
    external_sub = Column(String(255), unique=True, index=True, nullable=True)
    external_provider = Column(String(50), nullable=True) 
    
    # Security tracking
    password_reset_token_hash = Column(String(255), nullable=True, index=True)
    password_reset_expires = Column(DateTime(timezone=True), nullable=True)
    email_verification_token_hash = Column(String(255), nullable=True, index=True)
    refresh_token_hash = Column(String(255), nullable=True)
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
        if hasattr(self, "_cached_roles"):
            return role_name.lower() in self._cached_roles
        return any(r.name == role_name.lower() for r in self.roles)
    
    def has_permission(self, permission_code: str) -> bool:
        for role in self.roles:
            if any(p.code == permission_code.lower() for p in role.permissions):
                return True
        return False
    
    def get_permissions(self) -> set:
        perms = set()
        for role in self.roles:
            perms.update(p.code for p in role.permissions)
        return perms
    
    def is_locked(self) -> bool:
        if self.locked_until is None:
            return False
        return datetime.now(timezone.utc) < self.locked_until
