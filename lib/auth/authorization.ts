export const roles = [
  "ADMIN",
  "RECEPTION",
  "HOUSEKEEPING",
  "KITCHEN",
  "ACCOUNTING",
  "MANAGER",
  "OWNER",
  "SUPERMARKET",
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
  "payment.view",
  "payment.create",
  "payment.submit",
  "payment.verify",
  "payment.cancel",
  "payment.receipt.print",
  "payment.promptpay_settings.view",
  "payment.promptpay_settings.manage",
  "payment.report.view",
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
  "audit.read",
  "hr.employee.view",
  "hr.employee.create",
  "hr.employee.update",
  "hr.employee.archive",
  "hr.sensitive.view",
  "hr.compensation.view",
  "hr.schedule.manage",
  "hr.attendance.manage",
  "hr.attendance.approve",
  "hr.leave.request",
  "hr.leave.approve",
  "hr.payroll.calculate",
  "hr.payroll.approve",
  "hr.payroll.mark_paid",
  "hr.payroll.adjust",
  "hr.payroll.unlock",
  "hr.document.manage",
  "hr.report.view",
  "hr.settings.manage",
  "hr.attendance.self",
  "hr.leave.self",
  "hr.overtime.manage",
  "hr.payroll_summary.view",
  "pos.view",
  "pos.sell",
  "pos.discount",
  "pos.hold",
  "pos.cancel",
  "pos.refund",
  "pos.shift.open",
  "pos.shift.close",
  "pos.shift.approve",
  "pos.product.view",
  "pos.product.manage",
  "pos.stock.view",
  "pos.stock.receive",
  "pos.stock.adjust",
  "pos.stock.count",
  "pos.report.view",
  "pos.accounting.post",
  "pos.settings.manage",
] as const;

export type Permission = (typeof permissions)[number];

