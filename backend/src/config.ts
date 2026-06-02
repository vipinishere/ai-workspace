import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env file
dotenv.config();

export interface Config {
  // App
  APP_ENV: string;
  SECRET_KEY: string;
  FRONTEND_URL: string;
  BACKEND_URL: string;
  PORT: number;

  // Database
  DATABASE_URL: string;
  REDIS_URL: string;

  // Auth - Clerk
  CLERK_SECRET_KEY: string;
  CLERK_PUBLISHABLE_KEY: string;
  CLERK_WEBHOOK_SECRET: string;

  // Encryption (32-byte hex = 64 hex chars)
  ENCRYPTION_KEY: string;

  // Stripe
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_ID_STARTER: string;
  STRIPE_PRICE_ID_PRO: string;
  STRIPE_PRICE_ID_TEAM: string;

  // AI Providers
  OPENROUTER_API_KEY: string;
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  GOOGLE_AI_API_KEY: string;

  // Rate Limiting
  RATE_LIMIT_PER_MINUTE: number;
  RATE_LIMIT_CHAT_PER_MINUTE: number;

  // CORS
  ALLOWED_ORIGINS: string[];
}

export const config: Config = {
  APP_ENV: process.env.APP_ENV || "development",
  SECRET_KEY: process.env.SECRET_KEY || "change-me-in-production",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:3000",
  BACKEND_URL: process.env.BACKEND_URL || "http://localhost:8000",
  PORT: parseInt(process.env.PORT || "8000", 10),

  DATABASE_URL: process.env.DATABASE_URL || "postgresql://aiworkspace:aiworkspace_secret@localhost:5432/aiworkspace",
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379/0",

  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || "",
  CLERK_PUBLISHABLE_KEY: process.env.CLERK_PUBLISHABLE_KEY || "",
  CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET || "",

  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || "0".repeat(64),

  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "",
  STRIPE_PRICE_ID_STARTER: process.env.STRIPE_PRICE_ID_STARTER || "price_starter123",
  STRIPE_PRICE_ID_PRO: process.env.STRIPE_PRICE_ID_PRO || "price_pro123",
  STRIPE_PRICE_ID_TEAM: process.env.STRIPE_PRICE_ID_TEAM || "price_team123",

  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
  GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY || "",

  RATE_LIMIT_PER_MINUTE: parseInt(process.env.RATE_LIMIT_PER_MINUTE || "60", 10),
  RATE_LIMIT_CHAT_PER_MINUTE: parseInt(process.env.RATE_LIMIT_CHAT_PER_MINUTE || "20", 10),

  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:3001")
    .split(",")
    .map((origin) => origin.trim()),
};

export function getConfig(): Config {
  return config;
}
