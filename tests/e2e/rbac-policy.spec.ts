import { expect, test } from "@playwright/test";

import {
  authorizationManagePermission,
  canAccessPage,
  employeeManagePermission,
  hasPermission,
  masterDataPermissionMatrix,
  permissions,
  resolveApiPermission,
  resolvePagePermission,
  resolveRole,
  roleCanAccessSettings,
  roleCanManageAuthorization,
  roleCanManageEmployees,
  roleCanMutateCatalog,
  roleCanMutatePaymentChannels,
  roleCanMutateResources,
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
    ["/today", "ops.read"],
    ["/dashboard", "report.read"],
    ["/settings", "settings.manage"],
    ["/system/data-reset", "data.reset"],
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
    ["PATCH", `/api/bookings/${id}/resources`, "resource.manage"],
    ["GET", "/api/housekeeping/inspections", "inspection.read"],
    ["PATCH", `/api/housekeeping/inspections/${id}`, "inspection.write"],
    ["GET", "/api/inspection-catalog", "catalog.read"],
    ["GET", "/api/inspection-catalog/master", "settings.manage"],
    ["POST", "/api/inspection-catalog", "catalog.manage"],
    ["PATCH", `/api/inspection-catalog/${id}`, "catalog.manage"],
    ["GET", "/api/orders", "order.read"],
    ["POST", "/api/orders", "order.write"],
    ["PATCH", `/api/order-items/${id}`, "order.write"],
    ["PATCH", `/api/orders/${id}`, "order.kitchen"],
    ["GET", "/api/payment-channels", "payment.read"],
    ["GET", "/api/payment-channels/master", "settings.manage"],
    ["POST", "/api/payment-channels", "payment_channel.manage"],
    ["PATCH", `/api/payment-channels/${id}`, "payment_channel.manage"],
    ["GET", "/api/products", "catalog.read"],
    ["GET", "/api/products/master", "settings.manage"],
    ["POST", "/api/products", "catalog.manage"],
    ["POST", "/api/products/images", "catalog.manage"],
    ["GET", "/api/food-categories", "catalog.read"],
    ["POST", "/api/food-categories", "catalog.manage"],
    ["GET", "/api/product-types", "catalog.read"],
    ["POST", "/api/product-types", "catalog.manage"],
    ["PATCH", `/api/products/${id}`, "catalog.manage"],
    ["GET", "/api/rafts", "resource.read"],
    ["GET", "/api/rafts/master", "settings.manage"],
    ["POST", "/api/rafts", "resource.manage"],
    ["PATCH", `/api/rafts/${id}`, "resource.manage"],
    ["GET", "/api/reports/export", "report.read"],
    ["GET", "/api/room-types", "settings.manage"],
    ["POST", "/api/room-types", "settings.manage"],
    ["PATCH", `/api/room-types/${id}`, "settings.manage"],
    ["GET", "/api/zones", "settings.manage"],
    ["POST", "/api/zones", "settings.manage"],
    ["PATCH", `/api/zones/${id}`, "settings.manage"],
    ["GET", "/api/rooms/master", "settings.manage"],
    ["POST", "/api/rooms", "resource.manage"],
    ["PATCH", `/api/rooms/${id}`, "resource.manage"],
    ["GET", "/api/rooms", "resource.read"],
    ["GET", "/api/roles", "authorization.manage"],
    ["POST", "/api/roles", "authorization.manage"],
    ["PATCH", `/api/roles/${id}`, "authorization.manage"],
    ["GET", `/api/roles/${id}/permissions`, "authorization.manage"],
    ["PUT", `/api/roles/${id}/permissions`, "authorization.manage"],
    ["GET", "/api/permissions", "authorization.manage"],
    ["GET", "/api/employees", "employee.manage"],
    ["POST", "/api/employees", "employee.manage"],
    ["PATCH", `/api/employees/${id}`, "employee.manage"],
    ["POST", `/api/employees/${id}/reset-password`, "employee.manage"],
    ["GET", "/api/system/data-reset", "data.reset"],
    ["POST", "/api/system/data-reset", "data.reset"],
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
  expect(hasPermission("MANAGER", "data.reset")).toBe(false);
  expect(hasPermission("ADMIN", "authorization.manage")).toBe(true);
  expect(hasPermission("ADMIN", "data.reset")).toBe(true);
  expect(canAccessPage("ADMIN", "/system/data-reset")).toBe(true);
  expect(canAccessPage("MANAGER", "/system/data-reset")).toBe(false);
  expect(permissions.every((permission) => hasPermission("ADMIN", permission))).toBe(
    true,
  );
});

