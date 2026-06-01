"""
Admin router — system-wide SaaS analytics and provider health monitoring.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import select, func, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_admin
from app.models.users import User
from app.models.workspaces import Workspace
from app.models.subscriptions import Subscription
from app.models.usage_logs import UsageLog
from app.models.billing_logs import BillingLog
from app.schemas.users import UserWithSubscription, SubscriptionSummary
from app.schemas.analytics import AdminStats
from app.services.health import get_health_status, check_all_providers

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@router.get("/stats", response_model=AdminStats)
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
) -> AdminStats:
    """Get platform-wide billing, user, and token usage aggregates."""
    # 1. Total counts
    total_users = await db.scalar(select(func.count(User.id))) or 0
    total_workspaces = await db.scalar(select(func.count(Workspace.id))) or 0

    # 2. Subscription counts
    active_subs = await db.scalar(
        select(func.count(Subscription.id)).where(
            and_(
                Subscription.plan != "free",
                Subscription.status == "active"
            )
        )
    ) or 0

    # 3. Monthly Recurring Revenue (estimated)
    # Starter=$15, Pro=$29, Team=$79
    sub_results = await db.execute(
        select(Subscription.plan, func.count(Subscription.id))
        .where(and_(Subscription.plan != "free", Subscription.status == "active"))
        .group_by(Subscription.plan)
    )
    plan_prices = {"starter": 15.0, "pro": 29.0, "team": 79.0, "enterprise": 299.0}
    mrr = 0.0
    for plan, count in sub_results.all():
        mrr += plan_prices.get(plan, 0.0) * count

    # 4. Total revenue
    total_revenue_cents = await db.scalar(
        select(func.sum(BillingLog.amount_cents)).where(BillingLog.status == "processed")
    ) or 0
    total_revenue = float(total_revenue_cents) / 100.0

    # 5. Tokens today
    start_of_today = _utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    tokens_today = await db.scalar(
        select(func.sum(UsageLog.total_tokens)).where(
            and_(
                UsageLog.created_at >= start_of_today,
                UsageLog.status == "success"
            )
        )
    ) or 0

    # 6. New users this month
    start_of_month = _utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    new_users_this_month = await db.scalar(
        select(func.count(User.id)).where(User.created_at >= start_of_month)
    ) or 0

    return AdminStats(
        total_users=total_users,
        total_workspaces=total_workspaces,
        mrr=mrr,
        total_tokens_today=tokens_today,
        active_subscriptions=active_subs,
        new_users_this_month=new_users_this_month,
        total_revenue=total_revenue,
    )


@router.get("/users")
async def get_admin_users(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
) -> dict:
    """Fetch user profiles with their plan details."""
    filters = []
    if search:
        search_clause = f"%{search.strip().lower()}%"
        filters.append(
            or_(
                func.lower(User.name).like(search_clause),
                func.lower(User.email).like(search_clause),
            )
        )

    total = await db.scalar(select(func.count(User.id)).where(*filters))
    
    # Select Users and join Subscription
    result = await db.execute(
        select(User, Subscription)
        .outerjoin(Subscription, Subscription.user_id == User.id)
        .where(*filters)
        .order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    items = []
    for user, sub in result.all():
        sub_summary = None
        if sub:
            sub_summary = SubscriptionSummary(
                plan=sub.plan,
                status=sub.status,
                token_quota_monthly=sub.token_quota_monthly,
                token_used_this_month=sub.token_used_this_month,
            )
        items.append(
            UserWithSubscription(
                id=user.id,
                clerk_id=user.clerk_id,
                email=user.email,
                name=user.name,
                avatar_url=user.avatar_url,
                plan=user.plan,
                is_admin=user.is_admin,
                workspace_id=user.workspace_id,
                created_at=user.created_at,
                updated_at=user.updated_at,
                subscription=sub_summary,
            )
        )

    return {
        "items": items,
        "total": int(total or 0),
        "page": page,
        "page_size": page_size,
    }


@router.get("/provider-health")
async def get_provider_health(
    _: User = Depends(get_current_admin),
) -> dict:
    """Fetch status and latency metrics for all registered AI providers."""
    health_data = get_health_status()
    if not health_data:
        # Perform check if empty
        health_data = await check_all_providers()
        # Convert to serializable format
        return {
            "health": [
                {
                    "provider": h.provider,
                    "status": h.status,
                    "latency_ms": h.latency_ms,
                    "last_checked": h.last_check.isoformat() if h.last_check else None,
                    "message": h.error,
                }
                for h in health_data.values()
            ]
        }

    return {"health": list(health_data.values())}
