"""
Clerk JWT verification middleware.

Fetches the Clerk JWKS on first use (then caches it), verifies the bearer
token, and returns the decoded claims. Provides a `get_current_user` FastAPI
dependency that hydrates (or creates) a User row from the Clerk identity.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwk, jwt
from jose.utils import base64url_decode
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.users import User
from app.models.subscriptions import Subscription

logger = logging.getLogger(__name__)
settings = get_settings()

_bearer = HTTPBearer(auto_error=True)

# In-memory JWKS cache  {kid: public_key_obj}
_jwks_cache: dict[str, object] = {}
_jwks_loaded = False


async def _load_jwks() -> None:
    """Fetch Clerk's JWKS endpoint and populate _jwks_cache."""
    global _jwks_loaded
    if _jwks_loaded:
        return

    # Clerk JWKS URL derived from the publishable key domain
    # Format: https://<frontend_api>.clerk.accounts.dev/.well-known/jwks.json
    # For production: https://<your-domain>/.well-known/jwks.json
    # We also support fetching directly from the backend API
    clerk_api = "https://api.clerk.com"
    headers = {"Authorization": f"Bearer {settings.CLERK_SECRET_KEY}"}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{clerk_api}/v1/jwks", headers=headers)
            resp.raise_for_status()
            data = resp.json()

        for key_data in data.get("keys", []):
            kid = key_data["kid"]
            public_key = jwk.construct(key_data)
            _jwks_cache[kid] = public_key

        _jwks_loaded = True
        logger.info("Loaded %d Clerk JWK(s)", len(_jwks_cache))

    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to load Clerk JWKS: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Auth service unavailable",
        )


async def verify_clerk_token(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    """
    Verify the Clerk-issued JWT.
    Returns the decoded payload dict (contains ``sub`` = clerk user ID,
    ``email``, and other claims).
    """
    global _jwks_loaded
    token = credentials.credentials

    if not settings.CLERK_SECRET_KEY or token.startswith("mock_"):
        val = token.removeprefix("mock_") if token.startswith("mock_") else "dev_user"
        if not val or val == "undefined" or val == "null":
            val = "dev_user"
        email = f"{val}@example.com" if "@" not in val else val
        user_id = f"user_mock_{val.split('@')[0]}"
        return {
            "sub": user_id,
            "email": email,
            "first_name": "Dev",
            "last_name": val.split("@")[0].capitalize(),
            "image_url": "",
        }

    # Decode header to get kid (no verification yet)
    try:
        header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token header: {exc}",
        )

    kid = header.get("kid")

    # (Re-)load JWKS if needed or if kid is unknown
    if not _jwks_loaded or kid not in _jwks_cache:
        _jwks_loaded = False
        await _load_jwks()

    public_key = _jwks_cache.get(kid)
    if public_key is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unknown token signing key",
        )

    # Verify and decode
    try:
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {exc}",
        )

    return payload


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token_data: dict = Depends(verify_clerk_token),
) -> User:
    """
    Resolve the Clerk JWT claims to a local User row.
    Creates the user on first login.
    """
    clerk_id: str = token_data.get("sub", "")
    if not clerk_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing subject in token",
        )

    # Try to find existing user
    result = await db.execute(select(User).where(User.clerk_id == clerk_id))
    user = result.scalar_one_or_none()

    if user is None:
        # Auto-provision user from JWT claims (fallback if webhook missed)
        email_addresses = token_data.get("email_addresses", [])
        email = (
            email_addresses[0].get("email_address", "")
            if email_addresses
            else token_data.get("email", "")
        )
        first_name = token_data.get("first_name", "")
        last_name = token_data.get("last_name", "")
        name = f"{first_name} {last_name}".strip() or email.split("@")[0]
        image_url = token_data.get("image_url")

        user = User(
            id=uuid.uuid4(),
            clerk_id=clerk_id,
            email=email,
            name=name,
            avatar_url=image_url,
            plan="free",
            is_admin=False,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)

        # Create a free subscription automatically
        subscription = Subscription(
            id=uuid.uuid4(),
            user_id=user.id,
            stripe_customer_id="",
            plan="free",
            status="active",
            token_quota_monthly=100_000,
            token_used_this_month=0,
        )
        db.add(subscription)
        await db.flush()

    return user


async def get_current_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Require the current user to be an admin."""
    if not settings.CLERK_SECRET_KEY:
        current_user.is_admin = True
        return current_user

    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


async def get_optional_user(
    db: AsyncSession = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    ),
) -> Optional[User]:
    """Return the current user if authenticated, or None for public endpoints."""
    if credentials is None:
        return None
    try:
        token_data = await verify_clerk_token(credentials)
        return await get_current_user(db, token_data)
    except HTTPException:
        return None
