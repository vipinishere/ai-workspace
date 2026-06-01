"""
API Keys router — BYOK (Bring Your Own API Key) management.
"""

from __future__ import annotations

import uuid
import httpx
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.users import User
from app.models.api_keys import ApiKey
from app.schemas.api_keys import ApiKeyCreate, ApiKeyResponse
from app.services.encryption import encryption_service

router = APIRouter(prefix="/api/v1/api-keys", tags=["api-keys"])

SUPPORTED_PROVIDERS = ["openai", "anthropic", "google", "openrouter", "custom"]


def _mask_key(key: str) -> str:
    """Return first 4 + last 4 chars with masked middle."""
    if len(key) <= 8:
        return "*" * len(key)
    return key[:4] + "•" * (len(key) - 8) + key[-4:]


@router.get("", response_model=list[ApiKeyResponse])
async def list_api_keys(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all API keys for the current user (masked)."""
    result = await db.execute(
        select(ApiKey)
        .where(ApiKey.user_id == current_user.id)
        .order_by(ApiKey.created_at.desc())
    )
    keys = result.scalars().all()
    return [ApiKeyResponse.model_validate(k) for k in keys]


@router.post("", response_model=ApiKeyResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    payload: ApiKeyCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Store a new encrypted API key."""
    if payload.provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported provider '{payload.provider}'. Supported: {SUPPORTED_PROVIDERS}",
        )

    # Check if key for this provider already exists
    existing = await db.execute(
        select(ApiKey).where(
            ApiKey.user_id == current_user.id,
            ApiKey.provider == payload.provider,
            ApiKey.is_active == True,  # noqa: E712
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"An active key for provider '{payload.provider}' already exists. Delete it first.",
        )

    # Encrypt the key
    encrypted = encryption_service().encrypt(payload.key)
    preview = _mask_key(payload.key)

    api_key = ApiKey(
        id=uuid.uuid4(),
        user_id=current_user.id,
        name=payload.name,
        provider=payload.provider,
        encrypted_key=encrypted,
        key_preview=preview,
        is_active=True,
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)
    return ApiKeyResponse.model_validate(api_key)


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def delete_api_key(
    key_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Delete (deactivate) an API key."""
    result = await db.execute(
        select(ApiKey).where(
            ApiKey.id == uuid.UUID(key_id),
            ApiKey.user_id == current_user.id,
        )
    )
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")
    key.is_active = False
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{key_id}/test")
async def test_api_key(
    key_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Test if the stored API key is valid by making a minimal API call."""
    result = await db.execute(
        select(ApiKey).where(
            ApiKey.id == uuid.UUID(key_id),
            ApiKey.user_id == current_user.id,
            ApiKey.is_active == True,  # noqa: E712
        )
    )
    key = result.scalar_one_or_none()
    if not key:
        raise HTTPException(status_code=404, detail="API key not found")

    decrypted = encryption_service().decrypt(key.encrypted_key)
    is_valid = False
    error_message: Optional[str] = None

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            if key.provider == "openai":
                resp = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {decrypted}"},
                )
                is_valid = resp.status_code == 200
            elif key.provider == "anthropic":
                resp = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": decrypted,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": "claude-3-haiku-20240307",
                        "max_tokens": 1,
                        "messages": [{"role": "user", "content": "hi"}],
                    },
                )
                is_valid = resp.status_code in (200, 400)  # 400 = invalid request (key works)
            elif key.provider == "google":
                resp = await client.get(
                    f"https://generativelanguage.googleapis.com/v1beta/models?key={decrypted}"
                )
                is_valid = resp.status_code == 200
            elif key.provider == "openrouter":
                resp = await client.get(
                    "https://openrouter.ai/api/v1/models",
                    headers={"Authorization": f"Bearer {decrypted}"},
                )
                is_valid = resp.status_code == 200
            else:
                is_valid = True  # Can't test custom keys

        if is_valid:
            key.last_used_at = datetime.now(timezone.utc)
            await db.commit()

    except Exception as e:
        error_message = str(e)

    return {
        "key_id": key_id,
        "provider": key.provider,
        "is_valid": is_valid,
        "error": error_message,
    }
