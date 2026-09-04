import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const databaseUrl = new URL(connectionString);

if (!databaseUrl.searchParams.has("sslmode")) {
  databaseUrl.searchParams.set("sslmode", "require");
  databaseUrl.searchParams.set("uselibpqcompat", "true");
}

const adapter = new PrismaPg({
  connectionString: databaseUrl.toString(),
  max: 2,
  connectionTimeoutMillis: 15_000,
  idleTimeoutMillis: 30_000,
  maxLifetimeSeconds: 300,
  maxUses: 500,
  keepAlive: true,
  keepAliveInitialDelayMillis: 1_000,
  query_timeout: 15_000,
});

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    transactionOptions: {
      maxWait: 15_000,
      timeout: 20_000,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export function isTransientConnectionError(error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  const message = error instanceof Error ? error.message : String(error);

  return (
    ["P1001", "P1017", "08000", "08003", "08006", "ECONNRESET", "EPIPE", "ETIMEDOUT"].includes(code) ||
    /connection terminated|connection closed|server closed the connection|connection timeout/i.test(message)
  );
}

export async function withDatabaseRetry<T>(operation: () => Promise<T>) {
  const retryDelays = [200, 600, 1_400];

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransientConnectionError(error) || attempt >= retryDelays.length) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelays[attempt]));
    }
  }
}
