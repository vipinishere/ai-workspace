import { Router, Request, Response } from "express";
import { requireUser } from "../middleware/auth";
import { prisma } from "../prisma";

const router = Router();

// Retrieve list of public/featured agents
router.get("/", requireUser, async (req: Request, res: Response) => {
  const { category, featured } = req.query;

  try {
    const whereClause: any = {
      OR: [
        { isPublic: true },
        { authorId: req.user?.id },
      ],
    };

    if (category) {
      whereClause.category = category as string;
    }

    if (featured === "true") {
      whereClause.isFeatured = true;
    }

    const agents = await prisma.agent.findMany({
      where: whereClause,
      orderBy: { usageCount: "desc" },
    });

    // Map to AIAgent frontend type structure
    const mappedAgents = agents.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      systemPrompt: a.systemPrompt,
      modelId: a.modelId,
      category: a.category,
      iconEmoji: a.iconUrl || "🤖", // fallback to robot emoji
      rating: a.rating,
      usageCount: a.usageCount,
      isPublic: a.isPublic,
      createdBy: a.authorId,
      tags: [a.category],
      createdAt: a.createdAt.toISOString(),
    }));

    return res.json(mappedAgents);
  } catch (error: any) {
    console.error("Fetch agents failed:", error);
    return res.status(500).json({ detail: error.message });
  }
});

// Create custom workspace agent
router.post("/", requireUser, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ detail: "Unauthorized" });

  const { name, description, systemPrompt, modelId, category, iconEmoji } = req.body;

  if (!name || !description || !systemPrompt || !modelId) {
    return res.status(400).json({ detail: "name, description, systemPrompt, and modelId are required" });
  }

  try {
    const agent = await prisma.agent.create({
      data: {
        name,
        description,
        systemPrompt,
        modelId,
        authorId: req.user.id,
        category: category || "general",
        iconUrl: iconEmoji || "🤖",
        isPublic: false,
        isFeatured: false,
      },
    });

    return res.status(201).json({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      modelId: agent.modelId,
      category: agent.category,
      iconEmoji: agent.iconUrl || "🤖",
      rating: agent.rating,
      usageCount: agent.usageCount,
      isPublic: agent.isPublic,
      createdBy: agent.authorId,
      tags: [agent.category],
      createdAt: agent.createdAt.toISOString(),
    });
  } catch (error: any) {
    console.error("Create agent failed:", error);
    return res.status(500).json({ detail: error.message });
  }
});

// Modify agent configurations
router.patch("/:id", requireUser, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ detail: "Unauthorized" });

  const { id } = req.params;
  const { name, description, systemPrompt, modelId, category, iconEmoji } = req.body;

  try {
    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      return res.status(404).json({ detail: "Agent profile not found" });
    }

    if (agent.authorId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ detail: "Permission denied" });
    }

    const updated = await prisma.agent.update({
      where: { id },
      data: {
        name: name !== undefined ? name : agent.name,
        description: description !== undefined ? description : agent.description,
        systemPrompt: systemPrompt !== undefined ? systemPrompt : agent.systemPrompt,
        modelId: modelId !== undefined ? modelId : agent.modelId,
        category: category !== undefined ? category : agent.category,
        iconUrl: iconEmoji !== undefined ? iconEmoji : agent.iconUrl,
        updatedAt: new Date(),
      },
    });

    return res.json({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      systemPrompt: updated.systemPrompt,
      modelId: updated.modelId,
      category: updated.category,
      iconEmoji: updated.iconUrl || "🤖",
      rating: updated.rating,
      usageCount: updated.usageCount,
      isPublic: updated.isPublic,
      createdBy: updated.authorId,
      tags: [updated.category],
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (error: any) {
    console.error("Update agent failed:", error);
    return res.status(500).json({ detail: error.message });
  }
});

// Remove workspace custom agent
router.delete("/:id", requireUser, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ detail: "Unauthorized" });

  const { id } = req.params;

  try {
    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      return res.status(404).json({ detail: "Agent profile not found" });
    }

    if (agent.authorId !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ detail: "Permission denied" });
    }

    await prisma.agent.delete({ where: { id } });
    return res.status(204).send();
  } catch (error: any) {
    console.error("Delete agent failed:", error);
    return res.status(500).json({ detail: error.message });
  }
});

export default router;
