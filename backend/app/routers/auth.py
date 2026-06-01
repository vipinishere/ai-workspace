"""
Auth router — Clerk webhook handler and current-user endpoints.

Routes:
  POST /api/v1/auth/webhook  — Handle Clerk user lifecycle events
  GET  /api/v1/auth/me       — Return current user + subscription
  PUT  /api/v1/auth/me       — Update user profile
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.subscriptions import Subscription
from app.models.users import User
from app.schemas.users import UserResponse, UserUpdate, UserWithSubscription, SubscriptionSummary

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


def _verify_clerk_webhook_signature(payload: bytes, svix_id: str, svix_timestamp: str, svix_signature: str) -> bool:
    """Verify Clerk's Svix webhook signature."""
    webhook_secret = settings.CLERK_WEBHOOK_SECRET
    if not webhook_secret:
        logger.warning("CLERK_WEBHOOK_SECRET not set — skipping signature verification")
        return True

    # Svix format: msg_{id}.{timestamp}.{payload}
    signed_content = f"{svix_id}.{svix_timestamp}.{payload.decode('utf-8')}"

    # Secret format: whsec_<base64>
    secret_bytes = webhook_secret.removeprefix("whsec_")
    import base64
    secret_raw = base64.b64decode(secret_bytes)

    expected = hmac.new(secret_raw, signed_content.encode("utf-8"), hashlib.sha256).digest()
    expected_b64 = base64.b64encode(expected).decode("ascii")

    # svix_signature may contain multiple "v1,<sig>" values separated by spaces
    for sig in svix_signature.split(" "):
        if sig.startswith("v1,"):
            if hmac.compare_digest(sig[3:], expected_b64):
                return True
    return False


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def clerk_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    svix_id: str = Header(default="", alias="svix-id"),
    svix_timestamp: str = Header(default="", alias="svix-timestamp"),
    svix_signature: str = Header(default="", alias="svix-signature"),
) -> dict:
    """Handle Clerk user.created / user.updated / user.deleted webhook events."""
    payload = await request.body()

    if svix_id and svix_timestamp and svix_signature:
        if not _verify_clerk_webhook_signature(payload, svix_id, svix_timestamp, svix_signature):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid webhook signature")

    import json
    try:
        data = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid JSON: {exc}")

    event_type: str = data.get("type", "")
    event_data: dict = data.get("data", {})

    logger.info("Clerk webhook: %s", event_type)

    if event_type == "user.created":
        await _handle_user_created(db, event_data)
    elif event_type == "user.updated":
        await _handle_user_updated(db, event_data)
    elif event_type == "user.deleted":
        await _handle_user_deleted(db, event_data)
    else:
        logger.debug("Unhandled Clerk event: %s", event_type)

    return {"status": "ok"}


async def _handle_user_created(db: AsyncSession, data: dict) -> None:
    clerk_id: str = data.get("id", "")
    email_addresses: list = data.get("email_addresses", [])
    primary_email_id: str = data.get("primary_email_address_id", "")

    # Find primary email
    email = ""
    for ea in email_addresses:
        if ea.get("id") == primary_email_id:
            email = ea.get("email_address", "")
            break
    if not email and email_addresses:
        email = email_addresses[0].get("email_address", "")

    first_name = data.get("first_name") or ""
    last_name = data.get("last_name") or ""
    name = f"{first_name} {last_name}".strip() or email.split("@")[0]
    avatar_url = data.get("image_url")

    # Check if user already exists (idempotency)
    existing = await db.scalar(select(User).where(User.clerk_id == clerk_id))
    if existing:
        return

    user = User(
        id=uuid.uuid4(),
        clerk_id=clerk_id,
        email=email,
        name=name,
        avatar_url=avatar_url,
        plan="free",
        is_admin=False,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(user)
    await db.flush()

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
    logger.info("Created user %s from Clerk webhook", clerk_id)


async def _handle_user_updated(db: AsyncSession, data: dict) -> None:
    clerk_id: str = data.get("id", "")
    user = await db.scalar(select(User).where(User.clerk_id == clerk_id))
    if not user:
        # Create if not found
        await _handle_user_created(db, data)
        return

    email_addresses: list = data.get("email_addresses", [])
    primary_email_id: str = data.get("primary_email_address_id", "")
    for ea in email_addresses:
        if ea.get("id") == primary_email_id:
            user.email = ea.get("email_address", user.email)
            break

    first_name = data.get("first_name") or ""
    last_name = data.get("last_name") or ""
    name = f"{first_name} {last_name}".strip()
    if name:
        user.name = name
    if data.get("image_url"):
        user.avatar_url = data["image_url"]
    user.updated_at = datetime.now(timezone.utc)
    logger.info("Updated user %s from Clerk webhook", clerk_id)


async def _handle_user_deleted(db: AsyncSession, data: dict) -> None:
    clerk_id: str = data.get("id", "")
    user = await db.scalar(select(User).where(User.clerk_id == clerk_id))
    if user:
        await db.delete(user)
        logger.info("Deleted user %s from Clerk webhook", clerk_id)


@router.get("/me", response_model=UserWithSubscription)
async def get_me(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserWithSubscription:
    """Return the current authenticated user with their subscription summary."""
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    subscription = result.scalar_one_or_none()

    sub_summary: SubscriptionSummary | None = None
    if subscription:
        sub_summary = SubscriptionSummary(
            plan=subscription.plan,
            status=subscription.status,
            token_quota_monthly=subscription.token_quota_monthly,
            token_used_this_month=subscription.token_used_this_month,
        )

    return UserWithSubscription(
        id=current_user.id,
        clerk_id=current_user.clerk_id,
        email=current_user.email,
        name=current_user.name,
        avatar_url=current_user.avatar_url,
        plan=current_user.plan,
        is_admin=current_user.is_admin,
        workspace_id=current_user.workspace_id,
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
        subscription=sub_summary,
    )


@router.put("/me", response_model=UserResponse)
async def update_me(
    update_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    """Update the current user's profile (name, avatar)."""
    if update_data.name is not None:
        current_user.name = update_data.name.strip()
    if update_data.avatar_url is not None:
        current_user.avatar_url = update_data.avatar_url
    current_user.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(current_user)
    return current_user
