import { prisma } from "../prisma";
import { wsManager } from "./websocket";

export interface LogUsageParams {
  userId: string;
  workspaceId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  provider: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  latencyMs: number;
  status: "success" | "error" | "rate_limited";
  errorMessage?: string | null;
}

export async function logUsage(params: LogUsageParams): Promise<void> {
  const {
    userId,
    workspaceId,
    conversationId,
    messageId,
    provider,
    modelId,
    promptTokens,
    completionTokens,
    totalTokens,
    costUsd,
    latencyMs,
    status,
    errorMessage,
  } = params;

  try {
    // 1. Save usage log record
    const log = await prisma.usageLog.create({
      data: {
        userId,
        workspaceId: workspaceId || null,
        conversationId: conversationId || null,
        messageId: messageId || null,
        provider,
        modelId,
        promptTokens,
        completionTokens,
        totalTokens,
        costUsd,
        latencyMs,
        status,
        errorMessage: errorMessage || null,
      },
    });

    // 2. Update subscription quota usage
    const sub = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (sub && status === "success") {
      const updatedSub = await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          tokenUsedThisMonth: sub.tokenUsedThisMonth + totalTokens,
          updatedAt: new Date(),
        },
      });

      // 3. Aggregate totals for the user to broadcast via websocket
      const aggregates = await prisma.usageLog.aggregate({
        where: { userId },
        _sum: {
          costUsd: true,
          totalTokens: true,
        },
      });

      const totalCostUsd = aggregates._sum.costUsd || 0;
      const totalUserTokens = aggregates._sum.totalTokens || 0;

      const quotaPercentage = updatedSub.tokenQuotaMonthly > 0 
        ? parseFloat(((updatedSub.tokenUsedThisMonth / updatedSub.tokenQuotaMonthly) * 100).toFixed(2))
        : 0;

      // Broadcast payload to connected client websockets
      wsManager.broadcastToUser(userId, {
        type: "usage_update",
        data: {
          tokensUsedThisMonth: updatedSub.tokenUsedThisMonth,
          tokenQuotaMonthly: updatedSub.tokenQuotaMonthly,
          quotaPercentage,
          totalCostUsd,
          totalTokens: totalUserTokens,
          recent_use: {
            model_id: modelId,
            tokens: totalTokens,
            cost: costUsd,
          },
        },
      });
    }
  } catch (error) {
    console.error("Failed to log usage metrics:", error);
  }
}
