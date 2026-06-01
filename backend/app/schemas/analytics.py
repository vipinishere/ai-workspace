from datetime import date
from typing import List

from pydantic import BaseModel


class ModelUsage(BaseModel):
    """Token/cost breakdown per model."""
    model_id: str
    provider: str
    tokens: int
    cost_usd: float
    requests: int


class DailyUsage(BaseModel):
    """Per-day token/cost totals."""
    date: date
    tokens: int
    cost_usd: float
    requests: int


class UsageStatsResponse(BaseModel):
    """Aggregated usage stats for a user or workspace."""
    total_tokens: int
    total_cost_usd: float
    total_requests: int
    by_model: List[ModelUsage]
    by_day: List[DailyUsage]
    period_days: int


class CostBreakdownResponse(BaseModel):
    """Cost breakdown summary."""
    total_cost_usd: float
    by_provider: dict[str, float]
    by_model: List[ModelUsage]
    period_days: int


class DashboardSummary(BaseModel):
    """High-level stats for the dashboard."""
    total_conversations: int
    total_messages: int
    total_tokens: int
    total_cost_usd: float
    tokens_used_this_month: int
    token_quota_monthly: int
    quota_percentage: float
    active_models: int
    top_model: str


class AdminStats(BaseModel):
    """Platform-wide system metrics for administrative dashboards."""
    total_users: int
    total_workspaces: int
    mrr: float
    total_tokens_today: int
    active_subscriptions: int
    new_users_this_month: int
    total_revenue: float
