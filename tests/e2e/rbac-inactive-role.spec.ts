import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const email = process.env.E2E_RECEPTION_EMAIL;
const password = process.env.E2E_RECEPTION_PASSWORD;
const loginRedirectTimeoutMs = 15_000;

if (!email || !password) {
  throw new Error("Missing dedicated RECEPTION E2E credentials.");
}

test.use({ storageState: { cookies: [], origins: [] } });

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

test("inactive database role fails closed at the HTTP boundary", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน").fill(password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: loginRedirectTimeoutMs });

  const client = createDatabaseClient();
  await client.connect();

  const role = await client.query<{ is_active: boolean }>(
    `SELECT is_active FROM roles WHERE code = $1`,
    ["RECEPTION"],
  );
  expect(role.rowCount).toBe(1);
  const originalIsActive = role.rows[0]?.is_active;
  expect(originalIsActive).toBe(true);

  try {
    await client.query(`UPDATE roles SET is_active = false WHERE code = $1`, [
      "RECEPTION",
    ]);

    const response = await page.request.get("/api/bookings");
    expect(response.status()).toBe(403);
    await expect(response.json()).resolves.toEqual({
      message: "Insufficient permissions",
    });
  } finally {
    await client.query(`UPDATE roles SET is_active = $1 WHERE code = $2`, [
      originalIsActive,
      "RECEPTION",
    ]);
    await client.end();
  }
});
