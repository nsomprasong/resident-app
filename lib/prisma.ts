import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  const databaseUrl = new URL(connectionString);
  databaseUrl.searchParams.delete("sslmode");
  const ca = readFileSync(join(process.cwd(), "certs", "prod-ca-2021.crt"), "utf8");
  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: databaseUrl.toString(),
      ssl: { ca, rejectUnauthorized: true },
    }),
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
