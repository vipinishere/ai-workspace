"""
Redis-based sliding-window rate limiter.

Provides:
  - RateLimiter class with check_rate_limit()
  - FastAPI dependency factories: rate_limit_default, rate_limit_chat
"""

from __future__ import annotations

import uuid
from typing import Callable

from fastapi import Depends, HTTPException, Request, status

from app.config import get_settings
from app.middleware.auth import get_current_user
from app.models.users import User
from app.services.cache import cache_service

settings = get_settings()


class RateLimiter:
    """Sliding-window rate limiter backed by Redis INCR + EXPIRE."""

    async def check(
        self,
        key: str,
        limit: int,
        window_seconds: int = 60,
    ) -> tuple[bool, int]:
        """
        Atomically increment the counter for *key* within the sliding window.

        Returns:
            (allowed: bool, current_count: int)
        """
        count = await cache_service.incr(key, ttl=window_seconds)
        return count <= limit, count

    async def enforce(
        self,
        key: str,
        limit: int,
        window_seconds: int = 60,
        error_detail: str = "Rate limit exceeded. Please slow down.",
    ) -> None:
        """
        Raise HTTP 429 if the rate limit is exceeded for *key*.
        """
        allowed, count = await self.check(key, limit, window_seconds)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=error_detail,
                headers={"Retry-After": str(window_seconds), "X-RateLimit-Limit": str(limit), "X-RateLimit-Remaining": "0"},
            )


rate_limiter = RateLimiter()


def make_rate_limit_dependency(limit: int, window_seconds: int = 60, scope: str = "default") -> Callable:
    """
    Factory that returns a FastAPI dependency enforcing *limit* requests
    per *window_seconds* per authenticated user.
    """

    async def _dependency(
        current_user: User = Depends(get_current_user),
    ) -> None:
        key = f"rl:{scope}:{current_user.id}"
        await rate_limiter.enforce(
            key=key,
            limit=limit,
            window_seconds=window_seconds,
            error_detail=f"Rate limit exceeded: {limit} requests per {window_seconds}s",
        )

    return _dependency


def make_ip_rate_limit_dependency(limit: int, window_seconds: int = 60, scope: str = "ip") -> Callable:
    """
    Factory for IP-based rate limiting (useful for unauthenticated endpoints).
    """

    async def _dependency(request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        key = f"rl:{scope}:{client_ip}"
        await rate_limiter.enforce(
            key=key,
            limit=limit,
            window_seconds=window_seconds,
            error_detail=f"Too many requests from this IP. Limit: {limit}/{window_seconds}s",
        )

    return _dependency


# Pre-built dependency instances
rate_limit_default = make_rate_limit_dependency(
    limit=settings.RATE_LIMIT_PER_MINUTE,
    window_seconds=60,
    scope="default",
)

rate_limit_chat = make_rate_limit_dependency(
    limit=settings.RATE_LIMIT_CHAT_PER_MINUTE,
    window_seconds=60,
    scope="chat",
)

rate_limit_webhook = make_ip_rate_limit_dependency(
    limit=100,
    window_seconds=60,
    scope="webhook",
)
