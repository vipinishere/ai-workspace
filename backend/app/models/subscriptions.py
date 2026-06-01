import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    stripe_customer_id: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True
    )
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, index=True
    )
    plan: Mapped[str] = mapped_column(
        String(50), nullable=False, default="free"
    )  # free, starter, pro, team
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="active"
    )  # active, canceled, past_due, trialing
    selected_models: Mapped[Optional[list]] = mapped_column(
        JSONB, nullable=True, default=list
    )  # list of selected model IDs
    token_quota_monthly: Mapped[int] = mapped_column(Integer, default=100_000, nullable=False)
    token_used_this_month: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    billing_period_start: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    billing_period_end: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, server_default=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="subscription", lazy="select")  # noqa: F821

    def __repr__(self) -> str:
        return f"<Subscription user={self.user_id} plan={self.plan} status={self.status}>"
