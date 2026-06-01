"""
Stripe billing service.

Provides:
  - create_customer()              — create or return existing Stripe customer
  - create_checkout_session()      — create a hosted Stripe Checkout session
  - create_billing_portal()        — create a Stripe Customer Portal session
  - handle_webhook()               — validate sig and dispatch Stripe events
  - get_subscription()             — fetch a Stripe subscription object
  - update_subscription_models()   — store selected model IDs in subscription metadata
  - get_price_id_for_plan()        — map plan name → Stripe price ID
"""

from __future__ import annotations

import uuid
import logging
from datetime import datetime, timezone
from typing import Optional

import stripe
from stripe import StripeError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.users import User
from app.models.subscriptions import Subscription
from app.models.billing_logs import BillingLog

logger = logging.getLogger(__name__)

settings = get_settings()
stripe.api_key = settings.STRIPE_SECRET_KEY

PLAN_QUOTAS: dict[str, int] = {
    "free": 100_000,
    "starter": 1_000_000,
    "pro": 5_000_000,
    "team": 20_000_000,
}

PLAN_MAX_MEMBERS: dict[str, int] = {
    "free": 1,
    "starter": 1,
    "pro": 5,
    "team": 25,
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_price_id_for_plan(plan: str) -> Optional[str]:
    mapping = {
        "starter": settings.STRIPE_PRICE_ID_STARTER,
        "pro": settings.STRIPE_PRICE_ID_PRO,
        "team": settings.STRIPE_PRICE_ID_TEAM,
    }
    return mapping.get(plan)


async def create_customer(
    db: AsyncSession,
    *,
    user: User,
) -> str:
    """
    Look up an existing Stripe customer ID on the subscription, or create one.
    Returns the Stripe customer ID.
    """
    # Check if subscription already has a customer ID
    result = await db.execute(
        select(Subscription).where(Subscription.user_id == user.id)
    )
    subscription = result.scalar_one_or_none()
    if subscription and subscription.stripe_customer_id:
        return subscription.stripe_customer_id

    if not settings.STRIPE_SECRET_KEY:
        customer_id = "cus_mock_" + user.id.hex[:12]
        if subscription is None:
            subscription = Subscription(
                id=uuid.uuid4(),
                user_id=user.id,
                stripe_customer_id=customer_id,
                plan="free",
                status="active",
                token_quota_monthly=PLAN_QUOTAS["free"],
                token_used_this_month=0,
            )
            db.add(subscription)
        else:
            subscription.stripe_customer_id = customer_id
            subscription.updated_at = _utcnow()
        await db.flush()
        return customer_id

    # Create Stripe customer
    customer = stripe.Customer.create(
        email=user.email,
        name=user.name,
        metadata={"user_id": str(user.id), "clerk_id": user.clerk_id},
    )
    customer_id = customer["id"]

    # Create or update subscription record
    if subscription is None:
        subscription = Subscription(
            id=uuid.uuid4(),
            user_id=user.id,
            stripe_customer_id=customer_id,
            plan="free",
            status="active",
            token_quota_monthly=PLAN_QUOTAS["free"],
            token_used_this_month=0,
        )
        db.add(subscription)
    else:
        subscription.stripe_customer_id = customer_id
        subscription.updated_at = _utcnow()

    await db.flush()
    return customer_id


async def create_checkout_session(
    *,
    customer_id: str,
    plan: str,
    success_url: str,
    cancel_url: str,
) -> dict:
    """Create a Stripe Checkout session for the given plan."""
    if not settings.STRIPE_SECRET_KEY:
        return {
            "checkout_url": success_url,
            "session_id": "sess_mock_" + uuid.uuid4().hex[:12],
        }

    price_id = get_price_id_for_plan(plan)
    if not price_id:
        raise ValueError(f"Unknown plan or price not configured: {plan!r}")

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={"plan": plan},
        subscription_data={"metadata": {"plan": plan}},
        allow_promotion_codes=True,
        billing_address_collection="auto",
    )
    return {"checkout_url": session["url"], "session_id": session["id"]}


async def create_billing_portal(
    *,
    customer_id: str,
    return_url: str,
) -> str:
    """Create a Stripe Customer Portal session and return the URL."""
    if not settings.STRIPE_SECRET_KEY:
        return return_url

    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=return_url,
    )
    return session["url"]


