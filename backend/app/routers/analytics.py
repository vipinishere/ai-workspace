"""
Analytics router — token usage, cost breakdown, and dashboard stats.

Routes:
  GET /api/v1/analytics/usage    — Token usage stats (total, by model, by day)
  GET /api/v1/analytics/costs    — Cost breakdown by provider and model
  GET /api/v1/analytics/logs     — Paginated usage logs
  GET /api/v1/analytics/summary  — Dashboard summary stats
"""

from __future__ import annotations

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.usage_logs import UsageLog
from app.models.users import User
from app.schemas.analytics import (
    CostBreakdownResponse,
    DashboardSummary,
    ModelUsage,
    UsageStatsResponse,
)
from app.services.usage import get_dashboard_summary, get_user_stats

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


@router.get("/usage", response_model=UsageStatsResponse)
async def get_usage_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    days: int = Query(30, ge=1, le=365),
    workspace_id: Optional[uuid.UUID] = Query(None),
) -> UsageStatsResponse:
    """Return aggregated token/cost/request statistics for the current user."""
    return await get_user_stats(db, user_id=current_user.id, days=days)


@router.get("/costs", response_model=CostBreakdownResponse)
async def get_cost_breakdown(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    days: int = Query(30, ge=1, le=365),
) -> CostBreakdownResponse:
    """Return cost breakdown by provider and model."""
    from datetime import datetime, timedelta, timezone

    since = datetime.now(timezone.utc) - timedelta(days=days)

    provider_result = await db.execute(
        select(
            UsageLog.provider,
            func.sum(UsageLog.cost_usd).label("cost"),
        )
        .where(
            and_(
                UsageLog.user_id == current_user.id,
                UsageLog.created_at >= since,
                UsageLog.status == "success",
            )
        )
        .group_by(UsageLog.provider)
    )
    by_provider: dict[str, float] = {
        row.provider: float(row.cost or 0) for row in provider_result.all()
    }

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
                UsageLog.user_id == current_user.id,
                UsageLog.created_at >= since,
                UsageLog.status == "success",
            )
        )
        .group_by(UsageLog.model_id, UsageLog.provider)
        .order_by(func.sum(UsageLog.cost_usd).desc())
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

    total_cost = sum(by_provider.values())

    return CostBreakdownResponse(
        total_cost_usd=total_cost,
        by_provider=by_provider,
        by_model=by_model,
        period_days=days,
    )


@router.get("/logs")
async def get_usage_logs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    model_id: Optional[str] = Query(None),
    provider: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    days: int = Query(30, ge=1, le=365),
) -> dict:
    """Return paginated usage logs with optional filters."""
    from datetime import datetime, timedelta, timezone

    since = datetime.now(timezone.utc) - timedelta(days=days)

    filters = [
        UsageLog.user_id == current_user.id,
        UsageLog.created_at >= since,
    ]
    if model_id:
        filters.append(UsageLog.model_id == model_id)
    if provider:
        filters.append(UsageLog.provider == provider)
    if status_filter:
        filters.append(UsageLog.status == status_filter)

    total = await db.scalar(select(func.count(UsageLog.id)).where(and_(*filters)))
    result = await db.execute(
        select(UsageLog)
        .where(and_(*filters))
        .order_by(UsageLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    logs = result.scalars().all()

    return {
        "items": [
            {
                "id": str(log.id),
                "provider": log.provider,
                "model_id": log.model_id,
                "prompt_tokens": log.prompt_tokens,
                "completion_tokens": log.completion_tokens,
                "total_tokens": log.total_tokens,
                "cost_usd": log.cost_usd,
                "latency_ms": log.latency_ms,
                "status": log.status,
                "error_message": log.error_message,
                "conversation_id": str(log.conversation_id) if log.conversation_id else None,
                "created_at": log.created_at.isoformat(),
            }
            for log in logs
        ],
        "total": int(total or 0),
        "page": page,
        "page_size": page_size,
    }


@router.get("/summary", response_model=DashboardSummary)
async def get_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardSummary:
    """Return high-level dashboard summary statistics."""
    return await get_dashboard_summary(db, user_id=current_user.id)


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None),
):
    """WebSocket endpoint for real-time usage tracking."""
    if not token:
        await websocket.accept()
        await websocket.close(code=4008, reason="Missing token")
        return

    try:
        from app.middleware.auth import verify_clerk_token
        from fastapi.security import HTTPAuthorizationCredentials
        cred = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        token_data = await verify_clerk_token(cred)
        
        from app.database import AsyncSessionLocal
        from app.middleware.auth import get_current_user
        async with AsyncSessionLocal() as db:
            user = await get_current_user(db, token_data)
            user_id = user.id
    except Exception as exc:
        await websocket.accept()
        await websocket.close(code=4008, reason=f"Authentication failed: {exc}")
        return

    from app.services.websocket import ws_manager
    await ws_manager.connect(user_id, websocket)

    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(user_id, websocket)
    except Exception:
        ws_manager.disconnect(user_id, websocket)
