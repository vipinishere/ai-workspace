"""
Billing router — Stripe checkout, portal, webhooks, subscription management.
"""

from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.users import User
from app.models.subscriptions import Subscription
from app.models.billing_logs import BillingLog
from app.schemas.billing import (
    SubscriptionResponse,
    CreateCheckoutRequest,
    CreateCheckoutResponse,
    UpdateSubscriptionRequest,
)
from app.services.billing import billing_service
from app.config import get_settings

router = APIRouter(prefix="/api/v1/billing", tags=["billing"])
settings = get_settings()

PLAN_PRICES = {
    "starter": settings.STRIPE_PRICE_ID_STARTER,
    "pro": settings.STRIPE_PRICE_ID_PRO,
    "team": settings.STRIPE_PRICE_ID_TEAM,
}


@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current user's subscription details."""
    sub = await billing_service.get_subscription(db, current_user.id)
    if not sub:
        # Create a free subscription
        sub = Subscription(
            id=uuid.uuid4(),
            user_id=current_user.id,
            stripe_customer_id="",
            plan="free",
            status="active",
            selected_models=["openai/gpt-4o-mini", "anthropic/claude-3-5-haiku"],
            token_quota_monthly=100_000,
        )
        db.add(sub)
        await db.commit()
        await db.refresh(sub)
    return SubscriptionResponse.model_validate(sub)


@router.post("/checkout", response_model=CreateCheckoutResponse)
async def create_checkout(
    payload: CreateCheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Checkout session."""
    price_id = PLAN_PRICES.get(payload.plan)
    if not price_id and settings.STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid plan '{payload.plan}'. Choose: starter, pro, team",
        )

    if not settings.STRIPE_SECRET_KEY:
        from app.services.billing import PLAN_QUOTAS
        from datetime import datetime, timezone
        sub_res = await db.execute(
            select(Subscription).where(Subscription.user_id == current_user.id)
        )
        sub = sub_res.scalar_one_or_none()
        if sub:
            sub.plan = payload.plan
            sub.status = "active"
            sub.token_quota_monthly = PLAN_QUOTAS.get(payload.plan, 100_000)
            sub.token_used_this_month = 0
            sub.updated_at = datetime.now(timezone.utc)
            db.add(sub)
        
        current_user.plan = payload.plan
        current_user.updated_at = datetime.now(timezone.utc)
        db.add(current_user)
        await db.commit()

        return CreateCheckoutResponse(
            checkout_url=payload.success_url or f"{settings.FRONTEND_URL}/dashboard/billing?success=true",
            session_id="sess_mock_" + uuid.uuid4().hex[:12]
        )

    customer_id = await billing_service.get_or_create_customer(db, current_user)

    checkout_url = await billing_service.create_checkout_session(
        customer_id=customer_id,
        price_id=price_id,
        success_url=payload.success_url or f"{settings.FRONTEND_URL}/dashboard/billing?success=true",
        cancel_url=payload.cancel_url or f"{settings.FRONTEND_URL}/dashboard/billing",
        user_id=str(current_user.id),
    )

    return CreateCheckoutResponse(checkout_url=checkout_url)


@router.post("/portal")
async def create_portal(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a Stripe Customer Portal session."""
    sub = await billing_service.get_subscription(db, current_user.id)
    if not sub or not sub.stripe_customer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No billing account found. Please subscribe first.",
        )

    portal_url = await billing_service.create_billing_portal(
        customer_id=sub.stripe_customer_id,
        return_url=f"{settings.FRONTEND_URL}/dashboard/billing",
    )
    return {"portal_url": portal_url}


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Handle Stripe webhook events."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        result = await billing_service.handle_webhook(db, payload, sig_header)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/subscription/models")
async def update_selected_models(
    payload: UpdateSubscriptionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the user's selected AI models."""
    from app.services.ai_router import MODEL_REGISTRY

    # Validate model IDs
    invalid = [m for m in payload.selected_models if m not in MODEL_REGISTRY]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown model IDs: {invalid}",
        )

    sub = await billing_service.update_selected_models(
        db, current_user.id, payload.selected_models
    )
    return {"selected_models": sub.selected_models, "count": len(sub.selected_models)}


@router.get("/invoices")
async def list_invoices(
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List billing logs / invoices."""
    result = await db.execute(
        select(BillingLog)
        .where(BillingLog.user_id == current_user.id)
        .order_by(desc(BillingLog.created_at))
        .limit(limit)
        .offset(offset)
    )
    logs = result.scalars().all()
    return {
        "invoices": [
            {
                "id": str(log.id),
                "event_type": log.event_type,
                "amount_cents": log.amount_cents,
                "amount_usd": log.amount_cents / 100,
                "currency": log.currency,
                "status": log.status,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ]
    }