async def get_subscription(subscription_id: str) -> dict:
    """Fetch a Stripe subscription object."""
    if not settings.STRIPE_SECRET_KEY or subscription_id.startswith("sub_mock") or subscription_id.startswith("sess_mock"):
        return {
            "id": subscription_id,
            "status": "active",
            "customer": "cus_mock_123",
            "items": {"data": [{"price": {"id": "price_mock"}}]},
            "metadata": {},
        }
    return dict(stripe.Subscription.retrieve(subscription_id))


async def update_subscription_models(
    subscription_id: str,
    models: list[str],
) -> None:
    """Store selected model IDs in Stripe subscription metadata."""
    if not settings.STRIPE_SECRET_KEY or subscription_id.startswith("sub_mock") or subscription_id.startswith("sess_mock"):
        return
    stripe.Subscription.modify(
        subscription_id,
        metadata={"selected_models": ",".join(models)},
    )


async def handle_webhook(
    db: AsyncSession,
    payload: bytes,
    sig: str,
) -> dict:
    """
    Validate the Stripe webhook signature and dispatch to the appropriate handler.
    Returns {"status": "ok", "event_type": ...} or raises on failure.
    """
    try:
        event = stripe.Webhook.construct_event(
            payload, sig, settings.STRIPE_WEBHOOK_SECRET
        )
    except stripe.error.SignatureVerificationError as exc:  # type: ignore[attr-defined]
        raise ValueError(f"Invalid webhook signature: {exc}") from exc
    except Exception as exc:
        raise ValueError(f"Webhook parse error: {exc}") from exc

    event_type: str = event["type"]
    data_obj = event["data"]["object"]
    stripe_event_id: str = event["id"]

    # Idempotency: skip if already processed
    existing = await db.scalar(
        select(BillingLog).where(BillingLog.stripe_event_id == stripe_event_id)
    )
    if existing:
        return {"status": "already_processed", "event_type": event_type}

    user_id: Optional[uuid.UUID] = None

    # Dispatch
    if event_type in (
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
    ):
        user_id = await _handle_subscription_change(db, data_obj, event_type)

    elif event_type == "checkout.session.completed":
        user_id = await _handle_checkout_completed(db, data_obj)

    elif event_type in (
        "invoice.payment_succeeded",
        "invoice.payment_failed",
    ):
        user_id = await _handle_invoice_event(db, data_obj, event_type)

    # Record the billing log
    if user_id:
        amount = data_obj.get("amount_total") or data_obj.get("amount_due") or 0
        currency = data_obj.get("currency", "usd")
        log = BillingLog(
            id=uuid.uuid4(),
            user_id=user_id,
            stripe_event_id=stripe_event_id,
            event_type=event_type,
            amount_cents=int(amount),
            currency=currency,
            status="processed",
            log_metadata={"object_id": data_obj.get("id")},
            created_at=_utcnow(),
        )
        db.add(log)

    return {"status": "ok", "event_type": event_type}


async def _handle_subscription_change(
    db: AsyncSession,
    data: dict,
    event_type: str,
) -> Optional[uuid.UUID]:
    """Update the local Subscription record when Stripe subscription changes."""
    stripe_sub_id: str = data["id"]
    customer_id: str = data["customer"]
    new_status: str = data["status"]

    # Map Stripe status → plan from metadata or items
    plan = (data.get("metadata") or {}).get("plan", "free")
    if not plan or plan not in PLAN_QUOTAS:
        # Try to infer from price_id
        items = data.get("items", {}).get("data", [])
        if items:
            price_id = items[0].get("price", {}).get("id", "")
            reverse_map = {
                settings.STRIPE_PRICE_ID_STARTER: "starter",
                settings.STRIPE_PRICE_ID_PRO: "pro",
                settings.STRIPE_PRICE_ID_TEAM: "team",
            }
            plan = reverse_map.get(price_id, "free")

    # Find subscription by stripe_customer_id
    result = await db.execute(
        select(Subscription).where(Subscription.stripe_customer_id == customer_id)
    )
    sub = result.scalar_one_or_none()
    if sub is None:
        logger.warning("No subscription found for Stripe customer %s", customer_id)
        return None

    # Update fields
    sub.stripe_subscription_id = stripe_sub_id
    sub.plan = plan if event_type != "customer.subscription.deleted" else "free"
    sub.status = "canceled" if event_type == "customer.subscription.deleted" else new_status
    sub.token_quota_monthly = PLAN_QUOTAS.get(sub.plan, PLAN_QUOTAS["free"])

    # Billing period
    period_start = data.get("current_period_start")
    period_end = data.get("current_period_end")
    if period_start:
        sub.billing_period_start = datetime.fromtimestamp(period_start, tz=timezone.utc)
    if period_end:
        sub.billing_period_end = datetime.fromtimestamp(period_end, tz=timezone.utc)

    sub.updated_at = _utcnow()

    # Sync plan on User record
    user = await db.get(User, sub.user_id)
    if user:
        user.plan = sub.plan
        user.updated_at = _utcnow()

    return sub.user_id


