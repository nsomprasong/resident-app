import { expect, test, type Page } from "@playwright/test";

type PageFixture = {
  role: string;
  email: string | undefined;
  password: string | undefined;
  allowedPath: string;
  forbiddenPath: string;
  visibleMenuPath?: string;
  hiddenMenuPath?: string;
};

const fixtures: PageFixture[] = [
  { role: "RECEPTION", email: process.env.E2E_RECEPTION_EMAIL, password: process.env.E2E_RECEPTION_PASSWORD, allowedPath: "/booking", forbiddenPath: "/kitchen", visibleMenuPath: "/booking", hiddenMenuPath: "/kitchen" },
  { role: "HOUSEKEEPING", email: process.env.E2E_HOUSEKEEPING_EMAIL, password: process.env.E2E_HOUSEKEEPING_PASSWORD, allowedPath: "/houseKeeperMinibar", forbiddenPath: "/foodOrder" },
  { role: "KITCHEN", email: process.env.E2E_KITCHEN_EMAIL, password: process.env.E2E_KITCHEN_PASSWORD, allowedPath: "/kitchen", forbiddenPath: "/booking" },
  { role: "ACCOUNTING", email: process.env.E2E_ACCOUNTING_EMAIL, password: process.env.E2E_ACCOUNTING_PASSWORD, allowedPath: "/dashboard", forbiddenPath: "/foodOrder" },
  { role: "MANAGER", email: process.env.E2E_MANAGER_EMAIL, password: process.env.E2E_MANAGER_PASSWORD, allowedPath: "/report", forbiddenPath: "/forbidden" },
];

const unknownFixture = {
  role: "UNKNOWN_E2E",
  email: process.env.E2E_UNKNOWN_ROLE_EMAIL,
  password: process.env.E2E_UNKNOWN_ROLE_PASSWORD,
};

for (const fixture of [...fixtures, unknownFixture]) {
  if (!fixture.email || !fixture.password) {
    throw new Error(`Missing dedicated ${fixture.role} E2E credentials.`);
  }
}

test.use({ storageState: { cookies: [], origins: [] } });

async function login(page: Page, fixture: Pick<PageFixture, "email" | "password">) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(fixture.email ?? "");
  await page.getByLabel("รหัสผ่าน").fill(fixture.password ?? "");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
}

for (const fixture of fixtures) {
  test(`${fixture.role} page access follows the role policy`, async ({ page }) => {
    await login(page, fixture);
    await expect(page).toHaveURL(/\/$/);

    if (fixture.visibleMenuPath && fixture.hiddenMenuPath) {
      await expect(page.locator(`aside a[href="${fixture.visibleMenuPath}"]`)).toBeVisible();
      await expect(page.locator(`aside a[href="${fixture.hiddenMenuPath}"]`)).toHaveCount(0);
    }

    await page.goto(fixture.allowedPath);
    await expect(page).toHaveURL(new RegExp(`${fixture.allowedPath}$`));

    if (fixture.forbiddenPath !== "/forbidden") {
      await page.goto(fixture.forbiddenPath);
      await expect(page).toHaveURL(/\/forbidden$/);
    }
  });
}

test("unknown role cannot access any protected page", async ({ page }) => {
  await login(page, unknownFixture);
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/forbidden$/);
});
