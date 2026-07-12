import { expect, test } from "@playwright/test";

const email = process.env.E2E_UNMAPPED_AUTH_EMAIL;
const password = process.env.E2E_UNMAPPED_AUTH_PASSWORD;

test.describe("unmapped Auth user", () => {
  test.skip(
    !email || !password,
    "Dedicated unmapped Auth user credentials are not configured.",
  );

  test.use({ storageState: { cookies: [], origins: [] } });

  test("is denied and does not retain a session after login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("อีเมล").fill(email ?? "");
    await page.getByLabel("รหัสผ่าน").fill(password ?? "");
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();

    await expect(
      page.getByText("บัญชีนี้ยังไม่ได้รับสิทธิ์เข้าใช้งานระบบ", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);

    const response = await page.request.get("/api/auth/me");
    expect(response.status()).toBe(401);
  });
});
