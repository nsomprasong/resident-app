import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

const id = "00000000-0000-0000-0000-000000000000";

const protectedPages = [
  "/",
  "/booking",
  "/booking/" + id,
  "/today",
  "/dashboard",
  "/employeeSchedule",
  "/foodOrder",
  "/foodOrder/" + id + "/basket",
  "/foodOrder/" + id + "/food",
  "/houseKeeperMinibar",
  "/kitchen",
  "/report",
  "/settings",
  "/system/data-reset",
  "/hr",
  "/hr/employees",
  "/hr/schedules",
  "/hr/attendance",
  "/hr/leave",
  "/hr/payroll",
  "/hr/documents",
  "/hr/reports",
  "/hr/settings",
  "/wage",
] as const;

for (const path of protectedPages) {
  test(path + " redirects unauthenticated users to login", async ({ page }) => {
    await page.goto(path);

    await expect(page).toHaveURL(/\/login$/);
  });
}
