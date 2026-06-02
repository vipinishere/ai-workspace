import { config } from "../config";

export interface ProviderHealth {
  provider: string;
  status: "ok" | "degraded" | "down" | "unconfigured";
  latency_ms: number | null;
  last_check: string | null;
  error: string | null;
}

const healthCache: Record<string, ProviderHealth> = {};
let monitorInterval: NodeJS.Timeout | null = null;

async function pingOpenAI(): Promise<ProviderHealth> {
  const provider = "openai";
  if (!config.OPENAI_API_KEY) {
    return { provider, status: "unconfigured", latency_ms: null, last_check: new Date().toISOString(), error: "No API key configured" };
  }
  const start = performance.now();
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${config.OPENAI_API_KEY}` },
    });
    const latency = Math.round(performance.now() - start);
    if (res.ok) {
      return { provider, status: "ok", latency_ms: latency, last_check: new Date().toISOString(), error: null };
    }
    return { provider, status: "degraded", latency_ms: latency, last_check: new Date().toISOString(), error: `HTTP ${res.status}` };
  } catch (err: any) {
    return { provider, status: "down", latency_ms: null, last_check: new Date().toISOString(), error: err.message };
  }
}

async function pingAnthropic(): Promise<ProviderHealth> {
  const provider = "anthropic";
  if (!config.ANTHROPIC_API_KEY) {
    return { provider, status: "unconfigured", latency_ms: null, last_check: new Date().toISOString(), error: "No API key configured" };
  }
  const start = performance.now();
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": config.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1,
        messages: [{ role: "user", content: "ping" }],
      }),
    });
    const latency = Math.round(performance.now() - start);
    if (res.status === 200 || res.status === 400) { // 400 bad request but reachable
      return { provider, status: "ok", latency_ms: latency, last_check: new Date().toISOString(), error: null };
    }
    return { provider, status: "degraded", latency_ms: latency, last_check: new Date().toISOString(), error: `HTTP ${res.status}` };
  } catch (err: any) {
    return { provider, status: "down", latency_ms: null, last_check: new Date().toISOString(), error: err.message };
  }
}

async function pingGoogle(): Promise<ProviderHealth> {
  const provider = "google";
  if (!config.GOOGLE_AI_API_KEY) {
    return { provider, status: "unconfigured", latency_ms: null, last_check: new Date().toISOString(), error: "No API key configured" };
  }
  const start = performance.now();
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${config.GOOGLE_AI_API_KEY}`);
    const latency = Math.round(performance.now() - start);
    if (res.ok) {
      return { provider, status: "ok", latency_ms: latency, last_check: new Date().toISOString(), error: null };
    }
    return { provider, status: "degraded", latency_ms: latency, last_check: new Date().toISOString(), error: `HTTP ${res.status}` };
  } catch (err: any) {
    return { provider, status: "down", latency_ms: null, last_check: new Date().toISOString(), error: err.message };
  }
}

async function pingOpenRouter(): Promise<ProviderHealth> {
  const provider = "openrouter";
  if (!config.OPENROUTER_API_KEY) {
    return { provider, status: "unconfigured", latency_ms: null, last_check: new Date().toISOString(), error: "No API key configured" };
  }
  const start = performance.now();
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${config.OPENROUTER_API_KEY}` },
    });
    const latency = Math.round(performance.now() - start);
    if (res.ok) {
      return { provider, status: "ok", latency_ms: latency, last_check: new Date().toISOString(), error: null };
    }
    return { provider, status: "degraded", latency_ms: latency, last_check: new Date().toISOString(), error: `HTTP ${res.status}` };
  } catch (err: any) {
    return { provider, status: "down", latency_ms: null, last_check: new Date().toISOString(), error: err.message };
  }
}

export async function checkAllProviders(): Promise<Record<string, ProviderHealth>> {
  const results = await Promise.all([
    pingOpenAI(),
    pingAnthropic(),
    pingGoogle(),
    pingOpenRouter(),
  ]);

  results.forEach((h) => {
    healthCache[h.provider] = h;
  });

  return healthCache;
}

export function getHealthStatus(): Record<string, ProviderHealth> {
  return healthCache;
}

export function startHealthMonitor(intervalSeconds: number = 60) {
  if (monitorInterval) clearInterval(monitorInterval);

  // Initial check
  checkAllProviders().catch((err) => console.error("Error checking provider health:", err));

  monitorInterval = setInterval(() => {
    checkAllProviders().catch((err) => console.error("Error checking provider health:", err));
  }, intervalSeconds * 1000);
}

export function stopHealthMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}
