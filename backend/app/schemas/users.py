import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, ConfigDict


class UserCreate(BaseModel):
    """Schema for creating a user from Clerk webhook."""
    clerk_id: str
    email: EmailStr
    name: str
    avatar_url: Optional[str] = None


class UserUpdate(BaseModel):
    """Schema for updating user profile."""
    name: Optional[str] = None
    avatar_url: Optional[str] = None


class UserResponse(BaseModel):
    """Full user response including internal fields."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    clerk_id: str
    email: str
    name: str
    avatar_url: Optional[str] = None
    plan: str
    is_admin: bool
    workspace_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime


class UserPublic(BaseModel):
    """Public-facing user representation (safe to share)."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str
    avatar_url: Optional[str] = None
    plan: str


class UserWithSubscription(UserResponse):
    """User response with embedded subscription info."""
    model_config = ConfigDict(from_attributes=True)

    subscription: Optional["SubscriptionSummary"] = None


class SubscriptionSummary(BaseModel):
    """Lightweight subscription info embedded in user responses."""
    model_config = ConfigDict(from_attributes=True)

    plan: str
    status: str
    token_quota_monthly: int
    token_used_this_month: int


UserWithSubscription.model_rebuild()
