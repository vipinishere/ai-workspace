import { WebSocket } from "ws";
import jwt from "jsonwebtoken";
import jwksRsa from "jwks-rsa";
import { config } from "../config";
import { prisma } from "../prisma";

class ConnectionManager {
  private connections = new Map<string, WebSocket[]>();

  public addConnection(userId: string, ws: WebSocket) {
    const userConnections = this.connections.get(userId) || [];
    userConnections.push(ws);
    this.connections.set(userId, userConnections);

    ws.on("close", () => {
      this.removeConnection(userId, ws);
    });
  }

  public removeConnection(userId: string, ws: WebSocket) {
    const userConnections = this.connections.get(userId) || [];
    const index = userConnections.indexOf(ws);
    if (index > -1) {
      userConnections.splice(index, 1);
    }
    if (userConnections.length === 0) {
      this.connections.delete(userId);
    } else {
      this.connections.set(userId, userConnections);
    }
  }

  public broadcastToUser(userId: string, data: any) {
    const userConnections = this.connections.get(userId);
    if (!userConnections) return;

    const payload = JSON.stringify(data);
    userConnections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });
  }
}

export const wsManager = new ConnectionManager();

// Parse and verify Clerk JWT / mock token for WebSocket connections
export async function verifyWsToken(token: string): Promise<string | null> {
  if (!token) return null;

  // Mock token bypass
  if (!config.CLERK_SECRET_KEY || token.startsWith("mock_")) {
    let val = token.startsWith("mock_") ? token.substring(5) : "dev_user";
    if (!val || val === "undefined" || val === "null") {
      val = "dev_user";
    }
    const clerkId = `user_mock_${val.split("@")[0]}`;
    const user = await prisma.user.findUnique({ where: { clerkId } });
    return user ? user.id : null;
  }

  // Real verification
  return new Promise((resolve) => {
    const jwksClientInstance = jwksRsa({
      jwksUri: "https://api.clerk.com/v1/jwks",
      requestHeaders: {
        Authorization: `Bearer ${config.CLERK_SECRET_KEY}`,
      },
      cache: true,
      rateLimit: true,
    });

    function getKey(header: any, callback: any) {
      jwksClientInstance.getSigningKey(header.kid, (err: any, key: any) => {
        if (err) {
          callback(err);
        } else {
          callback(null, key.getPublicKey());
        }
      });
    }

    jwt.verify(token, getKey, { algorithms: ["RS256"] }, async (err: any, decoded: any) => {
      if (err || !decoded || !decoded.sub) {
        resolve(null);
      } else {
        const user = await prisma.user.findUnique({ where: { clerkId: decoded.sub } });
        resolve(user ? user.id : null);
      }
    });
  });
}
