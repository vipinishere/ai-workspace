"""
Token usage tracking service.

Provides:
  - log_usage()        — persist a UsageLog row + update subscription counter
  - get_user_stats()   — aggregate tokens/cost/requests by model and by day
  - check_quota()      — returns True if the user is within their monthly token quota
  - increment_usage()  — atomically bump token_used_this_month on the subscription
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.usage_logs import UsageLog
from app.models.subscriptions import Subscription
from app.models.conversations import Conversation
from app.models.messages import Message
from app.schemas.analytics import (
    UsageStatsResponse,
    ModelUsage,
    DailyUsage,
    DashboardSummary,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def log_usage(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    workspace_id: Optional[uuid.UUID],
    conversation_id: Optional[uuid.UUID],
    message_id: Optional[uuid.UUID],
    provider: str,
    model_id: str,
    prompt_tokens: int,
    completion_tokens: int,
    cost_usd: float,
    latency_ms: int,
    status: str = "success",
    error_message: Optional[str] = None,
) -> UsageLog:
    """Persist a usage log entry and increment the subscription token counter."""
    total_tokens = prompt_tokens + completion_tokens

    log = UsageLog(
        id=uuid.uuid4(),
        user_id=user_id,
        workspace_id=workspace_id,
        conversation_id=conversation_id,
        message_id=message_id,
        provider=provider,
        model_id=model_id,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        cost_usd=cost_usd,
        latency_ms=latency_ms,
        status=status,
        error_message=error_message,
        created_at=_utcnow(),
    )
    db.add(log)

    # Increment monthly token usage on subscription (best-effort)
    if status == "success":
        await increment_usage(db, user_id=user_id, tokens=total_tokens)
        
        # Broadcast usage update via WebSocket
        try:
            from app.services.websocket import ws_manager
            summary = await get_dashboard_summary(db, user_id=user_id)
            import asyncio
            asyncio.create_task(
                ws_manager.broadcast_to_user(
                    user_id,
                    {
                        "type": "usage_update",
                        "data": {
                            "tokensUsedThisMonth": summary.tokens_used_this_month,
                            "tokenQuotaMonthly": summary.token_quota_monthly,
                            "quotaPercentage": summary.quota_percentage,
                            "totalCostUsd": summary.total_cost_usd,
                            "totalTokens": summary.total_tokens,
                            "recent_use": {
                                "model_id": model_id,
                                "provider": provider,
                                "tokens": total_tokens,
                                "cost": cost_usd,
                                "latency_ms": latency_ms
                            }
                        }
                    }
                )
            )
        except Exception:
            pass

    await db.flush()
    return log


async def increment_usage(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    tokens: int,
) -> None:
    """Atomically increment token_used_this_month on the user's subscription."""
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == user_id).with_for_update(skip_locked=True)
    )
    subscription = result.scalar_one_or_none()
    if subscription:
        subscription.token_used_this_month = (subscription.token_used_this_month or 0) + tokens
        subscription.updated_at = _utcnow()
        db.add(subscription)


async def check_quota(db: AsyncSession, *, user_id: uuid.UUID) -> bool:
    """
    Returns True if the user still has quota remaining, False if they've exceeded it.
    Free-tier users with no subscription always have quota (limited by rate limit instead).
    """
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == user_id)
    )
    sub = result.scalar_one_or_none()
    if sub is None:
        return True  # no subscription record — treat as free with no hard quota
    if sub.status not in ("active", "trialing"):
        return False
    return sub.token_used_this_month < sub.token_quota_monthly