test("master data permission matrix matches role policy", () => {
  expect(resolvePagePermission("/settings")).toBe(
    masterDataPermissionMatrix.settingsPage,
  );

  expect(roleCanAccessSettings("ADMIN")).toBe(true);
  expect(roleCanAccessSettings("MANAGER")).toBe(true);
  expect(roleCanAccessSettings("RECEPTION")).toBe(false);
  expect(roleCanAccessSettings("ACCOUNTING")).toBe(false);
  expect(roleCanAccessSettings("HOUSEKEEPING")).toBe(false);
  expect(roleCanAccessSettings("KITCHEN")).toBe(false);

  expect(roleCanMutateCatalog("ADMIN")).toBe(true);
  expect(roleCanMutateCatalog("MANAGER")).toBe(true);
  expect(roleCanMutateCatalog("RECEPTION")).toBe(false);
  expect(roleCanMutateCatalog("HOUSEKEEPING")).toBe(false);

  expect(roleCanMutateResources("ADMIN")).toBe(true);
  expect(roleCanMutateResources("MANAGER")).toBe(true);
  expect(roleCanMutateResources("RECEPTION")).toBe(false);

  expect(roleCanMutatePaymentChannels("ADMIN")).toBe(true);
  expect(roleCanMutatePaymentChannels("MANAGER")).toBe(true);
  expect(roleCanMutatePaymentChannels("ACCOUNTING")).toBe(true);
  expect(roleCanMutatePaymentChannels("RECEPTION")).toBe(false);

  expect(canAccessPage("RECEPTION", "/settings")).toBe(false);
  expect(canAccessPage("MANAGER", "/settings")).toBe(true);

  expect(resolveApiPermission("POST", "/api/products")).toBe(
    masterDataPermissionMatrix.catalogMutate,
  );
  expect(resolveApiPermission("POST", "/api/products/images")).toBe(
    masterDataPermissionMatrix.catalogMutate,
  );
  expect(resolveApiPermission("GET", "/api/food-categories")).toBe(
    masterDataPermissionMatrix.catalogRead,
  );
  expect(resolveApiPermission("POST", "/api/food-categories")).toBe(
    masterDataPermissionMatrix.catalogMutate,
  );
  expect(resolveApiPermission("GET", "/api/product-types")).toBe(
    masterDataPermissionMatrix.catalogRead,
  );
  expect(resolveApiPermission("POST", "/api/product-types")).toBe(
    masterDataPermissionMatrix.catalogMutate,
  );
  expect(resolveApiPermission("POST", "/api/rooms")).toBe(
    masterDataPermissionMatrix.resourceMutate,
  );
  expect(resolveApiPermission("POST", "/api/room-types")).toBe(
    masterDataPermissionMatrix.structureManage,
  );
  expect(resolveApiPermission("POST", "/api/payment-channels")).toBe(
    masterDataPermissionMatrix.paymentChannelMutate,
  );
  expect(resolveApiPermission("GET", "/api/products")).toBe(
    masterDataPermissionMatrix.catalogRead,
  );
  expect(resolveApiPermission("GET", "/api/rooms")).toBe(
    masterDataPermissionMatrix.resourceRead,
  );
  expect(resolveApiPermission("GET", "/api/payment-channels")).toBe(
    masterDataPermissionMatrix.paymentRead,
  );

  const roleId = "00000000-0000-0000-0000-000000000000";
  expect(roleCanManageAuthorization("ADMIN")).toBe(true);
  expect(roleCanManageAuthorization("MANAGER")).toBe(false);
  expect(resolveApiPermission("GET", "/api/roles")).toBe(
    authorizationManagePermission,
  );
  expect(resolveApiPermission("POST", "/api/roles")).toBe(
    authorizationManagePermission,
  );
  expect(resolveApiPermission("PATCH", `/api/roles/${roleId}`)).toBe(
    authorizationManagePermission,
  );
  expect(resolveApiPermission("GET", `/api/roles/${roleId}/permissions`)).toBe(
    authorizationManagePermission,
  );
  expect(resolveApiPermission("PUT", `/api/roles/${roleId}/permissions`)).toBe(
    authorizationManagePermission,
  );
  expect(resolveApiPermission("GET", "/api/permissions")).toBe(
    authorizationManagePermission,
  );
  expect(roleCanManageEmployees("ADMIN")).toBe(true);
  expect(roleCanManageEmployees("MANAGER")).toBe(false);
  expect(resolveApiPermission("GET", "/api/employees")).toBe(
    employeeManagePermission,
  );
  expect(resolveApiPermission("POST", "/api/employees")).toBe(
    employeeManagePermission,
  );
  expect(resolveApiPermission("PATCH", `/api/employees/${roleId}`)).toBe(
    employeeManagePermission,
  );
  expect(
    resolveApiPermission("POST", `/api/employees/${roleId}/reset-password`),
  ).toBe(employeeManagePermission);
  expect(resolveApiPermission("POST", "/api/auth/set-password")).toBe(
    "identity",
  );
});
