"""
Audit Log Model
Immutable records of who did what, when, to which resource.
Write-only — never update or delete audit logs.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, DateTime, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy import JSON

from app.models.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    actor_id = Column(Integer, nullable=True, index=True)
    actor_type = Column(String(50), nullable=False, default="user")  # user | service | admin
    action = Column(String(50), nullable=False, index=True)          # create | update | delete | login
    resource_type = Column(String(50), nullable=False, index=True)   # user | role | permission
    resource_id = Column(String(50), nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(255), nullable=True)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    request_id = Column(String(36), nullable=True, index=True)
    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
