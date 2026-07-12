import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("login page is public", async ({ page }) => {
  await page.goto("/login");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeVisible();
  await expect(page.getByLabel("อีเมล")).toBeVisible();
  await expect(page.getByLabel("รหัสผ่าน")).toBeVisible();
});

test("protected page redirects to login", async ({ page }) => {
  await page.goto("/booking");

  await expect(page).toHaveURL(/\/login$/);
});

test("protected API returns JSON 401", async ({ request }) => {
  const response = await request.get("/api/bookings");

  expect(response.status()).toBe(401);
  expect(response.headers()["content-type"]).toContain("application/json");
  await expect(response.json()).resolves.toEqual({
    message: "Authentication required",
  });
});

test("logout endpoint remains available without a session", async ({ request }) => {
  const response = await request.post("/api/auth/logout", {
    maxRedirects: 0,
  });

  expect(response.status()).toBe(303);
  expect(response.headers().location).toMatch(/\/login$/);
});