const roleAliases: Readonly<Record<string, Role>> = {
  ADMIN: "ADMIN",
  RECEPTION: "RECEPTION",
  HOUSEKEEPING: "HOUSEKEEPING",
  KITCHEN: "KITCHEN",
  ACCOUNTING: "ACCOUNTING",
  MANAGER: "MANAGER",
  OWNER: "OWNER",
  SUPERMARKET: "SUPERMARKET",
  ผู้ดูแลระบบ: "ADMIN",
  พนักงานต้อนรับ: "RECEPTION",
  แม่บ้าน: "HOUSEKEEPING",
  ครัว: "KITCHEN",
  "บัญชี/แคชเชียร์": "ACCOUNTING",
  ผู้จัดการ: "MANAGER",
  เจ้าของ: "OWNER",
  ซูเปอร์มาร์เก็ต: "SUPERMARKET",
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
    "payment.view",
    "payment.create",
    "payment.submit",
    "payment.cancel",
    "payment.receipt.print",
    "payment.promptpay_settings.view",
    "inspection.read",
    "catalog.read",
    "ops.read",
    "pos.view",
    "pos.sell",
    "pos.hold",
    "pos.shift.open",
    "pos.shift.close",
    "pos.product.view",
    "pos.stock.view",
    "hr.attendance.self",
    "hr.leave.self",
  ]),
  HOUSEKEEPING: new Set([
    "booking.read",
    "inspection.read",
    "inspection.write",
    "inspection.complete",
    "catalog.read",
    "ops.read",
    "hr.attendance.self",
    "hr.leave.self",
  ]),
  KITCHEN: new Set([
    "order.read",
    "order.kitchen",
    "ops.read",
    "hr.attendance.self",
    "hr.leave.self",
  ]),
  ACCOUNTING: new Set([
    "booking.read",
    "order.read",
    "payment.read",
    "payment.collect",
    "payment.refund",
    "payment.view",
    "payment.create",
    "payment.submit",
    "payment.verify",
    "payment.cancel",
    "payment.receipt.print",
    "payment.promptpay_settings.view",
    "payment.promptpay_settings.manage",
    "payment.report.view",
    "payment_channel.manage",
    "report.read",
    "ops.read",
    "hr.compensation.view",
    "hr.payroll.calculate",
    "hr.payroll.adjust",
    "hr.payroll.unlock",
    "hr.report.view",
    "pos.view",
    "pos.report.view",
    "pos.accounting.post",
    "hr.attendance.self",
    "hr.leave.self",
    "hr.payroll_summary.view",
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
    "payment.view",
    "payment.create",
    "payment.submit",
    "payment.verify",
    "payment.cancel",
    "payment.receipt.print",
    "payment.promptpay_settings.view",
    "payment.promptpay_settings.manage",
    "payment.report.view",
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
    "hr.employee.view",
    "hr.employee.create",
    "hr.employee.update",
    "hr.sensitive.view",
    "hr.compensation.view",
    "hr.schedule.manage",
    "hr.attendance.manage",
    "hr.attendance.approve",
    "hr.leave.request",
    "hr.leave.approve",
    "hr.payroll.calculate",
    "hr.document.manage",
    "hr.report.view",
    "hr.settings.manage",
    "hr.attendance.self",
    "hr.leave.self",
    "hr.overtime.manage",
    "hr.payroll_summary.view",
    "pos.view",
    "pos.sell",
    "pos.discount",
    "pos.hold",
    "pos.cancel",
    "pos.refund",
    "pos.shift.open",
    "pos.shift.close",
    "pos.shift.approve",
    "pos.product.view",
    "pos.product.manage",
    "pos.stock.view",
    "pos.stock.receive",
    "pos.stock.adjust",
    "pos.stock.count",
    "pos.report.view",
    "pos.accounting.post",
    "pos.settings.manage",
  ]),
  // Mirrors production RolePermission rows for DB-defined roles not in the original matrix.
  OWNER: new Set([
    "booking.lifecycle",
    "booking.read",
    "booking.write",
    "catalog.manage",
    "catalog.read",
    "employee.manage",
    "employee.read",
    "hr.attendance.approve",
    "hr.attendance.manage",
    "hr.compensation.view",
    "hr.document.manage",
    "hr.employee.archive",
    "hr.employee.create",
    "hr.employee.update",
    "hr.employee.view",
    "hr.leave.approve",
    "hr.leave.request",
    "hr.overtime.manage",
    "hr.payroll_summary.view",
    "hr.payroll.adjust",
    "hr.payroll.approve",
    "hr.payroll.calculate",
    "hr.payroll.mark_paid",
    "hr.payroll.unlock",
    "hr.report.view",
    "hr.schedule.manage",
    "hr.sensitive.view",
    "hr.settings.manage",
    "inspection.complete",
    "inspection.read",
    "inspection.write",
    "ops.read",
    "order.kitchen",
    "order.read",
    "order.write",
    "payment_channel.manage",
    "payment.cancel",
    "payment.collect",
    "payment.create",
    "payment.promptpay_settings.manage",
    "payment.promptpay_settings.view",
    "payment.read",
    "payment.receipt.print",
    "payment.refund",
    "payment.report.view",
    "payment.submit",
    "payment.verify",
    "payment.view",
    "report.read",
    "resource.manage",
    "resource.read",
    "settings.manage",
    "wage.read",
  ]),
  SUPERMARKET: new Set([
    "hr.attendance.self",
    "hr.leave.self",
    "pos.accounting.post",
    "pos.cancel",
    "pos.hold",
    "pos.product.manage",
    "pos.product.view",
    "pos.refund",
    "pos.sell",
    "pos.shift.close",
    "pos.shift.open",
    "pos.stock.receive",
    "pos.stock.view",
    "pos.view",
  ]),
};

export function resolveRole(value: string): Role | null {
  return roleAliases[value.trim()] ?? null;
}

export function hasPermission(role: Role, permission: Permission): boolean {
  const granted = rolePermissions[role];
  return granted?.has(permission) ?? false;
}

type PagePermissionRule = {
  pattern: RegExp;
  permission: Permission | "known-role" | { readonly anyOf: readonly Permission[] };
};

function pagePermissionMatches(
  requirement: PagePermissionRule["permission"],
  has: (permission: Permission) => boolean,
): boolean {
  if (requirement === "known-role") return true;
  if (typeof requirement === "object" && "anyOf" in requirement) {
    return requirement.anyOf.some(has);
  }
  return has(requirement);
}

function resolvePagePermissionFromRule(
  requirement: PagePermissionRule["permission"],
): Permission | "known-role" | null {
  if (requirement === "known-role") return "known-role";
  if (typeof requirement === "object" && "anyOf" in requirement) {
    return requirement.anyOf[0] ?? null;
  }
  return requirement;
}

