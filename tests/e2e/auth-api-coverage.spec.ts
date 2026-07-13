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
  { method: "PATCH", path: "/api/bookings/" + id + "/resources" },
  { method: "GET", path: "/api/housekeeping/inspections" },
  { method: "PATCH", path: "/api/housekeeping/inspections/" + id },
  { method: "GET", path: "/api/inspection-catalog" },
  { method: "GET", path: "/api/inspection-catalog/master" },
  { method: "POST", path: "/api/inspection-catalog" },
  { method: "PATCH", path: "/api/inspection-catalog/" + id },
  { method: "GET", path: "/api/orders" },
  { method: "POST", path: "/api/orders" },
  { method: "PATCH", path: "/api/order-items/" + id },
  { method: "PATCH", path: "/api/orders/" + id },
  { method: "GET", path: "/api/payment-channels" },
  { method: "GET", path: "/api/payment-channels/master" },
  { method: "POST", path: "/api/payment-channels" },
  { method: "PATCH", path: "/api/payment-channels/" + id },
  { method: "GET", path: "/api/products" },
  { method: "GET", path: "/api/products/master" },
  { method: "POST", path: "/api/products" },
  { method: "POST", path: "/api/products/images" },
  { method: "GET", path: "/api/food-categories" },
  { method: "POST", path: "/api/food-categories" },
  { method: "GET", path: "/api/product-types" },
  { method: "POST", path: "/api/product-types" },
  { method: "PATCH", path: "/api/products/" + id },
  { method: "GET", path: "/api/rafts" },
  { method: "GET", path: "/api/rafts/master" },
  { method: "POST", path: "/api/rafts" },
  { method: "PATCH", path: "/api/rafts/" + id },
  { method: "GET", path: "/api/reports/export" },
  { method: "GET", path: "/api/room-types" },
  { method: "POST", path: "/api/room-types" },
  { method: "PATCH", path: "/api/room-types/" + id },
  { method: "GET", path: "/api/zones" },
  { method: "POST", path: "/api/zones" },
  { method: "PATCH", path: "/api/zones/" + id },
  { method: "GET", path: "/api/rooms/master" },
  { method: "POST", path: "/api/rooms" },
  { method: "PATCH", path: "/api/rooms/" + id },
  { method: "GET", path: "/api/rooms" },
  { method: "GET", path: "/api/roles" },
  { method: "POST", path: "/api/roles" },
  { method: "PATCH", path: "/api/roles/" + id },
  { method: "GET", path: "/api/roles/" + id + "/permissions" },
  { method: "PUT", path: "/api/roles/" + id + "/permissions" },
  { method: "GET", path: "/api/permissions" },
  { method: "GET", path: "/api/employees" },
  { method: "POST", path: "/api/employees" },
  { method: "PATCH", path: "/api/employees/" + id },
  { method: "POST", path: "/api/employees/" + id + "/reset-password" },
  { method: "GET", path: "/api/system/data-reset" },
  { method: "POST", path: "/api/system/data-reset" },
  { method: "POST", path: "/api/auth/set-password" },
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
