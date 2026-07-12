import { expect, test } from "@playwright/test";

import {
  canAccessPage,
  hasPermission,
  permissions,
  resolveApiPermission,
  resolvePagePermission,
  resolveRole,
  roles,
} from "../../lib/auth/authorization";

test("approved roles and legacy aliases resolve explicitly", () => {
  expect(roles).toHaveLength(6);
  expect(resolveRole("ผู้ดูแลระบบ")).toBe("ADMIN");
  expect(resolveRole("แม่บ้าน")).toBe("HOUSEKEEPING");
  expect(resolveRole("UNKNOWN")).toBeNull();
});

test("every protected page resolves to an explicit permission", () => {
  const pages = [
    ["/", "known-role"],
    ["/booking", "booking.read"],
    ["/booking/id", "booking.read"],
    ["/foodOrder", "order.write"],
    ["/foodOrder/id/basket", "order.write"],
    ["/foodOrder/id/food", "order.write"],
    ["/kitchen", "order.kitchen"],
    ["/employeeSchedule", "employee.read"],
    ["/houseKeeperMinibar", "inspection.read"],
    ["/dashboard", "report.read"],
    ["/wage", "wage.read"],
    ["/report", "report.read"],
  ] as const;

  for (const [path, permission] of pages) {
    expect(resolvePagePermission(path)).toBe(permission);
  }

  expect(resolvePagePermission("/unknown")).toBeNull();
  expect(canAccessPage("RECEPTION", "/booking")).toBe(true);
  expect(canAccessPage("RECEPTION", "/kitchen")).toBe(false);
  expect(canAccessPage("UNKNOWN_E2E", "/")).toBe(false);
});

test("every current business API method resolves to an explicit permission", () => {
  const id = "00000000-0000-0000-0000-000000000000";
  const handlers = [
    ["GET", "/api/auth/me", "identity"],
    ["GET", "/api/bookings", "booking.read"],
    ["POST", "/api/bookings", "booking.write"],
    ["GET", `/api/bookings/${id}`, "booking.read"],
    ["PATCH", `/api/bookings/${id}`, "booking.lifecycle"],
    ["POST", `/api/bookings/${id}/payments`, "payment.collect"],
    ["POST", `/api/bookings/${id}/refunds`, "payment.refund"],
    ["POST", `/api/bookings/${id}/resources`, "resource.manage"],
    ["GET", "/api/housekeeping/inspections", "inspection.read"],
    ["PATCH", `/api/housekeeping/inspections/${id}`, "inspection.write"],
    ["GET", "/api/inspection-catalog", "catalog.read"],
    ["POST", "/api/orders", "order.write"],
    ["GET", "/api/payment-channels", "payment.read"],
    ["POST", "/api/payment-channels", "payment_channel.manage"],
    ["GET", "/api/products", "catalog.read"],
    ["GET", "/api/rafts", "resource.read"],
    ["GET", "/api/rooms", "resource.read"],
  ] as const;

  for (const [method, path, permission] of handlers) {
    expect(resolveApiPermission(method, path)).toBe(permission);
  }

  expect(resolveApiPermission("POST", "/api/unknown")).toBeNull();
});

test("permission policy follows approved financial and administration rules", () => {
  expect(hasPermission("RECEPTION", "payment.collect")).toBe(true);
  expect(hasPermission("RECEPTION", "payment.refund")).toBe(false);
  expect(hasPermission("HOUSEKEEPING", "inspection.write")).toBe(true);
  expect(hasPermission("HOUSEKEEPING", "payment.collect")).toBe(false);
  expect(hasPermission("KITCHEN", "order.kitchen")).toBe(true);
  expect(hasPermission("KITCHEN", "booking.read")).toBe(false);
  expect(hasPermission("MANAGER", "payment.refund")).toBe(true);
  expect(hasPermission("MANAGER", "settings.manage")).toBe(true);
  expect(hasPermission("MANAGER", "authorization.manage")).toBe(false);
  expect(hasPermission("ADMIN", "authorization.manage")).toBe(true);
  expect(permissions.every((permission) => hasPermission("ADMIN", permission))).toBe(
    true,
  );
});
