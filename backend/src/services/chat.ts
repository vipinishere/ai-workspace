import { Response } from "express";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";
import { prisma } from "../prisma";
import { decrypt } from "./encryption";
import { logUsage } from "./usage";

export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  pricePromptPer1M: number;
  priceCompletionPer1M: number;
  contextLength: number;
  description: string;
}

export const MODELS: Record<string, ModelConfig> = {
  "openai/gpt-4o": {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    pricePromptPer1M: 5.0,
    priceCompletionPer1M: 15.0,
    contextLength: 128000,
    description: "OpenAI high-performance flagship model",
  },
  "openai/gpt-4o-mini": {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    pricePromptPer1M: 0.15,
    priceCompletionPer1M: 0.6,
    contextLength: 128000,
    description: "Fast, lightweight model for everyday tasks",
  },
  "anthropic/claude-3-5-sonnet": {
    id: "anthropic/claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "anthropic",
    pricePromptPer1M: 3.0,
    priceCompletionPer1M: 15.0,
    contextLength: 200000,
    description: "Anthropic's most intelligent model",
  },
  "anthropic/claude-3-haiku": {
    id: "anthropic/claude-3-haiku",
    name: "Claude 3 Haiku",
    provider: "anthropic",
    pricePromptPer1M: 0.25,
    priceCompletionPer1M: 1.25,
    contextLength: 200000,
    description: "Lightweight and ultra-fast model by Anthropic",
  },
  "google/gemini-1.5-pro": {
    id: "google/gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    provider: "google",
    pricePromptPer1M: 3.5,
    priceCompletionPer1M: 10.5,
    contextLength: 1000000,
    description: "Google's premium model with 1M context window",
  },
  "google/gemini-1.5-flash": {
    id: "google/gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    provider: "google",
    pricePromptPer1M: 0.35,
    priceCompletionPer1M: 1.05,
    contextLength: 1000000,
    description: "High-speed and cost-efficient Google model",
  },
  "openrouter/llama-3-8b": {
    id: "openrouter/llama-3-8b",
    name: "Llama 3 8B Instruct",
    provider: "openrouter",
    pricePromptPer1M: 0.05,
    priceCompletionPer1M: 0.05,
    contextLength: 8192,
    description: "Meta open-source model running via OpenRouter",
  },
};

// Map platform configurations
function getPlatformApiKey(provider: string): string {
  switch (provider) {
    case "openai":
      return config.OPENAI_API_KEY;
    case "anthropic":
      return config.ANTHROPIC_API_KEY;
    case "google":
      return config.GOOGLE_AI_API_KEY;
    case "openrouter":
      return config.OPENROUTER_API_KEY;
    default:
      return "";
  }
}

// Resolve and decrypt BYOK API keys or fallback to platform keys
async function resolveApiKey(userId: string, provider: string): Promise<{ key: string; isBYOK: boolean }> {
  const byok = await prisma.apiKey.findFirst({
    where: { userId, provider, isActive: true },
  });

  if (byok && byok.encryptedKey) {
    try {
      const decrypted = decrypt(byok.encryptedKey);
      if (decrypted && decrypted !== "DECRYPTION_ERROR") {
        return { key: decrypted, isBYOK: true };
      }
    } catch (e) {
      console.error(`Failed to decrypt BYOK key for provider ${provider}:`, e);
    }
  }

  return { key: getPlatformApiKey(provider), isBYOK: false };
}

// Stream simulated responses in local dev
async function handleMockStream(
  res: Response,
  modelId: string,
  provider: string,
  userMessage: string,
  saveLogsCallback: (completedText: string, promptTokens: number, completionTokens: number) => Promise<void>
) {
  const modelName = MODELS[modelId]?.name || modelId;
  const replyText = `Hello! This is a simulated stream from **${modelName}** (${provider}) running on the Node.js backend. 

Your prompt was:
> ${userMessage}

In development mode, if you do not have active API credentials configured, this bypass generates realistic streams so you can inspect markdown rendering, syntax highlighting, and live cost calculation cards instantly. Enjoy the workspace!`;

  const chunks = replyText.split(" ");
  let promptTokens = Math.ceil(userMessage.length / 4);
  let completionTokens = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i] + (i < chunks.length - 1 ? " " : "");
    completionTokens += Math.ceil(chunk.length / 4);

    res.write(`data: ${JSON.stringify({ content: chunk, done: false })}\n\n`);
    await new Promise((resolve) => setTimeout(resolve, 30));
  }

  await saveLogsCallback(replyText, promptTokens, completionTokens);
}