async def _handle_checkout_completed(
    db: AsyncSession,
    data: dict,
) -> Optional[uuid.UUID]:
    """When checkout completes, update the subscription record."""
    subscription_id = data.get("subscription")
    if not subscription_id:
        return None

    stripe_sub = await get_subscription(subscription_id)
    return await _handle_subscription_change(db, stripe_sub, "customer.subscription.created")


async def _handle_invoice_event(
    db: AsyncSession,
    data: dict,
    event_type: str,
) -> Optional[uuid.UUID]:
    """Handle invoice payment success/failure — reset monthly token counter on success."""
    customer_id: str = data.get("customer", "")

    result = await db.execute(
        select(Subscription).where(Subscription.stripe_customer_id == customer_id)
    )
    sub = result.scalar_one_or_none()
    if sub is None:
        return None

    if event_type == "invoice.payment_succeeded":
        # New billing period — reset token usage counter
        sub.token_used_this_month = 0
        sub.status = "active"
        sub.updated_at = _utcnow()

    elif event_type == "invoice.payment_failed":
        sub.status = "past_due"
        sub.updated_at = _utcnow()

    return sub.user_id


class BillingService:
    async def get_subscription(self, db: AsyncSession, user_id: uuid.UUID) -> Optional[Subscription]:
        result = await db.execute(
            select(Subscription).where(Subscription.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_or_create_customer(self, db: AsyncSession, user: User) -> str:
        return await create_customer(db, user=user)

    async def create_checkout_session(
        self,
        customer_id: str,
        price_id: str,
        success_url: str,
        cancel_url: str,
        user_id: Optional[str] = None,
    ) -> str:
        plan = "free"
        if price_id == settings.STRIPE_PRICE_ID_STARTER:
            plan = "starter"
        elif price_id == settings.STRIPE_PRICE_ID_PRO:
            plan = "pro"
        elif price_id == settings.STRIPE_PRICE_ID_TEAM:
            plan = "team"

        res = await create_checkout_session(
            customer_id=customer_id,
            plan=plan,
            success_url=success_url,
            cancel_url=cancel_url,
        )
        return res["checkout_url"]

    async def create_billing_portal(self, customer_id: str, return_url: str) -> str:
        return await create_billing_portal(customer_id=customer_id, return_url=return_url)

    async def update_selected_models(
        self,
        db: AsyncSession,
        user_id: uuid.UUID,
        models: list[str],
    ) -> Subscription:
        result = await db.execute(
            select(Subscription).where(Subscription.user_id == user_id)
        )
        sub = result.scalar_one_or_none()
        if not sub:
            sub = Subscription(
                id=uuid.uuid4(),
                user_id=user_id,
                stripe_customer_id="",
                plan="free",
                status="active",
                selected_models=models,
                token_quota_monthly=PLAN_QUOTAS["free"],
                token_used_this_month=0,
            )
            db.add(sub)
        else:
            sub.selected_models = models
            sub.updated_at = datetime.now(timezone.utc)
            db.add(sub)
        await db.flush()

        if settings.STRIPE_SECRET_KEY and sub.stripe_subscription_id:
            try:
                await update_subscription_models(sub.stripe_subscription_id, models)
            except Exception as exc:
                logger.warning("Failed to sync model selection to Stripe: %s", exc)

        return sub

    async def handle_webhook(self, db: AsyncSession, payload: bytes, sig: str) -> dict:
        return await handle_webhook(db, payload, sig)


billing_service = BillingService()
