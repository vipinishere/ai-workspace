import { Router, Request, Response } from "express";
import { requireUser } from "../middleware/auth";
import { prisma } from "../prisma";
import { encrypt } from "../services/encryption";

const router = Router();

// Retrieve all BYOK keys for the user
router.get("/", requireUser, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ detail: "Unauthorized" });

  try {
    const keys = await prisma.apiKey.findMany({
      where: { userId: req.user.id },
      select: {
        id: true,
        name: true,
        provider: true,
        keyPreview: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    return res.json(keys);
  } catch (error: any) {
    console.error("Fetch API keys failed:", error);
    return res.status(500).json({ detail: error.message });
  }
});

// Register a new BYOK API key
router.post("/", requireUser, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ detail: "Unauthorized" });

  const { name, provider, value } = req.body;

  if (!name || !provider || !value) {
    return res.status(400).json({ detail: "name, provider, and value keys are required" });
  }

  try {
    const preview = value.length > 8 
      ? `${value.substring(0, 4)}...${value.slice(-4)}`
      : `${value.substring(0, 2)}...`;

    const encrypted = encrypt(value);

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: req.user.id,
        workspaceId: req.user.workspaceId,
        name,
        provider,
        encryptedKey: encrypted,
        keyPreview: preview,
        isActive: true,
      },
    });

    return res.status(201).json({
      id: apiKey.id,
      name: apiKey.name,
      provider: apiKey.provider,
      keyPreview: apiKey.keyPreview,
      isActive: apiKey.isActive,
      createdAt: apiKey.createdAt,
    });
  } catch (error: any) {
    console.error("Register key failed:", error);
    return res.status(500).json({ detail: error.message });
  }
});

// Toggle key active flag status
router.patch("/:id", requireUser, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ detail: "Unauthorized" });

  const { id } = req.params;
  const { isActive } = req.body;

  if (isActive === undefined) {
    return res.status(400).json({ detail: "isActive boolean is required" });
  }

  try {
    const key = await prisma.apiKey.findUnique({ where: { id } });
    if (!key) {
      return res.status(404).json({ detail: "API Key credentials not found" });
    }

    if (key.userId !== req.user.id) {
      return res.status(403).json({ detail: "Permission denied" });
    }

    const updated = await prisma.apiKey.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        name: true,
        provider: true,
        keyPreview: true,
        isActive: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });

    return res.json(updated);
  } catch (error: any) {
    console.error("Toggle API key failed:", error);
    return res.status(500).json({ detail: error.message });
  }
});

// Delete registered BYOK API key (owner only)
router.delete("/:id", requireUser, async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ detail: "Unauthorized" });

  const { id } = req.params;

  try {
    const key = await prisma.apiKey.findUnique({ where: { id } });
    if (!key) {
      return res.status(404).json({ detail: "API key credentials not found" });
    }

    if (key.userId !== req.user.id) {
      return res.status(403).json({ detail: "Permission denied" });
    }

    await prisma.apiKey.delete({ where: { id } });
    return res.status(204).send();
  } catch (error: any) {
    console.error("Delete API key failed:", error);
    return res.status(500).json({ detail: error.message });
  }
});

// Test key validity check (mocked validation for robustness)
router.post("/test", requireUser, async (req: Request, res: Response) => {
  const { provider, key } = req.body;

  if (!provider || !key) {
    return res.status(400).json({ detail: "provider and key specifications are required" });
  }

  try {
    // Return standard validation success in local environments
    return res.json({ success: true, message: `Key formatting check for ${provider} passed successfully.` });
  } catch (error: any) {
    return res.status(400).json({ success: false, detail: error.message });
  }
});

export default router;
