import { expect, test } from "@playwright/test";

const email = process.env.E2E_AUTH_EMAIL;
const password = process.env.E2E_AUTH_PASSWORD;

if (!email || !password) {
  throw new Error(
    "E2E_AUTH_EMAIL and E2E_AUTH_PASSWORD must be configured in the local environment.",
  );
}

test.use({ storageState: { cookies: [], origins: [] } });

test("rejects invalid credentials with a generic message", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill("invalid-e2e-user@example.invalid");
  await page.getByLabel("รหัสผ่าน").fill("invalid-password");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();

  await expect(
    page.getByText("อีเมลหรือรหัสผ่านไม่ถูกต้อง", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("logs in, shows mapped identity, and logs out locally", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน").fill(password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("e2e-auth-test", { exact: true })).toBeVisible();
  await expect(page.getByText("ผู้ดูแลระบบ", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "ออกจากระบบ" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/booking");
  await expect(page).toHaveURL(/\/login$/);
});
