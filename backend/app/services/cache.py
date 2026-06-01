"""
Redis caching service.

Provides a thin, type-safe wrapper around redis.asyncio with:
  - get / set / delete for string values
  - get_json / set_json for dict values
  - incr for atomic counters (used by rate limiter)
  - Connection pool managed by the module-level singleton
"""

from __future__ import annotations

import json
from typing import Optional

import redis.asyncio as aioredis

from app.config import get_settings


class CacheService:
    """Async Redis client with JSON helpers and atomic counter support."""

    def __init__(self) -> None:
        self._settings = get_settings()
        self._client: Optional[aioredis.Redis] = None  # type: ignore[type-arg]

    async def get_client(self) -> aioredis.Redis:  # type: ignore[type-arg]
        if self._client is None:
            self._client = aioredis.from_url(
                self._settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30,
            )
        return self._client

    async def get(self, key: str) -> Optional[str]:
        """Return the string value at *key*, or None if missing."""
        try:
            client = await self.get_client()
            return await client.get(key)
        except aioredis.RedisError:
            return None

    async def set(self, key: str, value: str, ttl: int = 300) -> None:
        """Set *key* to *value* with an expiry of *ttl* seconds."""
        try:
            client = await self.get_client()
            await client.set(key, value, ex=ttl)
        except aioredis.RedisError:
            pass  # graceful degradation — cache miss on next read

    async def delete(self, key: str) -> None:
        """Delete *key*."""
        try:
            client = await self.get_client()
            await client.delete(key)
        except aioredis.RedisError:
            pass

    async def incr(self, key: str, ttl: int = 60) -> int:
        """
        Atomically increment the counter at *key* and set its TTL on first write.
        Returns the new value, or 0 on Redis error (fail open for rate limiting).
        """
        try:
            client = await self.get_client()
            pipe = client.pipeline()
            pipe.incr(key)
            pipe.expire(key, ttl)
            results = await pipe.execute()
            return int(results[0])
        except aioredis.RedisError:
            return 0

    async def get_json(self, key: str) -> Optional[dict]:
        """Return the JSON-decoded dict at *key*, or None if missing/invalid."""
        raw = await self.get(key)
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None

    async def set_json(self, key: str, value: dict, ttl: int = 300) -> None:
        """JSON-encode *value* and store it at *key* with *ttl* seconds TTL."""
        await self.set(key, json.dumps(value, default=str), ttl=ttl)

    async def exists(self, key: str) -> bool:
        """Return True if *key* exists in Redis."""
        try:
            client = await self.get_client()
            return bool(await client.exists(key))
        except aioredis.RedisError:
            return False

    async def expire(self, key: str, ttl: int) -> None:
        """Reset the TTL on *key*."""
        try:
            client = await self.get_client()
            await client.expire(key, ttl)
        except aioredis.RedisError:
            pass

    async def close(self) -> None:
        """Close the Redis connection."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None


# Module-level singleton
cache_service = CacheService()