const pagePermissionRules: readonly PagePermissionRule[] = [
  { pattern: /^\/$/, permission: "known-role" },
  { pattern: /^\/booking(?:\/[^/]+)?$/, permission: "booking.read" },
  { pattern: /^\/foodOrder(?:\/[^/]+\/(?:basket|food))?$/, permission: "order.write" },
  { pattern: /^\/kitchen$/, permission: "order.kitchen" },
  { pattern: /^\/employeeSchedule$/, permission: "hr.schedule.manage" },
  { pattern: /^\/houseKeeperMinibar$/, permission: "inspection.read" },
  { pattern: /^\/today$/, permission: "ops.read" },
  { pattern: /^\/dashboard$/, permission: "report.read" },
  { pattern: /^\/settings$/, permission: "settings.manage" },
  { pattern: /^\/system\/data-reset$/, permission: "data.reset" },
  { pattern: /^\/system\/audit-logs$/, permission: "audit.read" },
  { pattern: /^\/wage$/, permission: "hr.compensation.view" },
  { pattern: /^\/report$/, permission: "report.read" },
  { pattern: /^\/hr$/, permission: "hr.employee.view" },
  { pattern: /^\/hr\/employees(?:\/.*)?$/, permission: "hr.employee.view" },
  { pattern: /^\/hr\/schedules(?:\/.*)?$/, permission: "hr.schedule.manage" },
  { pattern: /^\/hr\/attendance-review(?:\/.*)?$/, permission: "hr.attendance.manage" },
  { pattern: /^\/hr\/attendance(?:\/.*)?$/, permission: "hr.attendance.manage" },
  { pattern: /^\/hr\/leave(?:\/.*)?$/, permission: "hr.leave.request" },
  { pattern: /^\/hr\/payroll(?:\/.*)?$/, permission: "hr.compensation.view" },
  { pattern: /^\/hr\/documents(?:\/.*)?$/, permission: "hr.document.manage" },
  { pattern: /^\/hr\/reports(?:\/.*)?$/, permission: "hr.report.view" },
  { pattern: /^\/hr\/settings(?:\/.*)?$/, permission: { anyOf: ["hr.settings.manage", "hr.schedule.manage"] } },
  { pattern: /^\/hr\/time-pay(?:\/.*)?$/, permission: "hr.attendance.manage" },
  { pattern: /^\/my-work$/, permission: "hr.attendance.self" },
  { pattern: /^\/pos\/products(?:\/.*)?$/, permission: "pos.product.view" },
  { pattern: /^\/pos\/stock(?:\/.*)?$/, permission: "pos.stock.view" },
  { pattern: /^\/pos\/shifts(?:\/.*)?$/, permission: "pos.shift.open" },
  { pattern: /^\/pos\/reports(?:\/.*)?$/, permission: "pos.report.view" },
  { pattern: /^\/pos\/settings(?:\/.*)?$/, permission: "pos.settings.manage" },
  { pattern: /^\/pos(?:\/.*)?$/, permission: "pos.view" },
];

export function resolvePagePermission(
  pathname: string,
): Permission | "known-role" | null {
  const rule = pagePermissionRules.find((item) => item.pattern.test(pathname));
  if (!rule) return null;
  return resolvePagePermissionFromRule(rule.permission);
}

export function canAccessPage(roleValue: string, pathname: string): boolean {
  const role = resolveRole(roleValue);
  const rule = pagePermissionRules.find((item) => item.pattern.test(pathname));
  if (!role || !rule) return false;
  return pagePermissionMatches(rule.permission, (permission) =>
    hasPermission(role, permission),
  );
}

export function canAccessPageWithPermissions(
  permissionCodes: readonly string[] | null | undefined,
  pathname: string,
): boolean {
  const codes = permissionCodes ?? [];
  const rule = pagePermissionRules.find((item) => item.pattern.test(pathname));
  if (!rule) return false;
  return pagePermissionMatches(rule.permission, (permission) =>
    codes.includes(permission),
  );
}

type ApiPermissionRule = {
  method: string;
  pattern: RegExp;
  permission: Permission | { readonly anyOf: readonly Permission[] };
};

export type ApiPermissionRequirement =
  | Permission
  | "identity"
  | { readonly anyOf: readonly Permission[] };

