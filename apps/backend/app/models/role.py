from sqlalchemy import Column, Integer, String, Table, ForeignKey, Index
from sqlalchemy.orm import relationship, validates
from app.models.base import Base

# Association table: roles ↔ permissions
role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
    Index("ix_role_permissions_role_id", "role_id"),
    Index("ix_role_permissions_permission_id", "permission_id"),
)


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    # store lowercased, unique (normalized via @validates)
    name = Column(String(64), nullable=False, unique=True, index=True)
    description = Column(String(255), nullable=True)

    permissions = relationship(
        "Permission",
        secondary=role_permissions,
        back_populates="roles",
        lazy="joined",
    )

    @validates("name")
    def _normalize_name(self, key, value: str) -> str:
        """Normalize role name to lowercase."""
        if not value or not value.strip():
            raise ValueError("Role name cannot be empty.")
        return value.strip().lower()
