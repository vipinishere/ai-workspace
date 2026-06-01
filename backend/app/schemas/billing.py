import uuid
from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict, HttpUrl, Field


class SubscriptionResponse(BaseModel):
    """Full subscription details."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    stripe_customer_id: str
    stripe_subscription_id: Optional[str] = None
    plan: str
    status: str
    selected_models: Optional[List[str]] = None
    token_quota_monthly: int
    token_used_this_month: int
    billing_period_start: Optional[datetime] = None
    billing_period_end: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class CreateCheckoutRequest(BaseModel):
    """Request to create a Stripe checkout session."""
    plan: str  # starter, pro, team
    success_url: str
    cancel_url: str


class CreateCheckoutResponse(BaseModel):
    """Response containing the Stripe checkout URL."""
    checkout_url: str
    session_id: Optional[str] = None


class CreatePortalRequest(BaseModel):
    """Request to create a Stripe billing portal session."""
    return_url: str


class CreatePortalResponse(BaseModel):
    """Response containing the billing portal URL."""
    portal_url: str


class UpdateSubscriptionRequest(BaseModel):
    """Request to update selected AI models on a subscription."""
    model_config = ConfigDict(populate_by_name=True)
    selected_models: List[str] = Field(..., alias="selectedModels")


class BillingLogResponse(BaseModel):
    """Single billing event log entry."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    stripe_event_id: str
    event_type: str
    amount_cents: int
    currency: str
    status: str
    created_at: datetime


class BillingLogsResponse(BaseModel):
    """Paginated list of billing logs."""
    items: List[BillingLogResponse]
    total: int
    page: int
    page_size: int
