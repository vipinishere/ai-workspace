import Stripe from "stripe";
import { config } from "../config";
import { prisma } from "../prisma";
import crypto from "crypto";

const stripe = new Stripe(config.STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10" as any, // standard API version
});

export const PLAN_QUOTAS: Record<string, number> = {
  free: 100000,
  starter: 1000000,
  pro: 5000000,
  team: 20000000,
};

export const PLAN_MAX_MEMBERS: Record<string, number> = {
  free: 1,
  starter: 1,
  pro: 5,
  team: 25,
};

export function getPriceIdForPlan(plan: string): string | null {
  const mapping: Record<string, string> = {
    starter: config.STRIPE_PRICE_ID_STARTER,
    pro: config.STRIPE_PRICE_ID_PRO,
    team: config.STRIPE_PRICE_ID_TEAM,
  };
  return mapping[plan] || null;
}

export async function createCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  if (user.subscription && user.subscription.stripeCustomerId) {
    return user.subscription.stripeCustomerId;
  }

  if (!config.STRIPE_SECRET_KEY) {
    const customerId = "cus_mock_" + userId.replace(/-/g, "").substring(0, 12);
    if (!user.subscription) {
      await prisma.subscription.create({
        data: {
          userId: user.id,
          stripeCustomerId: customerId,
          plan: "free",
          status: "active",
          tokenQuotaMonthly: PLAN_QUOTAS.free,
          tokenUsedThisMonth: 0,
        },
      });
    } else {
      await prisma.subscription.update({
        where: { id: user.subscription.id },
        data: { stripeCustomerId: customerId },
      });
    }
    return customerId;
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: user.id, clerkId: user.clerkId },
  });

  const customerId = customer.id;

  if (!user.subscription) {
    await prisma.subscription.create({
      data: {
        userId: user.id,
        stripeCustomerId: customerId,
        plan: "free",
        status: "active",
        tokenQuotaMonthly: PLAN_QUOTAS.free,
        tokenUsedThisMonth: 0,
      },
    });
  } else {
    await prisma.subscription.update({
      where: { id: user.subscription.id },
      data: { stripeCustomerId: customerId },
    });
  }

  return customerId;
}

export async function createCheckoutSession(
  customerId: string,
  plan: string,
  successUrl: string,
  cancelUrl: string
): Promise<{ checkout_url: string; session_id: string }> {
  if (!config.STRIPE_SECRET_KEY) {
    return {
      checkout_url: successUrl,
      session_id: "sess_mock_" + crypto.randomBytes(6).toString("hex"),
    };
  }

  const priceId = getPriceIdForPlan(plan);
  if (!priceId) {
    throw new Error(`Unknown plan or price not configured: ${plan}`);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { plan },
    subscription_data: { metadata: { plan } },
    allow_promotion_codes: true,
    billing_address_collection: "auto",
  });

  return {
    checkout_url: session.url || successUrl,
    session_id: session.id,
  };
}

