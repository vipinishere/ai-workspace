import { PrismaClient } from "@prisma/client";
import { config } from "./config";

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: config.DATABASE_URL,
    },
  },
  log: config.APP_ENV === "development" ? ["error", "warn"] : ["error"],
});

// Handle graceful shutdown
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});
