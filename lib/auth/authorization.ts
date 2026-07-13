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
  "ops.read",
  "settings.manage",
  "authorization.manage",
  "data.reset",
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
    "ops.read",
  ]),
  HOUSEKEEPING: new Set([
    "booking.read",
    "inspection.read",
    "inspection.write",
    "inspection.complete",
    "catalog.read",
    "ops.read",
  ]),
  KITCHEN: new Set(["order.read", "order.kitchen", "ops.read"]),
  ACCOUNTING: new Set([
    "booking.read",
    "order.read",
    "payment.read",
    "payment.collect",
    "payment.refund",
    "payment_channel.manage",
    "report.read",
    "ops.read",
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
    "ops.read",
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
  { pattern: /^\/today$/, permission: "ops.read" },
  { pattern: /^\/dashboard$/, permission: "report.read" },
  { pattern: /^\/settings$/, permission: "settings.manage" },
  { pattern: /^\/system\/data-reset$/, permission: "data.reset" },
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
  { method: "PATCH", pattern: /^\/api\/bookings\/[^/]+\/resources$/, permission: "resource.manage" },
  { method: "GET", pattern: /^\/api\/housekeeping\/inspections$/, permission: "inspection.read" },
  { method: "PATCH", pattern: /^\/api\/housekeeping\/inspections\/[^/]+$/, permission: "inspection.write" },
  { method: "GET", pattern: /^\/api\/inspection-catalog\/master$/, permission: "settings.manage" },
  { method: "POST", pattern: /^\/api\/inspection-catalog$/, permission: "catalog.manage" },
  { method: "PATCH", pattern: /^\/api\/inspection-catalog\/[^/]+$/, permission: "catalog.manage" },
  { method: "GET", pattern: /^\/api\/inspection-catalog$/, permission: "catalog.read" },
  { method: "GET", pattern: /^\/api\/orders$/, permission: "order.read" },
  { method: "POST", pattern: /^\/api\/orders$/, permission: "order.write" },
  { method: "PATCH", pattern: /^\/api\/order-items\/[^/]+$/, permission: "order.write" },
  { method: "PATCH", pattern: /^\/api\/orders\/[^/]+$/, permission: "order.kitchen" },
  { method: "GET", pattern: /^\/api\/payment-channels\/master$/, permission: "settings.manage" },
  { method: "GET", pattern: /^\/api\/payment-channels$/, permission: "payment.read" },
  { method: "POST", pattern: /^\/api\/payment-channels$/, permission: "payment_channel.manage" },
  { method: "PATCH", pattern: /^\/api\/payment-channels\/[^/]+$/, permission: "payment_channel.manage" },
  { method: "GET", pattern: /^\/api\/products\/master$/, permission: "settings.manage" },
  { method: "POST", pattern: /^\/api\/products$/, permission: "catalog.manage" },
  { method: "POST", pattern: /^\/api\/products\/images$/, permission: "catalog.manage" },
  { method: "PATCH", pattern: /^\/api\/products\/[^/]+$/, permission: "catalog.manage" },
  { method: "GET", pattern: /^\/api\/products$/, permission: "catalog.read" },
  { method: "GET", pattern: /^\/api\/food-categories$/, permission: "catalog.read" },
  { method: "POST", pattern: /^\/api\/food-categories$/, permission: "catalog.manage" },
  { method: "GET", pattern: /^\/api\/product-types$/, permission: "catalog.read" },
  { method: "POST", pattern: /^\/api\/product-types$/, permission: "catalog.manage" },
  { method: "GET", pattern: /^\/api\/rafts\/master$/, permission: "settings.manage" },
  { method: "POST", pattern: /^\/api\/rafts$/, permission: "resource.manage" },
  { method: "PATCH", pattern: /^\/api\/rafts\/[^/]+$/, permission: "resource.manage" },
  { method: "GET", pattern: /^\/api\/rafts$/, permission: "resource.read" },
  { method: "GET", pattern: /^\/api\/reports\/export$/, permission: "report.read" },
  { method: "GET", pattern: /^\/api\/room-types$/, permission: "settings.manage" },
  { method: "POST", pattern: /^\/api\/room-types$/, permission: "settings.manage" },
  { method: "PATCH", pattern: /^\/api\/room-types\/[^/]+$/, permission: "settings.manage" },
  { method: "GET", pattern: /^\/api\/zones$/, permission: "settings.manage" },
  { method: "POST", pattern: /^\/api\/zones$/, permission: "settings.manage" },
  { method: "PATCH", pattern: /^\/api\/zones\/[^/]+$/, permission: "settings.manage" },
  { method: "GET", pattern: /^\/api\/rooms\/master$/, permission: "settings.manage" },
  { method: "POST", pattern: /^\/api\/rooms$/, permission: "resource.manage" },
  { method: "PATCH", pattern: /^\/api\/rooms\/[^/]+$/, permission: "resource.manage" },
  { method: "GET", pattern: /^\/api\/rooms$/, permission: "resource.read" },
  { method: "GET", pattern: /^\/api\/roles$/, permission: "authorization.manage" },
  { method: "POST", pattern: /^\/api\/roles$/, permission: "authorization.manage" },
  { method: "PATCH", pattern: /^\/api\/roles\/[^/]+$/, permission: "authorization.manage" },
  { method: "GET", pattern: /^\/api\/roles\/[^/]+\/permissions$/, permission: "authorization.manage" },
  { method: "PUT", pattern: /^\/api\/roles\/[^/]+\/permissions$/, permission: "authorization.manage" },
  { method: "GET", pattern: /^\/api\/permissions$/, permission: "authorization.manage" },
  { method: "GET", pattern: /^\/api\/employees$/, permission: "employee.manage" },
  { method: "POST", pattern: /^\/api\/employees$/, permission: "employee.manage" },
  { method: "PATCH", pattern: /^\/api\/employees\/[^/]+$/, permission: "employee.manage" },
  { method: "POST", pattern: /^\/api\/employees\/[^/]+\/reset-password$/, permission: "employee.manage" },
  { method: "GET", pattern: /^\/api\/system\/data-reset$/, permission: "data.reset" },
  { method: "POST", pattern: /^\/api\/system\/data-reset$/, permission: "data.reset" },
];

/**
 * Master Data permission matrix (Phase 15.9)
 *
 * - Page `/settings`: settings.manage (ADMIN, MANAGER)
 * - Structure CRUD (room-types, zones) + master lists: settings.manage
 * - Rooms/rafts mutate: resource.manage (ADMIN, MANAGER)
 * - Products/inspection mutate: catalog.manage (ADMIN, MANAGER)
 * - Payment channels mutate: payment_channel.manage (ADMIN, MANAGER, ACCOUNTING)
 * - Consumer reads stay domain read permissions (catalog.read, resource.read, payment.read)
 */
export const masterDataPermissionMatrix = {
  settingsPage: "settings.manage",
  structureManage: "settings.manage",
  resourceMutate: "resource.manage",
  catalogMutate: "catalog.manage",
  paymentChannelMutate: "payment_channel.manage",
  catalogRead: "catalog.read",
  resourceRead: "resource.read",
  paymentRead: "payment.read",
} as const satisfies Record<string, Permission>;

/** Roles CRUD (Phase 16.2) — ADMIN only per approved matrix */
export const authorizationManagePermission = "authorization.manage" as const satisfies Permission;

/** Employees CRUD (Phase 16.4) — ADMIN only per approved matrix */
export const employeeManagePermission = "employee.manage" as const satisfies Permission;

export function roleCanAccessSettings(role: Role): boolean {
  return hasPermission(role, masterDataPermissionMatrix.settingsPage);
}

export function roleCanMutateCatalog(role: Role): boolean {
  return hasPermission(role, masterDataPermissionMatrix.catalogMutate);
}

export function roleCanMutateResources(role: Role): boolean {
  return hasPermission(role, masterDataPermissionMatrix.resourceMutate);
}

export function roleCanMutatePaymentChannels(role: Role): boolean {
  return hasPermission(role, masterDataPermissionMatrix.paymentChannelMutate);
}

export function roleCanManageAuthorization(role: Role): boolean {
  return hasPermission(role, authorizationManagePermission);
}

export function roleCanManageEmployees(role: Role): boolean {
  return hasPermission(role, employeeManagePermission);
}

export function resolveApiPermission(
  method: string,
  pathname: string,
): Permission | "identity" | null {
  if (method === "GET" && pathname === "/api/auth/me") return "identity";
  if (method === "POST" && pathname === "/api/auth/set-password") {
    return "identity";
  }

  return (
    apiPermissionRules.find(
      (rule) => rule.method === method && rule.pattern.test(pathname),
    )?.permission ?? null
  );
}
