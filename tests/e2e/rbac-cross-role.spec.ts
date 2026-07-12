import { expect, test, type APIResponse, type Page } from "@playwright/test";

type FixtureRole =
  | "RECEPTION"
  | "HOUSEKEEPING"
  | "KITCHEN"
  | "ACCOUNTING"
  | "MANAGER";

type RoleFixture = {
  role: FixtureRole | "UNKNOWN_E2E";
  email: string | undefined;
  password: string | undefined;
};

const fixtures: RoleFixture[] = [
  {
    role: "RECEPTION",
    email: process.env.E2E_RECEPTION_EMAIL,
    password: process.env.E2E_RECEPTION_PASSWORD,
  },
  {
    role: "HOUSEKEEPING",
    email: process.env.E2E_HOUSEKEEPING_EMAIL,
    password: process.env.E2E_HOUSEKEEPING_PASSWORD,
  },
  {
    role: "KITCHEN",
    email: process.env.E2E_KITCHEN_EMAIL,
    password: process.env.E2E_KITCHEN_PASSWORD,
  },
  {
    role: "ACCOUNTING",
    email: process.env.E2E_ACCOUNTING_EMAIL,
    password: process.env.E2E_ACCOUNTING_PASSWORD,
  },
  {
    role: "MANAGER",
    email: process.env.E2E_MANAGER_EMAIL,
    password: process.env.E2E_MANAGER_PASSWORD,
  },
];

const unknownRoleFixture: RoleFixture = {
  role: "UNKNOWN_E2E",
  email: process.env.E2E_UNKNOWN_ROLE_EMAIL,
  password: process.env.E2E_UNKNOWN_ROLE_PASSWORD,
};

fixtures.push(unknownRoleFixture);

for (const fixture of fixtures) {
  if (!fixture.email || !fixture.password) {
    throw new Error(`Missing dedicated ${fixture.role} E2E credentials.`);
  }
}

test.use({ storageState: { cookies: [], origins: [] } });

async function login(page: Page, fixture: RoleFixture) {
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(fixture.email ?? "");
  await page.getByLabel("รหัสผ่าน").fill(fixture.password ?? "");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/$/);

  const identity = await page.request.get("/api/auth/me");
  if (fixture.role === "UNKNOWN_E2E") {
    expect(identity.status()).toBe(403);
    return;
  }

  expect(identity.status()).toBe(200);
  const body = (await identity.json()) as { employee: { role: string } };
  expect(body.employee.role).toBe(fixture.role);
}

async function expectForbidden(response: APIResponse) {
  expect(response.status()).toBe(403);
  await expect(response.json()).resolves.toEqual({
    message: "Insufficient permissions",
  });
}

test("RECEPTION can read bookings but cannot refund", async ({ page }) => {
  await login(page, fixtures[0]);
  expect((await page.request.get("/api/bookings")).status()).not.toBe(403);
  await expectForbidden(
    await page.request.post(
      "/api/bookings/00000000-0000-0000-0000-000000000000/refunds",
      { data: {} },
    ),
  );
});

test("HOUSEKEEPING can read inspection catalog but cannot read payments", async ({
  page,
}) => {
  await login(page, fixtures[1]);
  expect((await page.request.get("/api/inspection-catalog")).status()).not.toBe(
    403,
  );
  await expectForbidden(await page.request.get("/api/payment-channels"));
});

test("KITCHEN identity is mapped but booking access is denied", async ({ page }) => {
  await login(page, fixtures[2]);
  await expectForbidden(await page.request.get("/api/bookings"));
});

test("ACCOUNTING can read payments but cannot create bookings", async ({ page }) => {
  await login(page, fixtures[3]);
  expect((await page.request.get("/api/payment-channels")).status()).not.toBe(403);
  await expectForbidden(
    await page.request.post("/api/bookings", { data: {} }),
  );
});

test("MANAGER reaches an authorized master-data handler", async ({ page }) => {
  await login(page, fixtures[4]);
  const response = await page.request.post("/api/payment-channels", { data: {} });
  expect(response.status()).not.toBe(401);
  expect(response.status()).not.toBe(403);
});

test("unknown role is denied by the HTTP boundary", async ({ page }) => {
  await login(page, unknownRoleFixture);
  await page.goto("/");
  await expect(page).toHaveURL(/\/forbidden$/);
  await expectForbidden(await page.request.get("/api/bookings"));
});
