from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship, validates
from app.models.base import Base


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    # machine-friendly code (e.g., "users:read") - normalized via @validates
    code = Column(String(128), nullable=False, unique=True, index=True)
    # optional human-friendly label
    label = Column(String(255), nullable=True)

    roles = relationship(
        "Role",
        secondary="role_permissions",
        back_populates="permissions",
        lazy="selectin",
    )

    @validates("code")
    def _normalize_code(self, key, value: str) -> str:
        """Normalize permission code to lowercase."""
        if not value or not value.strip():
            raise ValueError("Permission code cannot be empty.")
        return value.strip().lower()
