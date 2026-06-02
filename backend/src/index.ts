import express from "express";
import http from "http";
import cors from "cors";
import url from "url";
import { WebSocketServer, WebSocket } from "ws";
import { config } from "./config";
import { startHealthMonitor, stopHealthMonitor } from "./services/health";
import { wsManager, verifyWsToken } from "./services/websocket";

// Import Routers
import authRouter from "./routes/auth";
import chatRouter from "./routes/chat";
import analyticsRouter from "./routes/analytics";
import billingRouter from "./routes/billing";
import apiKeysRouter from "./routes/apiKeys";
import workspacesRouter from "./routes/workspaces";
import teamsRouter from "./routes/teams";
import adminRouter from "./routes/admin";
import agentsRouter from "./routes/agents";

const app = express();
const server = http.createServer(app);

// ── WebSockets Server ──────────────────────────────────────────────────────────
const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (ws: WebSocket, userId: string) => {
  wsManager.addConnection(userId, ws);

  ws.on("error", (err) => {
    console.error(`WebSocket error for user ${userId}:`, err);
  });
});

// Intercept HTTP upgrade requests to handle WebSocket token validation
server.on("upgrade", async (request, socket, head) => {
  const parsedUrl = url.parse(request.url || "", true);
  const pathname = parsedUrl.pathname;

  if (pathname === "/api/v1/analytics/ws") {
    const token = parsedUrl.query.token as string;
    if (!token) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const userId = await verifyWsToken(token);
    if (!userId) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, userId);
    });
  } else {
    socket.destroy();
  }
});

// ── CORS & Parsing Middlewares ───────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || config.ALLOWED_ORIGINS.includes(origin) || origin.startsWith("http://localhost:")) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  })
);

// Raw parser specifically for Stripe webhook signature verification
app.post(
  "/api/v1/billing/webhook",
  express.raw({ type: "application/json" }),
  billingRouter
);

// Standard JSON body parser for all other routes
app.use(express.json());

// ── Routers ──────────────────────────────────────────────────────────────────
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/chat", chatRouter);
app.use("/api/v1/analytics", analyticsRouter);
app.use("/api/v1/billing", billingRouter);
app.use("/api/v1/api-keys", apiKeysRouter);
app.use("/api/v1/workspace", workspacesRouter);
app.use("/api/v1/team", teamsRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/agents", agentsRouter);

// Alias /api/v1/models to models listing in chat router
import { MODELS } from "./services/chat";
app.get("/api/v1/models", (req, res) => {
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

// ── System Health & Fallback ──────────────────────────────────────────────────
app.get("/health", (req, res) => {
  return res.json({
    status: "ok",
    version: "1.0.0",
    environment: config.APP_ENV,
    framework: "express-node",
  });
});

app.get("/", (req, res) => {
  return res.json({
    message: "AI Workspace API (Node.js)",
    docs: "/docs-simulated",
    version: "1.0.0",
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Global express error handler:", err.message);
  return res.status(500).json({ detail: err.message || "Internal Server Error" });
});

// ── Server Boot ──────────────────────────────────────────────────────────────
const PORT = config.PORT;
server.listen(PORT, () => {
  console.info(`[Node] AI Workspace API running on http://localhost:${PORT}`);
  
  // Start active provider health checks background loop
  startHealthMonitor(60);
});

// Handle graceful server shutdown
process.on("SIGTERM", () => {
  console.info("[Node] SIGTERM received. Shutting down health pings and HTTP server...");
  stopHealthMonitor();
  server.close(() => {
    process.exit(0);
  });
});
