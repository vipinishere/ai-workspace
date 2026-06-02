import { Router, Request, Response } from "express";
import { requireUser } from "../middleware/auth";
import { prisma } from "../prisma";
import {
  createCustomer,
  createCheckoutSession,
  createBillingPortal,
  updateSubscriptionModels,
  PLAN_QUOTAS,
  handleWebhook,
} from "../services/billing";
import { config } from "../config";

const router = Router();

// Retrieve user's current subscription details
router.get("/subscription", requireUser, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ detail: "Unauthorized" });

  try {
    let sub = await prisma.subscription.findUnique({
      where: { userId: req.user.id },
    });

    if (!sub) {
      sub = await prisma.subscription.create({
        data: {
          userId: req.user.id,
          stripeCustomerId: "",
          plan: "free",
          status: "active",
          selectedModels: [],
          tokenQuotaMonthly: PLAN_QUOTAS.free,
          tokenUsedThisMonth: 0,
        },
      });
    }

    return res.json(sub);
  } catch (error: any) {
    console.error("Fetch subscription failed:", error);
    return res.status(500).json({ detail: error.message });
  }
});

// Create checkout session for upgrading subscription plans
router.post("/checkout", requireUser, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ detail: "Unauthorized" });

  const { plan } = req.body;
  if (!plan || !PLAN_QUOTAS[plan]) {
    return res.status(400).json({ detail: "Invalid subscription plan specified" });
  }

  try {
    const customerId = await createCustomer(req.user.id);
    const successUrl = `${config.FRONTEND_URL}/dashboard?checkout=success`;
    const cancelUrl = `${config.FRONTEND_URL}/dashboard/billing?checkout=cancel`;

    const result = await createCheckoutSession(customerId, plan, successUrl, cancelUrl);

    // Stripe local developer mock bypass
    if (!config.STRIPE_SECRET_KEY) {
      await prisma.subscription.update({
        where: { userId: req.user.id },
        data: {
          plan,
          status: "active",
          tokenQuotaMonthly: PLAN_QUOTAS[plan] || PLAN_QUOTAS.free,
          updatedAt: new Date(),
        },
      });
      await prisma.user.update({
        where: { id: req.user.id },
        data: { plan, updatedAt: new Date() },
      });
    }

    return res.json({ checkoutUrl: result.checkout_url, sessionId: result.session_id });
  } catch (error: any) {
    console.error("Checkout generation failed:", error);
    return res.status(500).json({ detail: error.message });
  }
});

// Create Stripe Customer Portal link
router.post("/portal", requireUser, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ detail: "Unauthorized" });

  try {
    const customerId = await createCustomer(req.user.id);
    const returnUrl = `${config.FRONTEND_URL}/dashboard/billing`;

    const portalUrl = await createBillingPortal(customerId, returnUrl);
    return res.json({ url: portalUrl });
  } catch (error: any) {
    console.error("Portal redirect link failed:", error);
    return res.status(500).json({ detail: error.message });
  }
});

// Update workspace selected models metered list
router.patch("/subscription/models", requireUser, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ detail: "Unauthorized" });

  const { selectedModels } = req.body;
  if (!selectedModels || !Array.isArray(selectedModels)) {
    return res.status(400).json({ detail: "selectedModels list is required as an array" });
  }

  try {
    const sub = await prisma.subscription.findUnique({
      where: { userId: req.user.id },
    });

    if (!sub) {
      return res.status(404).json({ detail: "Subscription not found" });
    }

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        selectedModels,
        updatedAt: new Date(),
      },
    });

    if (config.STRIPE_SECRET_KEY && sub.stripeSubscriptionId) {
      await updateSubscriptionModels(sub.stripeSubscriptionId, selectedModels);
    }

    return res.json(updated);
  } catch (error: any) {
    console.error("Update selected models failed:", error);
    return res.status(500).json({ detail: error.message });
  }
});

// Stripe webhook handler (endpoint configures raw parser in main application)
router.post("/webhook", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  if (!sig) {
    return res.status(400).json({ detail: "Missing stripe-signature header" });
  }

  try {
    const result = await handleWebhook(req.body, sig);
    return res.json(result);
  } catch (error: any) {
    console.error("Stripe Webhook signature check failed:", error);
    return res.status(400).json({ detail: error.message });
  }
});

export default router;
