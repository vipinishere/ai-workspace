import { Router, Request, Response } from "express";
import { requireUser } from "../middleware/auth";
import { prisma } from "../prisma";
import { config } from "../config";

const router = Router();

// Retrieve currently authenticated user profile
router.get("/me", requireUser, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ detail: "Unauthorized" });

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { subscription: true, workspace: true },
  });

  return res.json(user);
});

// Clerk webhook listener for syncing users (created, updated, deleted)
router.post("/webhook", async (req: Request, res: Response) => {
  const webhookSecret = config.CLERK_WEBHOOK_SECRET;

  if (webhookSecret) {
    // Standard verification can be done here using Clerk SDK if needed
    // In developer sandbox environments, we parse body directly
  }

  const { data, type } = req.body;
  if (!data) {
    return res.status(400).json({ detail: "Missing data payload" });
  }

  try {
    if (type === "user.created" || type === "user.updated") {
      const email = data.email_addresses?.[0]?.email_address || "";
      const firstName = data.first_name || "";
      const lastName = data.last_name || "";
      const name = `${firstName} ${lastName}`.trim() || email.split("@")[0];
      const avatarUrl = data.image_url || "";
      const clerkId = data.id;

      // Find or create user
      let user = await prisma.user.findUnique({ where: { clerkId } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            clerkId,
            email,
            name,
            avatarUrl,
            plan: "free",
            isAdmin: false,
          },
        });

        // Auto-create a subscription
        await prisma.subscription.create({
          data: {
            userId: user.id,
            stripeCustomerId: "",
            plan: "free",
            status: "active",
            tokenQuotaMonthly: 100000,
            tokenUsedThisMonth: 0,
          },
        });
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            email,
            name,
            avatarUrl,
            updatedAt: new Date(),
          },
        });
      }
    } else if (type === "user.deleted") {
      const clerkId = data.id;
      const user = await prisma.user.findUnique({ where: { clerkId } });
      if (user) {
        await prisma.user.delete({ where: { id: user.id } });
      }
    }

    return res.json({ status: "success" });
  } catch (error: any) {
    console.error("Clerk Webhook error:", error);
    return res.status(500).json({ detail: error.message });
  }
});

export default router;
