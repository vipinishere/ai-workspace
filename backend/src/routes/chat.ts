import { Router, Request, Response } from "express";
import { requireUser } from "../middleware/auth";
import { prisma } from "../prisma";
import { MODELS, streamChat } from "../services/chat";

const router = Router();

// Retrieve all available AI models
router.get("/models", async (req: Request, res: Response) => {
  const modelsList = Object.values(MODELS).map((m) => ({
    id: m.id,
    name: m.name,
    provider: m.provider,
    description: m.description,
    contextLength: m.contextLength,
    pricePrompt: m.pricePromptPer1M,
    priceCompletion: m.priceCompletionPer1M,
    isAvailable: true,
    capabilities: ["chat", "code", "long-context"],
  }));

  return res.json(modelsList);
});

// Retrieve active conversations list for user
router.get("/conversations", requireUser, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ detail: "Unauthorized" });

  const workspaceId = req.query.workspaceId as string | undefined;

  try {
    const whereClause: any = {
      userId: req.user.id,
      isArchived: false,
    };

    if (workspaceId) {
      whereClause.workspaceId = workspaceId;
    }

    const conversations = await prisma.conversation.findMany({
      where: whereClause,
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const result = conversations.map((c) => ({
      id: c.id,
      title: c.title,
      modelId: c.modelId,
      provider: c.provider,
      systemPrompt: c.systemPrompt || undefined,
      totalTokens: c.totalTokens,
      userId: c.userId,
      workspaceId: c.workspaceId || undefined,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      lastMessage: c.messages[0]?.content || undefined,
    }));

    return res.json(result);
  } catch (error: any) {
    console.error("Fetch conversations failed:", error);
    return res.status(500).json({ detail: error.message });
  }
});

// Retrieve conversation details and messages log
router.get("/conversations/:id", requireUser, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ detail: "Unauthorized" });

  const { id } = req.params;

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!conversation) {
      return res.status(404).json({ detail: "Conversation not found" });
    }

    if (conversation.userId !== req.user.id) {
      return res.status(403).json({ detail: "Permission denied" });
    }

    const result = {
      id: conversation.id,
      title: conversation.title,
      modelId: conversation.modelId,
      provider: conversation.provider,
      systemPrompt: conversation.systemPrompt || undefined,
      totalTokens: conversation.totalTokens,
      userId: conversation.userId,
      workspaceId: conversation.workspaceId || undefined,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messages: conversation.messages.map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role,
        content: m.content,
        modelId: m.modelId || undefined,
        promptTokens: m.promptTokens,
        completionTokens: m.completionTokens,
        totalTokens: m.totalTokens,
        cost: m.costUsd,
        durationMs: m.durationMs || undefined,
        createdAt: m.createdAt.toISOString(),
      })),
    };

    return res.json(result);
  } catch (error: any) {
    console.error("Fetch conversation details failed:", error);
    return res.status(500).json({ detail: error.message });
  }
});

// Create a new conversation row
router.post("/conversations", requireUser, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ detail: "Unauthorized" });

  const { title, modelId, provider, systemPrompt, workspaceId } = req.body;

  if (!modelId || !provider) {
    return res.status(400).json({ detail: "modelId and provider are required" });
  }

  try {
    const conversation = await prisma.conversation.create({
      data: {
        userId: req.user.id,
        workspaceId: workspaceId || req.user.workspaceId,
        title: title || "New Conversation",
        modelId,
        provider,
        systemPrompt: systemPrompt || null,
        isArchived: false,
        totalTokens: 0,
      },
    });

    return res.status(201).json(conversation);
  } catch (error: any) {
    console.error("Create conversation failed:", error);
    return res.status(500).json({ detail: error.message });
  }
});

// Edit title or archive conversation status
router.patch("/conversations/:id", requireUser, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ detail: "Unauthorized" });

  const { id } = req.params;
  const { title, isArchived, systemPrompt } = req.body;

  try {
    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation) {
      return res.status(404).json({ detail: "Conversation not found" });
    }

    if (conversation.userId !== req.user.id) {
      return res.status(403).json({ detail: "Permission denied" });
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: {
        title: title !== undefined ? title : conversation.title,
        isArchived: isArchived !== undefined ? isArchived : conversation.isArchived,
        systemPrompt: systemPrompt !== undefined ? systemPrompt : conversation.systemPrompt,
        updatedAt: new Date(),
      },
    });

    return res.json(updated);
  } catch (error: any) {
    console.error("Update conversation failed:", error);
    return res.status(500).json({ detail: error.message });
  }
});

// Delete active conversation log (owner only)
router.delete("/conversations/:id", requireUser, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ detail: "Unauthorized" });

  const { id } = req.params;

  try {
    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation) {
      return res.status(404).json({ detail: "Conversation not found" });
    }

    if (conversation.userId !== req.user.id) {
      return res.status(403).json({ detail: "Permission denied" });
    }

    await prisma.conversation.delete({ where: { id } });
    return res.status(204).send();
  } catch (error: any) {
    console.error("Delete conversation failed:", error);
    return res.status(500).json({ detail: error.message });
  }
});

// POST SSE streaming completions
router.post("/stream", requireUser, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ detail: "Unauthorized" });

  const { modelId, provider, message, conversationId, systemPrompt } = req.body;

  if (!modelId || !provider || !message) {
    return res.status(400).json({ detail: "modelId, provider, and message are required" });
  }

  try {
    let resolvedConversationId = conversationId;
    let resolvedSystemPrompt = systemPrompt || null;

    // Check if we need to create conversation
    if (!resolvedConversationId) {
      const conv = await prisma.conversation.create({
        data: {
          userId: req.user.id,
          workspaceId: req.user.workspaceId,
          title: message.substring(0, 50) || "New Conversation",
          modelId,
          provider,
          systemPrompt: systemPrompt || null,
        },
      });
      resolvedConversationId = conv.id;
      resolvedSystemPrompt = conv.systemPrompt;
    }

    // Load existing messages to build history
    const history = await prisma.message.findMany({
      where: { conversationId: resolvedConversationId },
      orderBy: { createdAt: "asc" },
    });

    // Create user prompt message in database
    await prisma.message.create({
      data: {
        conversationId: resolvedConversationId,
        role: "user",
        content: message,
        modelId,
        promptTokens: Math.ceil(message.length / 4),
        completionTokens: 0,
        totalTokens: Math.ceil(message.length / 4),
        costUsd: 0.0,
      },
    });

    // Prepare message chain for provider
    const messageChain = history.map((h) => ({
      role: h.role,
      content: h.content,
    }));
    messageChain.push({ role: "user", content: message });

    // Stream chat completion
    await streamChat(
      req.user.id,
      req.user.workspaceId,
      resolvedConversationId,
      modelId,
      provider,
      messageChain,
      resolvedSystemPrompt,
      res
    );

  } catch (error: any) {
    console.error("Stream initialization failed:", error);
    if (!res.headersSent) {
      return res.status(500).json({ detail: error.message });
    }
  }
});

export default router;