export async function streamChat(
  userId: string,
  workspaceId: string | null,
  conversationId: string,
  modelId: string,
  provider: string,
  messages: { role: string; content: string }[],
  systemPrompt: string | null,
  res: Response
) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const modelInfo = MODELS[modelId] || {
    pricePromptPer1M: 0.1,
    priceCompletionPer1M: 0.1,
    name: modelId,
  };

  const userMessage = messages[messages.length - 1]?.content || "";

  // Helper to record db changes after streaming finishes
  const saveLogs = async (fullReply: string, promptToks: number, compToks: number) => {
    const totalToks = promptToks + compToks;
    const cost = 
      (promptToks * modelInfo.pricePromptPer1M) / 1000000 + 
      (compToks * modelInfo.priceCompletionPer1M) / 1000000;

    // Create assistant message
    const msg = await prisma.message.create({
      data: {
        conversationId,
        role: "assistant",
        content: fullReply,
        modelId,
        promptTokens: promptToks,
        completionTokens: compToks,
        totalTokens: totalToks,
        costUsd: cost,
      },
    });

    // Update conversation stats
    const totalAggregates = await prisma.message.aggregate({
      where: { conversationId },
      _sum: { totalTokens: true },
    });

    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        totalTokens: totalAggregates._sum.totalTokens || totalToks,
        updatedAt: new Date(),
      },
    });

    // Log user usage metrics
    await logUsage({
      userId,
      workspaceId,
      conversationId,
      messageId: msg.id,
      provider,
      modelId,
      promptTokens: promptToks,
      completionTokens: compToks,
      totalTokens: totalToks,
      costUsd: cost,
      latencyMs: 300,
      status: "success",
    });

    // Send final payload
    res.write(`data: ${JSON.stringify({
      content: "",
      done: true,
      prompt_tokens: promptToks,
      completion_tokens: compToks,
      tokens: totalToks,
      cost_usd: cost,
      conversation_id: conversationId,
    })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  };

  const { key: apiKey } = await resolveApiKey(userId, provider);

  if (!apiKey) {
    // Falls back to local simulated response
    return handleMockStream(res, modelId, provider, userMessage, saveLogs);
  }

  const startMs = Date.now();

  try {
    if (provider === "openai" || provider === "openrouter") {
      const client = new OpenAI({
        apiKey,
        baseURL: provider === "openrouter" ? "https://openrouter.ai/api/v1" : undefined,
      });

      const openRouterModel = modelId.startsWith("openrouter/") ? modelId.substring(11) : modelId;
      const apiModel = provider === "openai" ? modelId.replace("openai/", "") : openRouterModel;

      const completion = await client.chat.completions.create({
        model: apiModel,
        messages: messages.map((m) => ({ role: m.role as any, content: m.content })),
        stream: true,
      });

      let fullText = "";
      for await (const chunk of completion) {
        const text = chunk.choices[0]?.delta?.content || "";
        if (text) {
          fullText += text;
          res.write(`data: ${JSON.stringify({ content: text, done: false })}\n\n`);
        }
      }

      // Approximate tokens mapping
      const promptTokens = Math.ceil(messages.map((m) => m.content).join(" ").length / 4);
      const completionTokens = Math.ceil(fullText.length / 4);
      await saveLogs(fullText, promptTokens, completionTokens);

    } else if (provider === "anthropic") {
      const client = new Anthropic({ apiKey });
      const apiModel = modelId.replace("anthropic/", "");

      const stream = await client.messages.create({
        model: apiModel,
        max_tokens: 1024,
        messages: messages.map((m) => ({ role: m.role as any, content: m.content })),
        stream: true,
      });

      let fullText = "";
      for await (const chunk of stream) {
        if (chunk.type === "content_block_delta" && (chunk.delta as any).text) {
          const text = (chunk.delta as any).text;
          fullText += text;
          res.write(`data: ${JSON.stringify({ content: text, done: false })}\n\n`);
        }
      }

      const promptTokens = Math.ceil(messages.map((m) => m.content).join(" ").length / 4);
      const completionTokens = Math.ceil(fullText.length / 4);
      await saveLogs(fullText, promptTokens, completionTokens);

    } else if (provider === "google") {
      const apiModel = modelId.replace("google/", "");
      // Fetch stream Generate Content
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${apiModel}:streamGenerateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: messages.map((m) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            })),
            systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Google API failed: HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("[") || trimmed.startsWith(",") || trimmed.startsWith("]")) {
            continue;
          }
          try {
            const parsed = JSON.parse(trimmed);
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
            if (text) {
              fullText += text;
              res.write(`data: ${JSON.stringify({ content: text, done: false })}\n\n`);
            }
          } catch {
            // Ignore partial json lines
          }
        }
      }

      const promptTokens = Math.ceil(messages.map((m) => m.content).join(" ").length / 4);
      const completionTokens = Math.ceil(fullText.length / 4);
      await saveLogs(fullText, promptTokens, completionTokens);
    } else {
      throw new Error(`Unsupported provider: ${provider}`);
    }
  } catch (err: any) {
    console.error("Streaming chat completion error:", err);
    res.write(`data: ${JSON.stringify({ content: `\n\n**Error during streaming**: ${err.message}`, done: false })}\n\n`);
    res.end();
  }
}
