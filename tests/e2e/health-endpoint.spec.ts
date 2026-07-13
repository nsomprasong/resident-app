import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("GET /api/health is public and returns a stable monitoring payload", async ({
  request,
}) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/json");
  expect(response.headers()["cache-control"]).toContain("no-store");

  const body = (await response.json()) as {
    status: string;
    service: string;
    timestamp: string;
  };

  expect(body.status).toBe("ok");
  expect(body.service).toBe("resident-app");
  expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect(JSON.stringify(body)).not.toMatch(/secret|password|token/i);
});
