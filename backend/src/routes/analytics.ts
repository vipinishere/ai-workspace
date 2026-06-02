import { Router, Request, Response } from "express";
import { requireUser } from "../middleware/auth";
import { prisma } from "../prisma";
import { MODELS } from "../services/chat";

const router = Router();

// Retrieve high-level token usage summaries
router.get("/stats", requireUser, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ detail: "Unauthorized" });

  const userId = req.user.id;

  try {
    const totalConversations = await prisma.conversation.count({ where: { userId } });

    // Aggregate tokens and costs from usage logs
    const logAggregates = await prisma.usageLog.aggregate({
      where: { userId },
      _sum: {
        totalTokens: true,
        costUsd: true,
      },
      _count: {
        id: true,
      },
    });

    const totalTokens = logAggregates._sum.totalTokens || 0;
    const totalCostUsd = logAggregates._sum.costUsd || 0;
    const totalMessages = logAggregates._count.id || 0;

    // Fetch subscription quotas
    let subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription) {
      subscription = await prisma.subscription.create({
        data: {
          userId,
          stripeCustomerId: "",
          plan: "free",
          status: "active",
          tokenQuotaMonthly: 100000,
          tokenUsedThisMonth: 0,
        },
      });
    }

    const quotaPercentage = subscription.tokenQuotaMonthly > 0
      ? parseFloat(((subscription.tokenUsedThisMonth / subscription.tokenQuotaMonthly) * 100).toFixed(2))
      : 0;

    // Count unique active models used by user
    const modelGroup = await prisma.usageLog.groupBy({
      by: ["modelId"],
      where: { userId },
      _count: {
        id: true,
      },
    });

    const activeModels = modelGroup.length;

    // Determine top model used by count
    let topModel = "None";
    if (modelGroup.length > 0) {
      modelGroup.sort((a, b) => b._count.id - a._count.id);
      const topModelId = modelGroup[0].modelId;
      topModel = MODELS[topModelId]?.name || topModelId;
    }

    const summary = {
      total_conversations: totalConversations,
      total_messages: totalMessages,
      total_tokens: totalTokens,
      total_cost_usd: parseFloat(totalCostUsd.toFixed(4)),
      tokens_used_this_month: subscription.tokenUsedThisMonth,
      token_quota_monthly: subscription.tokenQuotaMonthly,
      quota_percentage: quotaPercentage,
      active_models: activeModels,
      top_model: topModel,
    };

    return res.json(summary);
  } catch (error: any) {
    console.error("Fetch analytics stats failed:", error);
    return res.status(500).json({ detail: error.message });
  }
});

// Retrieve paginated list of audit usage logs
router.get("/logs", requireUser, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ detail: "Unauthorized" });

  const userId = req.user.id;
  const page = parseInt(req.query.page as string || "1", 10);
  const pageSize = parseInt(req.query.pageSize as string || "10", 10);
  const modelId = req.query.modelId as string | undefined;
  const provider = req.query.provider as string | undefined;

  const skip = (page - 1) * pageSize;

  try {
    const whereClause: any = { userId };

    if (modelId) {
      whereClause.modelId = modelId;
    }
    if (provider) {
      whereClause.provider = provider;
    }

    const total = await prisma.usageLog.count({ where: whereClause });

    const logs = await prisma.usageLog.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    });

    const items = logs.map((l) => ({
      id: l.id,
      date: l.createdAt.toISOString(),
      modelId: l.modelId,
      modelName: MODELS[l.modelId]?.name || l.modelId,
      provider: l.provider,
      promptTokens: l.promptTokens,
      completionTokens: l.completionTokens,
      totalTokens: l.totalTokens,
      cost: parseFloat(l.costUsd.toFixed(6)),
      latencyMs: l.latencyMs,
      status: l.status === "success" ? "success" : "error",
      userId: l.userId,
    }));

    return res.json({
      items,
      total,
      page,
      pageSize,
      hasMore: skip + logs.length < total,
    });
  } catch (error: any) {
    console.error("Fetch usage logs failed:", error);
    return res.status(500).json({ detail: error.message });
  }
});

export default router;
