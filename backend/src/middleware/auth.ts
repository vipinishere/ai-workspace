import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import jwksRsa from "jwks-rsa";
import { config } from "../config";
import { prisma } from "../prisma";
import { User } from "@prisma/client";

// Extend Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

let jwksClientInstance: any;
if (config.CLERK_SECRET_KEY) {
  jwksClientInstance = jwksRsa({
    jwksUri: "https://api.clerk.com/v1/jwks",
    requestHeaders: {
      Authorization: `Bearer ${config.CLERK_SECRET_KEY}`,
    },
    cache: true,
    rateLimit: true,
  });
}

function getKey(header: any, callback: any) {
  if (!jwksClientInstance) {
    callback(new Error("Clerk JWKS client is not configured"));
    return;
  }
  jwksClientInstance.getSigningKey(header.kid, (err: any, key: any) => {
    if (err) {
      callback(err);
    } else {
      const signingKey = key.getPublicKey();
      callback(null, signingKey);
    }
  });
}

// Map plans to quota
const PLAN_QUOTAS: Record<string, number> = {
  free: 100000,
  starter: 1000000,
  pro: 5000000,
  team: 20000000,
};

async function getOrCreateUser(clerkId: string, email: string, name: string, avatarUrl?: string): Promise<User> {
  // Find or create user
  let user = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (!user) {
    // Determine user plan and default metadata settings
    const username = email.split("@")[0];
    const defaultSlug = `workspace-${username.toLowerCase().replace(/[^a-z0-9]/g, "")}`;

    user = await prisma.$transaction(async (tx) => {
      // Create user first
      const newUser = await tx.user.create({
        data: {
          clerkId,
          email,
          name: name || username,
          avatarUrl: avatarUrl || "",
          plan: "free",
          isAdmin: false,
        },
      });

      // Create a default subscription
      await tx.subscription.create({
        data: {
          userId: newUser.id,
          stripeCustomerId: "",
          plan: "free",
          status: "active",
          selectedModels: [],
          tokenQuotaMonthly: PLAN_QUOTAS.free,
          tokenUsedThisMonth: 0,
        },
      });

      // Create a default workspace
      const defaultWorkspace = await tx.workspace.create({
        data: {
          name: "My Workspace",
          slug: defaultSlug,
          ownerId: newUser.id,
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

      // Link workspace to user
      const updatedUser = await tx.user.update({
        where: { id: newUser.id },
        data: { workspaceId: defaultWorkspace.id },
      });

      // Add owner as a team member
      await tx.teamMember.create({
        data: {
          workspaceId: defaultWorkspace.id,
          userId: newUser.id,
          role: "owner",
          joinedAt: new Date(),
        },
      });

      return updatedUser;
    });
  }

  return user;
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ detail: "Missing or invalid authorization header" });
  }

  const token = authHeader.substring(7);

  // Check for mock mode / bypass
  if (!config.CLERK_SECRET_KEY || token.startsWith("mock_")) {
    let val = token.startsWith("mock_") ? token.substring(5) : "dev_user";
    if (!val || val === "undefined" || val === "null") {
      val = "dev_user";
    }
    const email = val.includes("@") ? val : `${val}@example.com`;
    const clerkId = `user_mock_${val.split("@")[0]}`;
    const name = `Dev User_${val.split("@")[0]}`;

    try {
      const user = await getOrCreateUser(clerkId, email, name);
      req.user = user;
      return next();
    } catch (err: any) {
      console.error("Auth bypass provisioning error:", err);
      return res.status(500).json({ detail: `Auth bypass provisioning failed: ${err.message}` });
    }
  }

  // Real Clerk JWT Verification
  jwt.verify(token, getKey, { algorithms: ["RS256"] }, async (err: any, decoded: any) => {
    if (err) {
      return res.status(401).json({ detail: `Token verification failed: ${err.message}` });
    }

    try {
      const clerkId = decoded.sub;
      const email = decoded.email || "";
      const firstName = decoded.first_name || "";
      const lastName = decoded.last_name || "";
      const name = `${firstName} ${lastName}`.trim() || email.split("@")[0];
      const avatarUrl = decoded.image_url || "";

      if (!clerkId) {
        return res.status(401).json({ detail: "Missing subject in Clerk token" });
      }

      const user = await getOrCreateUser(clerkId, email, name, avatarUrl);
      req.user = user;
      next();
    } catch (dbErr: any) {
      console.error("Database user resolution error:", dbErr);
      return res.status(500).json({ detail: "Database error resolving user account" });
    }
  });
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  authenticate(req, res, (err) => {
    if (err) return next(err);
    if (!req.user) {
      return res.status(401).json({ detail: "Authentication required" });
    }
    next();
  });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireUser(req, res, (err) => {
    if (err) return next(err);
    if (!config.CLERK_SECRET_KEY) {
      // Mock mode sets admin privilege
      if (req.user) {
        req.user.isAdmin = true;
      }
      return next();
    }
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ detail: "Admin access required" });
    }
    next();
  });
}

export async function optionalUser(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  authenticate(req, res, () => {
    next();
  });
}
