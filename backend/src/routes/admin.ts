import { Router, Request, Response } from "express";
import { requireAdmin } from "../middleware/auth";
import { prisma } from "../prisma";
import { getHealthStatus } from "../services/health";

const router = Router();

// Retrieve global platform administration metrics
router.get("/stats", requireAdmin, async (req: Request, res: Response) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalWorkspaces = await prisma.workspace.count();

    // Calculate MRR (Monthly Recurring Revenue) based on active plans
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: "active",
        plan: { in: ["starter", "pro", "team"] },
      },
      select: { plan: true },
    });

    const mrrPrices: Record<string, number> = {
      starter: 15,
      pro: 49,
      team: 199,
    };
    const mrr = subscriptions.reduce((acc, s) => acc + (mrrPrices[s.plan] || 0), 0);

    // Sum of revenue from processed invoice logs
    const revenueSum = await prisma.billingLog.aggregate({
      where: { status: "processed" },
      _sum: { amountCents: true },
    });
    const totalRevenue = (revenueSum._sum.amountCents || 0) / 100;

    // Tokens logged today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const tokensSum = await prisma.usageLog.aggregate({
      where: {
        createdAt: { gte: startOfToday },
        status: "success",
      },
      _sum: { totalTokens: true },
    });
    const totalTokensToday = tokensSum._sum.totalTokens || 0;

    // New users in current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const newUsersThisMonth = await prisma.user.count({
      where: { createdAt: { gte: startOfMonth } },
    });

    const activeSubscriptions = subscriptions.length;

    const stats = {
      totalUsers,
      totalWorkspaces,
      mrr,
      totalTokensToday,
      activeSubscriptions,
      newUsersThisMonth,
      totalRevenue,
    };

    return res.json(stats);
  } catch (error: any) {
    console.error("Fetch admin stats failed:", error);
    return res.status(500).json({ detail: error.message });
  }
});

// Retrieve paginated list of users
router.get("/users", requireAdmin, async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string || "1", 10);
  const pageSize = parseInt(req.query.pageSize as string || "10", 10);
  const search = req.query.search as string | undefined;

  const skip = (page - 1) * pageSize;

  try {
    const whereClause: any = {};
    if (search) {
      whereClause.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { name: { contains: search, mode: "insensitive" } },
      ];
    }

    const total = await prisma.user.count({ where: whereClause });

    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        subscription: true,
      },
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    });

    const mappedUsers = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      avatarUrl: u.avatarUrl || undefined,
      plan: u.plan,
      role: u.isAdmin ? "admin" : "user",
      createdAt: u.createdAt.toISOString(),
      tokenUsed: u.subscription?.tokenUsedThisMonth || 0,
      tokenQuota: u.subscription?.tokenQuotaMonthly || 100000,
    }));

    return res.json({
      items: mappedUsers,
      total,
      page,
      pageSize,
      hasMore: skip + users.length < total,
    });
  } catch (error: any) {
    console.error("Fetch admin users failed:", error);
    return res.status(500).json({ detail: error.message });
  }
});

// Retrieve active provider health configurations and metrics
router.get("/provider-health", requireAdmin, async (req: Request, res: Response) => {
  try {
    const health = getHealthStatus();

    // Map health details to frontend ProviderHealth type structure
    const result = Object.values(health).map((h) => ({
      provider: h.provider,
      status: h.status === "ok" ? "operational" : h.status === "degraded" ? "degraded" : "down",
      latencyMs: h.latency_ms || undefined,
      lastChecked: h.last_check || new Date().toISOString(),
      message: h.error || undefined,
    }));

    return res.json(result);
  } catch (error: any) {
    console.error("Fetch provider health status failed:", error);
    return res.status(500).json({ detail: error.message });
  }
});

export default router;