async def get_user_stats(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    days: int = 30,
) -> UsageStatsResponse:
    """Return aggregated token/cost/request stats for a user over the last `days` days."""
    since = _utcnow() - timedelta(days=days)

    # Total aggregates
    total_result = await db.execute(
        select(
            func.sum(UsageLog.total_tokens).label("total_tokens"),
            func.sum(UsageLog.cost_usd).label("total_cost"),
            func.count(UsageLog.id).label("total_requests"),
        ).where(
            and_(
                UsageLog.user_id == user_id,
                UsageLog.created_at >= since,
                UsageLog.status == "success",
            )
        )
    )
    totals = total_result.one()

    # By model
    model_result = await db.execute(
        select(
            UsageLog.model_id,
            UsageLog.provider,
            func.sum(UsageLog.total_tokens).label("tokens"),
            func.sum(UsageLog.cost_usd).label("cost"),
            func.count(UsageLog.id).label("requests"),
        )
        .where(
            and_(
                UsageLog.user_id == user_id,
                UsageLog.created_at >= since,
                UsageLog.status == "success",
            )
        )
        .group_by(UsageLog.model_id, UsageLog.provider)
        .order_by(func.sum(UsageLog.total_tokens).desc())
    )
    by_model = [
        ModelUsage(
            model_id=row.model_id,
            provider=row.provider,
            tokens=int(row.tokens or 0),
            cost_usd=float(row.cost or 0),
            requests=int(row.requests or 0),
        )
        for row in model_result.all()
    ]

    # By day
    day_result = await db.execute(
        select(
            func.date(UsageLog.created_at).label("day"),
            func.sum(UsageLog.total_tokens).label("tokens"),
            func.sum(UsageLog.cost_usd).label("cost"),
            func.count(UsageLog.id).label("requests"),
        )
        .where(
            and_(
                UsageLog.user_id == user_id,
                UsageLog.created_at >= since,
                UsageLog.status == "success",
            )
        )
        .group_by(func.date(UsageLog.created_at))
        .order_by(func.date(UsageLog.created_at))
    )
    by_day = [
        DailyUsage(
            date=row.day,
            tokens=int(row.tokens or 0),
            cost_usd=float(row.cost or 0),
            requests=int(row.requests or 0),
        )
        for row in day_result.all()
    ]

    return UsageStatsResponse(
        total_tokens=int(totals.total_tokens or 0),
        total_cost_usd=float(totals.total_cost or 0),
        total_requests=int(totals.total_requests or 0),
        by_model=by_model,
        by_day=by_day,
        period_days=days,
    )


async def get_dashboard_summary(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
) -> DashboardSummary:
    """High-level dashboard stats for a user."""
    # Conversation & message counts
    conv_count = await db.scalar(
        select(func.count(Conversation.id)).where(Conversation.user_id == user_id)
    )
    msg_count = await db.scalar(
        select(func.count(Message.id)).join(
            Conversation, Message.conversation_id == Conversation.id
        ).where(Conversation.user_id == user_id)
    )

    # Token / cost totals (all-time)
    token_result = await db.execute(
        select(
            func.sum(UsageLog.total_tokens).label("tokens"),
            func.sum(UsageLog.cost_usd).label("cost"),
        ).where(and_(UsageLog.user_id == user_id, UsageLog.status == "success"))
    )
    token_row = token_result.one()

    # Subscription info
    sub = await db.scalar(
        select(Subscription).where(Subscription.user_id == user_id)
    )
    quota_monthly = sub.token_quota_monthly if sub else 100_000
    used_this_month = sub.token_used_this_month if sub else 0
    quota_pct = round(used_this_month / quota_monthly * 100, 1) if quota_monthly else 0.0

    # Top model (last 30 days)
    since = _utcnow() - timedelta(days=30)
    top_model_result = await db.execute(
        select(UsageLog.model_id, func.sum(UsageLog.total_tokens).label("tokens"))
        .where(and_(UsageLog.user_id == user_id, UsageLog.created_at >= since))
        .group_by(UsageLog.model_id)
        .order_by(func.sum(UsageLog.total_tokens).desc())
        .limit(1)
    )
    top_model_row = top_model_result.one_or_none()
    top_model = top_model_row.model_id if top_model_row else "N/A"

    # Active models (last 30 days)
    active_models_result = await db.execute(
        select(func.count(func.distinct(UsageLog.model_id)))
        .where(and_(UsageLog.user_id == user_id, UsageLog.created_at >= since))
    )
    active_models = active_models_result.scalar() or 0

    return DashboardSummary(
        total_conversations=int(conv_count or 0),
        total_messages=int(msg_count or 0),
        total_tokens=int(token_row.tokens or 0),
        total_cost_usd=float(token_row.cost or 0),
        tokens_used_this_month=used_this_month,
        token_quota_monthly=quota_monthly,
        quota_percentage=quota_pct,
        active_models=int(active_models),
        top_model=top_model,
    )
