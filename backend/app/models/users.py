import uuid
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    clerk_id: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    plan: Mapped[str] = mapped_column(String(50), default="free", nullable=False)  # free, starter, pro, team
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    workspace_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, server_default=func.now()
    )

    # Relationships
    conversations: Mapped[List["Conversation"]] = relationship(  # noqa: F821
        "Conversation", back_populates="user", cascade="all, delete-orphan", lazy="select"
    )
    api_keys: Mapped[List["ApiKey"]] = relationship(  # noqa: F821
        "ApiKey", back_populates="user", cascade="all, delete-orphan", lazy="select"
    )
    usage_logs: Mapped[List["UsageLog"]] = relationship(  # noqa: F821
        "UsageLog", back_populates="user", cascade="all, delete-orphan", lazy="select"
    )
    subscription: Mapped[Optional["Subscription"]] = relationship(  # noqa: F821
        "Subscription", back_populates="user", uselist=False, lazy="select"
    )
    workspace: Mapped[Optional["Workspace"]] = relationship(  # noqa: F821
        "Workspace", foreign_keys=[workspace_id], lazy="select"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email}>"