const apiPermissionRules: readonly ApiPermissionRule[] = [
  { method: "GET", pattern: /^\/api\/bookings$/, permission: "booking.read" },
  { method: "POST", pattern: /^\/api\/bookings$/, permission: "booking.write" },
  { method: "GET", pattern: /^\/api\/bookings\/[^/]+$/, permission: "booking.read" },
  { method: "PATCH", pattern: /^\/api\/bookings\/[^/]+$/, permission: "booking.lifecycle" },
  { method: "POST", pattern: /^\/api\/bookings\/[^/]+\/payments$/, permission: "payment.collect" },
  { method: "GET", pattern: /^\/api\/bookings\/[^/]+\/promptpay-payments$/, permission: {
    anyOf: ["payment.view", "payment.read"],
  } },
  { method: "POST", pattern: /^\/api\/bookings\/[^/]+\/promptpay-payments$/, permission: {
    anyOf: ["payment.create", "payment.collect"],
  } },
  { method: "POST", pattern: /^\/api\/bookings\/[^/]+\/promptpay-payments\/[^/]+\/submit$/, permission: {
    anyOf: ["payment.submit", "payment.collect"],
  } },
  { method: "POST", pattern: /^\/api\/bookings\/[^/]+\/promptpay-payments\/[^/]+\/verify$/, permission: "payment.verify" },
  { method: "POST", pattern: /^\/api\/bookings\/[^/]+\/promptpay-payments\/[^/]+\/reject$/, permission: "payment.verify" },
  { method: "POST", pattern: /^\/api\/bookings\/[^/]+\/promptpay-payments\/[^/]+\/cancel$/, permission: {
    anyOf: ["payment.cancel", "payment.collect"],
  } },
  { method: "POST", pattern: /^\/api\/bookings\/[^/]+\/promptpay-payments\/[^/]+\/refund$/, permission: "payment.refund" },
  { method: "GET", pattern: /^\/api\/bookings\/[^/]+\/promptpay-payments\/[^/]+\/slip$/, permission: {
    anyOf: ["payment.view", "payment.verify", "payment.read"],
  } },
  { method: "GET", pattern: /^\/api\/bookings\/[^/]+\/promptpay-payments\/[^/]+\/qr$/, permission: {
    anyOf: ["payment.view", "payment.create", "payment.receipt.print", "payment.read"],
  } },
  { method: "POST", pattern: /^\/api\/bookings\/[^/]+\/refunds$/, permission: "payment.refund" },
  { method: "GET", pattern: /^\/api\/promptpay-accounts$/, permission: {
    anyOf: ["payment.promptpay_settings.view", "payment.create", "payment.collect"],
  } },
  { method: "GET", pattern: /^\/api\/promptpay-accounts\/master$/, permission: {
    anyOf: ["payment.promptpay_settings.manage", "settings.manage"],
  } },
  { method: "POST", pattern: /^\/api\/promptpay-accounts$/, permission: "payment.promptpay_settings.manage" },
  { method: "PATCH", pattern: /^\/api\/promptpay-accounts\/[^/]+$/, permission: "payment.promptpay_settings.manage" },
  { method: "GET", pattern: /^\/api\/payments\/report$/, permission: {
    anyOf: ["payment.report.view", "report.read"],
  } },
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
  { method: "GET", pattern: /^\/api\/food-sets$/, permission: {
    anyOf: ["catalog.read", "settings.manage"],
  } },
  { method: "POST", pattern: /^\/api\/food-sets$/, permission: "catalog.manage" },
  { method: "GET", pattern: /^\/api\/food-sets\/[^/]+$/, permission: {
    anyOf: ["catalog.read", "settings.manage"],
  } },
  { method: "PATCH", pattern: /^\/api\/food-sets\/[^/]+$/, permission: "catalog.manage" },
  { method: "DELETE", pattern: /^\/api\/food-sets\/[^/]+$/, permission: "catalog.manage" },
  { method: "GET", pattern: /^\/api\/tour-groups\/[^/]+\/food-set$/, permission: "order.write" },
  { method: "PUT", pattern: /^\/api\/tour-groups\/[^/]+\/food-set$/, permission: "order.write" },
  { method: "DELETE", pattern: /^\/api\/tour-groups\/[^/]+\/food-set$/, permission: "order.write" },
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
  { method: "DELETE", pattern: /^\/api\/room-types\/[^/]+$/, permission: "settings.manage" },
  { method: "GET", pattern: /^\/api\/zones$/, permission: "settings.manage" },
  { method: "POST", pattern: /^\/api\/zones$/, permission: "settings.manage" },
  { method: "PATCH", pattern: /^\/api\/zones\/[^/]+$/, permission: "settings.manage" },
  { method: "GET", pattern: /^\/api\/rooms\/master$/, permission: "settings.manage" },
  { method: "POST", pattern: /^\/api\/rooms$/, permission: "resource.manage" },
  { method: "PATCH", pattern: /^\/api\/rooms\/[^/]+$/, permission: "resource.manage" },
  { method: "GET", pattern: /^\/api\/rooms$/, permission: "resource.read" },
  { method: "GET", pattern: /^\/api\/roles$/, permission: {
    anyOf: ["authorization.manage", "employee.manage"],
  } },
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
  { method: "GET", pattern: /^\/api\/system\/audit-logs$/, permission: "audit.read" },
  { method: "GET", pattern: /^\/api\/hr\/employees$/, permission: "hr.employee.view" },
  { method: "POST", pattern: /^\/api\/hr\/employees$/, permission: "hr.employee.create" },
  { method: "GET", pattern: /^\/api\/hr\/employees\/[^/]+$/, permission: "hr.employee.view" },
  { method: "PATCH", pattern: /^\/api\/hr\/employees\/[^/]+$/, permission: "hr.employee.update" },
  { method: "GET", pattern: /^\/api\/hr\/shift-templates$/, permission: "hr.schedule.manage" },
  { method: "POST", pattern: /^\/api\/hr\/shift-templates$/, permission: "hr.schedule.manage" },
  { method: "PATCH", pattern: /^\/api\/hr\/shift-templates\/[^/]+$/, permission: "hr.schedule.manage" },
  { method: "DELETE", pattern: /^\/api\/hr\/shift-templates\/[^/]+$/, permission: "hr.schedule.manage" },
  { method: "GET", pattern: /^\/api\/hr\/shift-templates\/[^/]+\/members$/, permission: "hr.schedule.manage" },
  { method: "POST", pattern: /^\/api\/hr\/shift-templates\/[^/]+\/members$/, permission: "hr.schedule.manage" },
  {
    method: "DELETE",
    pattern: /^\/api\/hr\/shift-templates\/[^/]+\/members\/[^/]+$/,
    permission: "hr.schedule.manage",
  },
  { method: "GET", pattern: /^\/api\/hr\/schedules$/, permission: "hr.schedule.manage" },
  { method: "POST", pattern: /^\/api\/hr\/schedules$/, permission: "hr.schedule.manage" },
  { method: "GET", pattern: /^\/api\/hr\/schedule-periods$/, permission: "hr.schedule.manage" },
  { method: "POST", pattern: /^\/api\/hr\/schedule-periods$/, permission: "hr.schedule.manage" },
  { method: "GET", pattern: /^\/api\/hr\/schedule-periods\/[^/]+$/, permission: "hr.schedule.manage" },
  { method: "PATCH", pattern: /^\/api\/hr\/schedule-periods\/[^/]+$/, permission: "hr.schedule.manage" },
  { method: "POST", pattern: /^\/api\/hr\/schedule-periods\/[^/]+\/generate-from-defaults$/, permission: "hr.schedule.manage" },
  { method: "POST", pattern: /^\/api\/hr\/schedule-periods\/[^/]+\/bulk-assign$/, permission: "hr.schedule.manage" },
  { method: "POST", pattern: /^\/api\/hr\/schedule-periods\/[^/]+\/clear-row$/, permission: "hr.schedule.manage" },
  { method: "POST", pattern: /^\/api\/hr\/schedule-periods\/[^/]+\/copy-row$/, permission: "hr.schedule.manage" },
  { method: "GET", pattern: /^\/api\/hr\/schedule-periods\/[^/]+\/change-logs$/, permission: "hr.schedule.manage" },
  { method: "POST", pattern: /^\/api\/hr\/schedule-periods\/[^/]+\/copy-from\/[^/]+$/, permission: "hr.schedule.manage" },
  { method: "GET", pattern: /^\/api\/hr\/schedule-periods\/[^/]+\/shifts$/, permission: "hr.schedule.manage" },
  { method: "POST", pattern: /^\/api\/hr\/schedule-periods\/[^/]+\/shifts$/, permission: "hr.schedule.manage" },
  { method: "PATCH", pattern: /^\/api\/hr\/schedule-periods\/[^/]+\/shifts\/[^/]+$/, permission: "hr.schedule.manage" },
  { method: "DELETE", pattern: /^\/api\/hr\/schedule-periods\/[^/]+\/shifts\/[^/]+$/, permission: "hr.schedule.manage" },
  { method: "POST", pattern: /^\/api\/hr\/schedule-periods\/[^/]+\/shifts\/[^/]+\/replace$/, permission: "hr.schedule.manage" },
  { method: "GET", pattern: /^\/api\/hr\/holidays$/, permission: "hr.schedule.manage" },
  { method: "POST", pattern: /^\/api\/hr\/holidays$/, permission: "hr.schedule.manage" },
  { method: "GET", pattern: /^\/api\/hr\/attendance$/, permission: "hr.attendance.manage" },
  { method: "POST", pattern: /^\/api\/hr\/attendance$/, permission: "hr.attendance.manage" },
  { method: "GET", pattern: /^\/api\/hr\/leave-types$/, permission: "hr.leave.request" },
  { method: "POST", pattern: /^\/api\/hr\/leave-types$/, permission: "hr.settings.manage" },
  { method: "PATCH", pattern: /^\/api\/hr\/leave-types\/[^/]+$/, permission: "hr.settings.manage" },
  { method: "GET", pattern: /^\/api\/hr\/leave-balances$/, permission: "hr.leave.request" },
  { method: "POST", pattern: /^\/api\/hr\/leave-balances$/, permission: "hr.settings.manage" },
  { method: "GET", pattern: /^\/api\/hr\/leave-requests$/, permission: "hr.leave.request" },
  { method: "POST", pattern: /^\/api\/hr\/leave-requests$/, permission: "hr.leave.request" },
  { method: "GET", pattern: /^\/api\/hr\/compensations$/, permission: "hr.compensation.view" },
  { method: "POST", pattern: /^\/api\/hr\/compensations$/, permission: "hr.payroll.calculate" },
  { method: "GET", pattern: /^\/api\/hr\/payroll\/settings$/, permission: "hr.compensation.view" },
  { method: "POST", pattern: /^\/api\/hr\/payroll\/settings$/, permission: "hr.settings.manage" },
  { method: "GET", pattern: /^\/api\/hr\/payroll\/periods$/, permission: "hr.compensation.view" },
  { method: "POST", pattern: /^\/api\/hr\/payroll\/periods$/, permission: "hr.payroll.calculate" },
  { method: "GET", pattern: /^\/api\/hr\/payroll\/periods\/[^/]+\/export$/, permission: "hr.compensation.view" },
  { method: "GET", pattern: /^\/api\/hr\/documents$/, permission: "hr.document.manage" },
  { method: "POST", pattern: /^\/api\/hr\/documents$/, permission: "hr.document.manage" },
  { method: "DELETE", pattern: /^\/api\/hr\/documents$/, permission: "hr.document.manage" },
  { method: "GET", pattern: /^\/api\/hr\/documents\/[^/]+\/download$/, permission: "hr.document.manage" },
  { method: "GET", pattern: /^\/api\/hr\/dashboard$/, permission: "hr.employee.view" },
  { method: "GET", pattern: /^\/api\/hr\/reports$/, permission: "hr.report.view" },
  { method: "GET", pattern: /^\/api\/hr\/my-work$/, permission: "hr.attendance.self" },
  { method: "POST", pattern: /^\/api\/hr\/my-work\/clock$/, permission: "hr.attendance.self" },
  { method: "POST", pattern: /^\/api\/hr\/my-work\/ot-request$/, permission: "hr.attendance.self" },
  { method: "POST", pattern: /^\/api\/hr\/my-work\/leave$/, permission: "hr.leave.self" },
  { method: "GET", pattern: /^\/api\/hr\/attendance-settings$/, permission: {
    anyOf: ["hr.attendance.manage", "hr.settings.manage"],
  } },
  { method: "PATCH", pattern: /^\/api\/hr\/attendance-settings$/, permission: "hr.settings.manage" },
  { method: "GET", pattern: /^\/api\/hr\/time-pay\/summary$/, permission: {
    anyOf: ["hr.payroll_summary.view", "hr.attendance.manage"],
  } },
  { method: "GET", pattern: /^\/api\/pos\/categories$/, permission: "pos.product.view" },
  { method: "POST", pattern: /^\/api\/pos\/categories$/, permission: "pos.product.manage" },
  { method: "PATCH", pattern: /^\/api\/pos\/categories\/[^/]+$/, permission: "pos.product.manage" },
  { method: "DELETE", pattern: /^\/api\/pos\/categories\/[^/]+$/, permission: "pos.product.manage" },
  { method: "GET", pattern: /^\/api\/pos\/products$/, permission: "pos.product.view" },
  { method: "POST", pattern: /^\/api\/pos\/products$/, permission: "pos.product.manage" },
  { method: "PATCH", pattern: /^\/api\/pos\/products\/[^/]+$/, permission: "pos.product.manage" },
  { method: "DELETE", pattern: /^\/api\/pos\/products\/[^/]+$/, permission: "pos.product.manage" },
  { method: "POST", pattern: /^\/api\/pos\/images$/, permission: "pos.product.manage" },
  { method: "GET", pattern: /^\/api\/pos\/stock\/ledger$/, permission: "pos.stock.view" },
  { method: "POST", pattern: /^\/api\/pos\/stock\/receive$/, permission: "pos.stock.receive" },
  { method: "POST", pattern: /^\/api\/pos\/stock\/adjust$/, permission: "pos.stock.adjust" },
  { method: "POST", pattern: /^\/api\/pos\/stock\/count$/, permission: "pos.stock.count" },
  { method: "GET", pattern: /^\/api\/pos\/shifts$/, permission: "pos.shift.open" },
  { method: "POST", pattern: /^\/api\/pos\/shifts$/, permission: "pos.shift.open" },
  { method: "GET", pattern: /^\/api\/pos\/shifts\/current$/, permission: "pos.view" },
  { method: "POST", pattern: /^\/api\/pos\/shifts\/[^/]+\/close$/, permission: "pos.shift.close" },
  { method: "POST", pattern: /^\/api\/pos\/shifts\/[^/]+\/approve$/, permission: "pos.shift.approve" },
  { method: "POST", pattern: /^\/api\/pos\/shifts\/[^/]+\/cash$/, permission: "pos.shift.close" },
  { method: "GET", pattern: /^\/api\/pos\/sales$/, permission: "pos.view" },
  { method: "POST", pattern: /^\/api\/pos\/sales$/, permission: "pos.sell" },
  { method: "GET", pattern: /^\/api\/pos\/sales\/[^/]+$/, permission: "pos.view" },
  { method: "POST", pattern: /^\/api\/pos\/sales\/[^/]+\/cancel$/, permission: "pos.cancel" },
  { method: "POST", pattern: /^\/api\/pos\/sales\/[^/]+\/refund$/, permission: "pos.refund" },
  { method: "GET", pattern: /^\/api\/pos\/holds$/, permission: "pos.hold" },
  { method: "POST", pattern: /^\/api\/pos\/holds$/, permission: "pos.hold" },
  { method: "GET", pattern: /^\/api\/pos\/holds\/[^/]+$/, permission: "pos.hold" },
  { method: "PATCH", pattern: /^\/api\/pos\/holds\/[^/]+$/, permission: "pos.hold" },
  { method: "GET", pattern: /^\/api\/pos\/settings$/, permission: "pos.view" },
  { method: "PATCH", pattern: /^\/api\/pos\/settings$/, permission: "pos.settings.manage" },
  { method: "GET", pattern: /^\/api\/pos\/reports$/, permission: "pos.report.view" },
  { method: "GET", pattern: /^\/api\/pos\/accounting$/, permission: "pos.accounting.post" },
  { method: "GET", pattern: /^\/api\/pos\/bookings\/search$/, permission: "pos.sell" },
  { method: "GET", pattern: /^\/api\/pos\/promptpay-accounts$/, permission: "pos.sell" },
  { method: "POST", pattern: /^\/api\/pos\/promptpay-qr$/, permission: "pos.sell" },
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

export function employeeHasApiPermission(
  permissionCodes: readonly string[] | null | undefined,
  required: ApiPermissionRequirement,
): boolean {
  const codes = permissionCodes ?? [];
  if (required === "identity") return true;
  if (typeof required === "object" && "anyOf" in required) {
    return required.anyOf.some((code) => codes.includes(code));
  }
  return codes.includes(required);
}

export function resolveApiPermission(
  method: string,
  pathname: string,
): ApiPermissionRequirement | null {
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
