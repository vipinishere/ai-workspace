import { Router, Request, Response } from "express";
import { requireUser } from "../middleware/auth";
import { prisma } from "../prisma";

const router = Router();

// Retrieve user's current active workspace profile
router.get("/", requireUser, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ detail: "Unauthorized" });

  let workspaceId = req.user.workspaceId;
  let workspace = null;

  if (workspaceId) {
    workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });
  }

  // Fallback: look up workspace where user is owner
  if (!workspace) {
    workspace = await prisma.workspace.findFirst({
      where: { ownerId: req.user.id },
    });
  }

  if (!workspace) {
    // Provision workspace in case it is missing
    const defaultSlug = `workspace-${req.user.name.toLowerCase().replace(/[^a-z0-9]/g, "")}-${Date.now().toString().slice(-4)}`;
    workspace = await prisma.$transaction(async (tx) => {
      const newWs = await tx.workspace.create({
        data: {
          name: "My Workspace",
          slug: defaultSlug,
          ownerId: req.user!.id,
          plan: "free",
          maxMembers: 1,
          settings: {
            defaultModel: "openai/gpt-4o-mini",
            defaultSystemPrompt: "You are a helpful AI assistant.",
            description: "My personal AI workspace.",
            notifications: {
              emailOnLowBalance: true,
              emailOnQuotaExceeded: true,
              emailWeeklyReport: true,
              emailNewFeatures: false,
              emailBilling: true,
            },
          },
        },
      });

      // Update user active workspace link
      await tx.user.update({
        where: { id: req.user!.id },
        data: { workspaceId: newWs.id },
      });

      // Add team member owner link
      await tx.teamMember.create({
        data: {
          workspaceId: newWs.id,
          userId: req.user!.id,
          role: "owner",
          joinedAt: new Date(),
        },
      });

      return newWs;
    });
  }

  return res.json(workspace);
});

// Update workspace profile metadata (name, slug, configuration)
router.patch("/", requireUser, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ detail: "Unauthorized" });

  const workspaceId = req.user.workspaceId;
  if (!workspaceId) {
    return res.status(404).json({ detail: "Active workspace not found" });
  }

  // Ensure user is owner or admin in this workspace
  const member = await prisma.teamMember.findFirst({
    where: { workspaceId, userId: req.user.id },
  });

  if (!member || !["owner", "admin"].includes(member.role)) {
    return res.status(403).json({ detail: "Permission denied. Only owners/admins can modify workspace configurations." });
  }

  const { name, slug, settings, description } = req.body;

  try {
    // If slug is changing, verify uniqueness
    if (slug) {
      const existing = await prisma.workspace.findUnique({ where: { slug } });
      if (existing && existing.id !== workspaceId) {
        return res.status(400).json({ detail: "Workspace URL slug is already taken" });
      }
    }

    const currentWorkspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!currentWorkspace) {
      return res.status(404).json({ detail: "Workspace not found" });
    }

    // Merge settings if passed
    let mergedSettings = currentWorkspace.settings || {};
    if (settings) {
      mergedSettings = {
        ...(typeof mergedSettings === "object" ? mergedSettings : {}),
        ...settings,
      };
    }

    if (description) {
      (mergedSettings as any).description = description;
    }

    const updatedWorkspace = await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        name: name !== undefined ? name : currentWorkspace.name,
        slug: slug !== undefined ? slug : currentWorkspace.slug,
        settings: mergedSettings,
        updatedAt: new Date(),
      },
    });

    return res.json(updatedWorkspace);
  } catch (error: any) {
    console.error("Workspace update failed:", error);
    return res.status(500).json({ detail: error.message });
  }
});

export default router;
