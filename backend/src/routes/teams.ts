import { Router, Request, Response } from "express";
import { requireUser } from "../middleware/auth";
import { prisma } from "../prisma";

const router = Router();

// Retrieve all team members in current active workspace
router.get("/members", requireUser, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ detail: "Unauthorized" });

  const workspaceId = req.user.workspaceId;
  if (!workspaceId) {
    return res.json([]);
  }

  try {
    const members = await prisma.teamMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
    });

    const result = members.map((m) => ({
      id: m.id,
      userId: m.userId,
      workspaceId: m.workspaceId,
      email: m.user.email,
      name: m.user.name,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      joinedAt: m.joinedAt?.toISOString() || m.createdAt.toISOString(),
      invitedBy: m.invitedBy,
    }));

    return res.json(result);
  } catch (error: any) {
    console.error("Fetch team members failed:", error);
    return res.status(500).json({ detail: error.message });
  }
});

// Invite a user to join workspace (auto-adds if user exists in database for mock-up simplicity)
router.post("/invites", requireUser, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ detail: "Unauthorized" });

  const workspaceId = req.user.workspaceId;
  if (!workspaceId) {
    return res.status(404).json({ detail: "Active workspace not found" });
  }

  // Verify inviter role
  const selfMember = await prisma.teamMember.findFirst({
    where: { workspaceId, userId: req.user.id },
  });

  if (!selfMember || !["owner", "admin"].includes(selfMember.role)) {
    return res.status(403).json({ detail: "Only workspace owners/admins can invite members." });
  }

  const { email, role } = req.body;
  if (!email) {
    return res.status(400).json({ detail: "Email address is required" });
  }

  try {
    // Check if user is already a member
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMember = await prisma.teamMember.findFirst({
        where: { workspaceId, userId: existingUser.id },
      });
      if (existingMember) {
        return res.status(400).json({ detail: "User is already a member of this workspace" });
      }

      // Add to team_members
      const newMember = await prisma.teamMember.create({
        data: {
          workspaceId,
          userId: existingUser.id,
          role: role || "member",
          invitedBy: req.user.id,
          joinedAt: new Date(),
        },
      });

      return res.status(201).json({
        id: newMember.id,
        email: existingUser.email,
        name: existingUser.name,
        role: newMember.role,
        status: "accepted",
      });
    }

    // If user does not exist locally, we simulate a pending invite structure
    return res.status(201).json({
      email,
      role: role || "member",
      status: "pending",
      message: "Simulation: Invitation sent to email successfully.",
    });
  } catch (error: any) {
    console.error("Invite member failed:", error);
    return res.status(500).json({ detail: error.message });
  }
});

// Modify member's role permissions (owner/admin only)
router.patch("/members/:userId/role", requireUser, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ detail: "Unauthorized" });

  const workspaceId = req.user.workspaceId;
  if (!workspaceId) {
    return res.status(404).json({ detail: "Active workspace not found" });
  }

  const { userId } = req.params;
  const { role } = req.body;

  if (!role || !["admin", "member", "viewer"].includes(role)) {
    return res.status(400).json({ detail: "Invalid role specification" });
  }

  try {
    // Verify editing user is owner/admin
    const selfMember = await prisma.teamMember.findFirst({
      where: { workspaceId, userId: req.user.id },
    });

    if (!selfMember || !["owner", "admin"].includes(selfMember.role)) {
      return res.status(403).json({ detail: "Only owners/admins can modify member roles." });
    }

    // Verify user is member
    const targetMember = await prisma.teamMember.findFirst({
      where: { workspaceId, userId },
    });

    if (!targetMember) {
      return res.status(404).json({ detail: "Member not found in workspace" });
    }

    if (targetMember.role === "owner") {
      return res.status(400).json({ detail: "Workspace owner role cannot be changed" });
    }

    const updated = await prisma.teamMember.update({
      where: { id: targetMember.id },
      data: { role },
    });

    return res.json(updated);
  } catch (error: any) {
    console.error("Update role failed:", error);
    return res.status(500).json({ detail: error.message });
  }
});

// Remove a member from the workspace team (owner/admin only)
router.delete("/members/:userId", requireUser, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ detail: "Unauthorized" });

  const workspaceId = req.user.workspaceId;
  if (!workspaceId) {
    return res.status(404).json({ detail: "Active workspace not found" });
  }

  const { userId } = req.params;

  try {
    const selfMember = await prisma.teamMember.findFirst({
      where: { workspaceId, userId: req.user.id },
    });

    if (!selfMember || !["owner", "admin"].includes(selfMember.role)) {
      return res.status(403).json({ detail: "Only owners/admins can remove members." });
    }

    const targetMember = await prisma.teamMember.findFirst({
      where: { workspaceId, userId },
    });

    if (!targetMember) {
      return res.status(404).json({ detail: "Member not found in workspace" });
    }

    if (targetMember.role === "owner") {
      return res.status(400).json({ detail: "Workspace owner cannot be removed." });
    }

    await prisma.teamMember.delete({ where: { id: targetMember.id } });

    // Respond with raw 204 response
    return res.status(204).send();
  } catch (error: any) {
    console.error("Remove member failed:", error);
    return res.status(500).json({ detail: error.message });
  }
});

export default router;
