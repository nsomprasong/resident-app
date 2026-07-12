export const roles = [
  "ADMIN",
  "RECEPTION",
  "HOUSEKEEPING",
  "KITCHEN",
  "ACCOUNTING",
  "MANAGER",
] as const;

export type Role = (typeof roles)[number];

export const permissions = [
  "booking.read",
  "booking.write",
  "booking.lifecycle",
  "resource.read",
  "resource.manage",
  "order.read",
  "order.write",
  "order.kitchen",
  "payment.read",
  "payment.collect",
  "payment.refund",
  "payment_channel.manage",
  "inspection.read",
  "inspection.write",
  "inspection.complete",
  "catalog.read",
  "catalog.manage",
  "employee.read",
  "employee.manage",
  "wage.read",
  "report.read",
  "settings.manage",
  "authorization.manage",
] as const;

export type Permission = (typeof permissions)[number];

const roleAliases: Readonly<Record<string, Role>> = {
  ADMIN: "ADMIN",
  RECEPTION: "RECEPTION",
  HOUSEKEEPING: "HOUSEKEEPING",
  KITCHEN: "KITCHEN",
  ACCOUNTING: "ACCOUNTING",
  MANAGER: "MANAGER",
  ผู้ดูแลระบบ: "ADMIN",
  พนักงานต้อนรับ: "RECEPTION",
  แม่บ้าน: "HOUSEKEEPING",
  ครัว: "KITCHEN",
  "บัญชี/แคชเชียร์": "ACCOUNTING",
  ผู้จัดการ: "MANAGER",
};

const allPermissions = new Set<Permission>(permissions);

const rolePermissions: Readonly<Record<Role, ReadonlySet<Permission>>> = {
  ADMIN: allPermissions,
  RECEPTION: new Set([
    "booking.read",
    "booking.write",
    "booking.lifecycle",
    "resource.read",
    "order.read",
    "order.write",
    "payment.read",
    "payment.collect",
    "inspection.read",
    "catalog.read",
  ]),
  HOUSEKEEPING: new Set([
    "booking.read",
    "inspection.read",
    "inspection.write",
    "inspection.complete",
    "catalog.read",
  ]),
  KITCHEN: new Set(["order.read", "order.kitchen"]),
  ACCOUNTING: new Set([
    "booking.read",
    "order.read",
    "payment.read",
    "payment.collect",
    "payment.refund",
    "payment_channel.manage",
    "report.read",
  ]),
  MANAGER: new Set([
    "booking.read",
    "booking.write",
    "booking.lifecycle",
    "resource.read",
    "resource.manage",
    "order.read",
    "order.write",
    "order.kitchen",
    "payment.read",
    "payment.collect",
    "payment.refund",
    "payment_channel.manage",
    "inspection.read",
    "inspection.write",
    "inspection.complete",
    "catalog.read",
    "catalog.manage",
    "employee.read",
    "wage.read",
    "report.read",
    "settings.manage",
  ]),
};

export function resolveRole(value: string): Role | null {
  return roleAliases[value.trim()] ?? null;
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role].has(permission);
}

type PagePermissionRule = {
  pattern: RegExp;
  permission: Permission | "known-role";
};

const pagePermissionRules: readonly PagePermissionRule[] = [
  { pattern: /^\/$/, permission: "known-role" },
  { pattern: /^\/booking(?:\/[^/]+)?$/, permission: "booking.read" },
  { pattern: /^\/foodOrder(?:\/[^/]+\/(?:basket|food))?$/, permission: "order.write" },
  { pattern: /^\/kitchen$/, permission: "order.kitchen" },
  { pattern: /^\/employeeSchedule$/, permission: "employee.read" },
  { pattern: /^\/houseKeeperMinibar$/, permission: "inspection.read" },
  { pattern: /^\/dashboard$/, permission: "report.read" },
  { pattern: /^\/wage$/, permission: "wage.read" },
  { pattern: /^\/report$/, permission: "report.read" },
];

export function resolvePagePermission(
  pathname: string,
): Permission | "known-role" | null {
  return (
    pagePermissionRules.find((rule) => rule.pattern.test(pathname))?.permission ??
    null
  );
}

export function canAccessPage(roleValue: string, pathname: string): boolean {
  const role = resolveRole(roleValue);
  const requiredPermission = resolvePagePermission(pathname);

  if (!role || !requiredPermission) return false;
  return requiredPermission === "known-role" || hasPermission(role, requiredPermission);
}

export function canAccessPageWithPermissions(
  permissionCodes: readonly string[],
  pathname: string,
): boolean {
  const requiredPermission = resolvePagePermission(pathname);
  if (!requiredPermission) return false;
  return (
    requiredPermission === "known-role" ||
    permissionCodes.includes(requiredPermission)
  );
}

type ApiPermissionRule = {
  method: string;
  pattern: RegExp;
  permission: Permission;
};

const apiPermissionRules: readonly ApiPermissionRule[] = [
  { method: "GET", pattern: /^\/api\/bookings$/, permission: "booking.read" },
  { method: "POST", pattern: /^\/api\/bookings$/, permission: "booking.write" },
  { method: "GET", pattern: /^\/api\/bookings\/[^/]+$/, permission: "booking.read" },
  { method: "PATCH", pattern: /^\/api\/bookings\/[^/]+$/, permission: "booking.lifecycle" },
  { method: "POST", pattern: /^\/api\/bookings\/[^/]+\/payments$/, permission: "payment.collect" },
  { method: "POST", pattern: /^\/api\/bookings\/[^/]+\/refunds$/, permission: "payment.refund" },
  { method: "POST", pattern: /^\/api\/bookings\/[^/]+\/resources$/, permission: "resource.manage" },
  { method: "GET", pattern: /^\/api\/housekeeping\/inspections$/, permission: "inspection.read" },
  { method: "PATCH", pattern: /^\/api\/housekeeping\/inspections\/[^/]+$/, permission: "inspection.write" },
  { method: "GET", pattern: /^\/api\/inspection-catalog$/, permission: "catalog.read" },
  { method: "POST", pattern: /^\/api\/orders$/, permission: "order.write" },
  { method: "GET", pattern: /^\/api\/payment-channels$/, permission: "payment.read" },
  { method: "POST", pattern: /^\/api\/payment-channels$/, permission: "payment_channel.manage" },
  { method: "GET", pattern: /^\/api\/products$/, permission: "catalog.read" },
  { method: "GET", pattern: /^\/api\/rafts$/, permission: "resource.read" },
  { method: "GET", pattern: /^\/api\/rooms$/, permission: "resource.read" },
];

export function resolveApiPermission(
  method: string,
  pathname: string,
): Permission | "identity" | null {
  if (method === "GET" && pathname === "/api/auth/me") return "identity";

  return (
    apiPermissionRules.find(
      (rule) => rule.method === method && rule.pattern.test(pathname),
    )?.permission ?? null
  );
}
