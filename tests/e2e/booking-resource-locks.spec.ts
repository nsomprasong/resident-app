import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

function createDatabaseClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured.");

  const databaseUrl = new URL(connectionString);
  databaseUrl.searchParams.delete("sslmode");

  return new Client({
    connectionString: databaseUrl.toString(),
    ssl: {
      ca: readFileSync(join(process.cwd(), "certs", "prod-ca-2021.crt"), "utf8"),
      rejectUnauthorized: true,
    },
  });
}

async function acquireBookingResourceLock(client: Client, lockKey: string) {
  await client.query(
    `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
    [lockKey],
  );
}

test("booking resource advisory locks serialize the same resource key", async () => {
  const holder = createDatabaseClient();
  const waiter = createDatabaseClient();

  await holder.connect();
  await waiter.connect();

  let waiterSettled = false;
  const lockKey = "booking-room:00000000-0000-0000-0000-000000000001";

  try {
    await holder.query("BEGIN");
    await acquireBookingResourceLock(holder, lockKey);

    await waiter.query("BEGIN");
    const waitForSameLock = acquireBookingResourceLock(waiter, lockKey).finally(
      () => {
        waiterSettled = true;
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(waiterSettled).toBe(false);

    await holder.query("COMMIT");
    await waitForSameLock;
    expect(waiterSettled).toBe(true);
  } finally {
    await holder.query("ROLLBACK").catch(() => undefined);
    await waiter.query("ROLLBACK").catch(() => undefined);
    await holder.end();
    await waiter.end();
  }
});
