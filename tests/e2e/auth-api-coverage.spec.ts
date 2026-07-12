import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

const id = "00000000-0000-0000-0000-000000000000";

const protectedHandlers = [
  { method: "GET", path: "/api/auth/me" },
  { method: "GET", path: "/api/bookings" },
  { method: "POST", path: "/api/bookings" },
  { method: "GET", path: "/api/bookings/" + id },
  { method: "PATCH", path: "/api/bookings/" + id },
  { method: "POST", path: "/api/bookings/" + id + "/payments" },
  { method: "POST", path: "/api/bookings/" + id + "/refunds" },
  { method: "POST", path: "/api/bookings/" + id + "/resources" },
  { method: "GET", path: "/api/housekeeping/inspections" },
  { method: "PATCH", path: "/api/housekeeping/inspections/" + id },
  { method: "GET", path: "/api/inspection-catalog" },
  { method: "POST", path: "/api/orders" },
  { method: "GET", path: "/api/payment-channels" },
  { method: "POST", path: "/api/payment-channels" },
  { method: "GET", path: "/api/products" },
  { method: "GET", path: "/api/rafts" },
  { method: "GET", path: "/api/rooms" },
] as const;

for (const handler of protectedHandlers) {
  test(handler.method + " " + handler.path + " rejects unauthenticated requests", async ({
    request,
  }) => {
    const response = await request.fetch(handler.path, {
      method: handler.method,
      data: handler.method === "GET" ? undefined : {},
      maxRedirects: 0,
    });

    expect(response.status()).toBe(401);
    expect(response.headers()["content-type"]).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      message: "Authentication required",
    });
  });
}