export async function createBillingPortal(customerId: string, returnUrl: string): Promise<string> {
  if (!config.STRIPE_SECRET_KEY) {
    return returnUrl;
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}

export async function getStripeSubscription(subscriptionId: string): Promise<any> {
  if (!config.STRIPE_SECRET_KEY || subscriptionId.startsWith("sub_mock") || subscriptionId.startsWith("sess_mock")) {
    return {
      id: subscriptionId,
      status: "active",
      customer: "cus_mock_123",
      items: { data: [{ price: { id: "price_mock" } }] },
      metadata: {},
    };
  }
  return await stripe.subscriptions.retrieve(subscriptionId);
}

export async function updateSubscriptionModels(subscriptionId: string, models: string[]): Promise<void> {
  if (!config.STRIPE_SECRET_KEY || subscriptionId.startsWith("sub_mock") || subscriptionId.startsWith("sess_mock")) {
    return;
  }
  await stripe.subscriptions.update(subscriptionId, {
    metadata: { selected_models: models.join(",") },
  });
}

// Sync subscription changes
async function handleSubscriptionChange(data: any, eventType: string): Promise<string | null> {
  const stripeSubId = data.id;
  const customerId = data.customer;
  const newStatus = data.status;

  let plan = data.metadata?.plan || "free";
  if (!plan || !PLAN_QUOTAS[plan]) {
    // Attempt price resolution
    const items = data.items?.data || [];
    if (items.length > 0) {
      const priceId = items[0].price?.id || "";
      const reverseMap: Record<string, string> = {
        [config.STRIPE_PRICE_ID_STARTER]: "starter",
        [config.STRIPE_PRICE_ID_PRO]: "pro",
        [config.STRIPE_PRICE_ID_TEAM]: "team",
      };
      plan = reverseMap[priceId] || "free";
    }
  }

  const sub = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!sub) {
    console.warn(`No subscription found for Stripe customer: ${customerId}`);
    return null;
  }

  const periodStart = data.current_period_start ? new Date(data.current_period_start * 1000) : null;
  const periodEnd = data.current_period_end ? new Date(data.current_period_end * 1000) : null;

  const targetPlan = eventType === "customer.subscription.deleted" ? "free" : plan;
  const targetStatus = eventType === "customer.subscription.deleted" ? "canceled" : newStatus;

  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      stripeSubscriptionId: stripeSubId,
      plan: targetPlan,
      status: targetStatus,
      tokenQuotaMonthly: PLAN_QUOTAS[targetPlan] || PLAN_QUOTAS.free,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      updatedAt: new Date(),
    },
  });

  await prisma.user.update({
    where: { id: sub.userId },
    data: {
      plan: targetPlan,
      updatedAt: new Date(),
    },
  });

  return sub.userId;
}

async function handleCheckoutCompleted(data: any): Promise<string | null> {
  const subscriptionId = data.subscription;
  if (!subscriptionId) return null;

  const stripeSub = await getStripeSubscription(subscriptionId);
  return await handleSubscriptionChange(stripeSub, "customer.subscription.created");
}

async function handleInvoiceEvent(data: any, eventType: string): Promise<string | null> {
  const customerId = data.customer;

  const sub = await prisma.subscription.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!sub) return null;

  if (eventType === "invoice.payment_succeeded") {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        tokenUsedThisMonth: 0,
        status: "active",
        updatedAt: new Date(),
      },
    });
  } else if (eventType === "invoice.payment_failed") {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: "past_due",
        updatedAt: new Date(),
      },
    });
  }

  return sub.userId;
}

export async function handleWebhook(payload: any, sig: string): Promise<any> {
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, sig, config.STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    throw new Error(`Webhook verification failed: ${err.message}`);
  }

  const eventType = event.type;
  const dataObj: any = event.data.object;
  const stripeEventId = event.id;

  // Idempotency check
  const existingLog = await prisma.billingLog.findUnique({
    where: { stripeEventId },
  });
  if (existingLog) {
    return { status: "already_processed", event_type: eventType };
  }

  let userId: string | null = null;

  if (
    ["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(
      eventType
    )
  ) {
    userId = await handleSubscriptionChange(dataObj, eventType);
  } else if (eventType === "checkout.session.completed") {
    userId = await handleCheckoutCompleted(dataObj);
  } else if (["invoice.payment_succeeded", "invoice.payment_failed"].includes(eventType)) {
    userId = await handleInvoiceEvent(dataObj, eventType);
  }

  if (userId) {
    const amount = dataObj.amount_total || dataObj.amount_due || 0;
    const currency = dataObj.currency || "usd";

    await prisma.billingLog.create({
      data: {
        userId,
        stripeEventId,
        eventType,
        amountCents: amount,
        currency,
        status: "processed",
        metadata: { object_id: dataObj.id },
      },
    });
  }

  return { status: "ok", event_type: eventType };
}
