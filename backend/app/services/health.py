"""
Provider health monitoring service.

Runs lightweight ping requests to each AI provider every 60 seconds and
caches the results in memory. The background task is started during app lifespan.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class ProviderHealth:
    provider: str
    status: str  # ok | degraded | down | unconfigured
    latency_ms: Optional[int]
    last_check: Optional[datetime]
    error: Optional[str] = None


# In-memory health cache
_health_cache: Dict[str, ProviderHealth] = {}
_health_task: Optional[asyncio.Task] = None  # type: ignore[type-arg]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _ping_openai() -> ProviderHealth:
    if not settings.OPENAI_API_KEY:
        return ProviderHealth("openai", "unconfigured", None, _utcnow(), "No API key configured")
    try:
        start = time.monotonic()
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
            )
        latency = int((time.monotonic() - start) * 1000)
        if resp.status_code == 200:
            return ProviderHealth("openai", "ok", latency, _utcnow())
        return ProviderHealth("openai", "degraded", latency, _utcnow(), f"HTTP {resp.status_code}")
    except Exception as exc:  # noqa: BLE001
        return ProviderHealth("openai", "down", None, _utcnow(), str(exc))


async def _ping_anthropic() -> ProviderHealth:
    if not settings.ANTHROPIC_API_KEY:
        return ProviderHealth("anthropic", "unconfigured", None, _utcnow(), "No API key configured")
    try:
        start = time.monotonic()
        async with httpx.AsyncClient(timeout=10) as client:
            # Minimal non-streaming request
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": settings.ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": "claude-3-haiku-20240307",
                    "max_tokens": 1,
                    "messages": [{"role": "user", "content": "ping"}],
                },
            )
        latency = int((time.monotonic() - start) * 1000)
        if resp.status_code in (200, 400):  # 400 = bad request but reachable
            return ProviderHealth("anthropic", "ok", latency, _utcnow())
        return ProviderHealth("anthropic", "degraded", latency, _utcnow(), f"HTTP {resp.status_code}")
    except Exception as exc:  # noqa: BLE001
        return ProviderHealth("anthropic", "down", None, _utcnow(), str(exc))


async def _ping_google() -> ProviderHealth:
    if not settings.GOOGLE_AI_API_KEY:
        return ProviderHealth("google", "unconfigured", None, _utcnow(), "No API key configured")
    try:
        start = time.monotonic()
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://generativelanguage.googleapis.com/v1beta/models"
                f"?key={settings.GOOGLE_AI_API_KEY}"
            )
        latency = int((time.monotonic() - start) * 1000)
        if resp.status_code == 200:
            return ProviderHealth("google", "ok", latency, _utcnow())
        return ProviderHealth("google", "degraded", latency, _utcnow(), f"HTTP {resp.status_code}")
    except Exception as exc:  # noqa: BLE001
        return ProviderHealth("google", "down", None, _utcnow(), str(exc))


async def _ping_openrouter() -> ProviderHealth:
    if not settings.OPENROUTER_API_KEY:
        return ProviderHealth("openrouter", "unconfigured", None, _utcnow(), "No API key configured")
    try:
        start = time.monotonic()
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://openrouter.ai/api/v1/models",
                headers={"Authorization": f"Bearer {settings.OPENROUTER_API_KEY}"},
            )
        latency = int((time.monotonic() - start) * 1000)
        if resp.status_code == 200:
            return ProviderHealth("openrouter", "ok", latency, _utcnow())
        return ProviderHealth("openrouter", "degraded", latency, _utcnow(), f"HTTP {resp.status_code}")
    except Exception as exc:  # noqa: BLE001
        return ProviderHealth("openrouter", "down", None, _utcnow(), str(exc))


async def check_all_providers() -> Dict[str, ProviderHealth]:
    """Ping all providers concurrently and update the in-memory cache."""
    results = await asyncio.gather(
        _ping_openai(),
        _ping_anthropic(),
        _ping_google(),
        _ping_openrouter(),
        return_exceptions=False,
    )
    for health in results:
        _health_cache[health.provider] = health
    return dict(_health_cache)


def get_health_status() -> Dict[str, dict]:
    """Return the current cached health status as a serializable dict."""
    return {
        provider: {
            "provider": h.provider,
            "status": h.status,
            "latency_ms": h.latency_ms,
            "last_check": h.last_check.isoformat() if h.last_check else None,
            "error": h.error,
        }
        for provider, h in _health_cache.items()
    }


async def _health_monitor_loop(interval_seconds: int = 60) -> None:
    """Background loop that checks provider health every *interval_seconds* seconds."""
    while True:
        try:
            await check_all_providers()
            logger.debug("Provider health check complete: %s", get_health_status())
        except Exception as exc:  # noqa: BLE001
            logger.warning("Health monitor error: %s", exc)
        await asyncio.sleep(interval_seconds)


def start_health_monitor(interval_seconds: int = 60) -> asyncio.Task:  # type: ignore[type-arg]
    """Start the background health monitor task and return it."""
    global _health_task
    _health_task = asyncio.create_task(
        _health_monitor_loop(interval_seconds), name="provider_health_monitor"
    )
    return _health_task


def stop_health_monitor() -> None:
    """Cancel the background health monitor task."""
    global _health_task
    if _health_task and not _health_task.done():
        _health_task.cancel()
    _health_task = None
