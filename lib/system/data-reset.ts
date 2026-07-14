/**
 * Destructive data wipe for operational / master / supermarket datasets.
 * Roles / permissions are never wiped.
 * Employees may be wiped when explicitly selected, but protected support
 * accounts and the acting employee (when provided) always survive.
 */
import type { Prisma } from "@/generated/prisma/client";

import { getProtectedSupportEmails } from "@/lib/auth/support-account";
import { POS_SKU_PREFIX } from "@/lib/pos/sequences";

export const DATA_RESET_CONFIRM_PHRASE = "ล้างข้อมูล";

export const serviceResetTargets = [
  "bookings",
  "guests",
  "tourGroups",
  "workShifts",
  "hrWorkData",
  "employees",
  "auditLogs",
] as const;

export const masterResetTargets = [
  "products",
  "foodCategories",
  "productTypes",
  "inspectionCatalog",
  "paymentChannels",
  "rooms",
  "roomTypes",
  "zones",
  "rafts",
] as const;

export const supermarketResetTargets = [
  "posSales",
  "posProducts",
  "posCategories",
] as const;

export type ServiceResetTarget = (typeof serviceResetTargets)[number];
export type MasterResetTarget = (typeof masterResetTargets)[number];
export type SupermarketResetTarget = (typeof supermarketResetTargets)[number];
export type DataResetCategory = "service" | "master" | "supermarket";
export type DataResetTarget =
  | ServiceResetTarget
  | MasterResetTarget
  | SupermarketResetTarget;

export const serviceResetTargetLabels: Record<ServiceResetTarget, string> = {
  bookings: "การจอง / การรับบริการ (รวมชำระเงิน ออเดอร์ ตรวจห้อง)",
  guests: "ลูกค้า",
  tourGroups: "กรุ๊ปทัวร์",
  workShifts: "ตารางเวรพนักงาน (ระบบเดิม)",
  hrWorkData:
    "ข้อมูลการทำงาน HR (ลงเวลา ขาด ลา มาสาย OT กะที่มอบหมาย — ไม่ลบพนักงาน/หมุด/ประเภทลา)",
  employees:
    "พนักงาน HR (โปรไฟล์และบัญชี — คงบัญชี support และผู้ทำรายการ)",
  auditLogs: "บันทึกตรวจสอบระบบ (ลบได้เฉพาะจากหน้านี้)",
};

export const masterResetTargetLabels: Record<MasterResetTarget, string> = {
  products: "สินค้า / เมนู",
  foodCategories: "หมวดอาหาร",
  productTypes: "ประเภทสินค้า",
  inspectionCatalog: "ราคากลางตรวจห้อง",
  paymentChannels: "ช่องทางรับชำระ",
  rooms: "ห้องพัก",
  roomTypes: "ประเภทห้อง",
  zones: "โซน",
  rafts: "แพ",
};

export const supermarketResetTargetLabels: Record<
  SupermarketResetTarget,
  string
> = {
  posSales: "ข้อมูลขาย (บิลขาย กะ พักบิล บัญชี POS)",
  posProducts: "ข้อมูลสินค้า (รวมสต๊อก)",
  posCategories: "หมวดหมู่สินค้า",
};

export type DataResetCounts = Record<DataResetTarget, number>;

export type DataResetResult = {
  category: DataResetCategory;
  targets: DataResetTarget[];
  deleted: Partial<Record<DataResetTarget, number>>;
  /** Auth user ids left after employee rows are removed — cleaned outside the DB transaction. */
  orphanAuthUserIds: string[];
};

export type DataResetExecuteOptions = {
  /** Always keep these employee ids (typically the actor performing the wipe). */
  preserveEmployeeIds?: string[];
};

export class DataResetDependencyError extends Error {
  readonly code = "DEPENDENCY_BLOCKED" as const;

  constructor(message: string) {
    super(message);
    this.name = "DataResetDependencyError";
  }
}

export class DataResetSafetyError extends Error {
  readonly code = "EMPLOYEE_RESET_UNSAFE" as const;

  constructor(message: string) {
    super(message);
    this.name = "DataResetSafetyError";
  }
}

function isServiceTarget(value: string): value is ServiceResetTarget {
  return (serviceResetTargets as readonly string[]).includes(value);
}

function isMasterTarget(value: string): value is MasterResetTarget {
  return (masterResetTargets as readonly string[]).includes(value);
}

function isSupermarketTarget(value: string): value is SupermarketResetTarget {
  return (supermarketResetTargets as readonly string[]).includes(value);
}

function allowedTargetsForCategory(category: DataResetCategory) {
  if (category === "service") return serviceResetTargets;
  if (category === "master") return masterResetTargets;
  return supermarketResetTargets;
}

export function resolveDataResetTargets(
  category: DataResetCategory,
  targets: "all" | string[],
): { ok: true; targets: DataResetTarget[] } | { ok: false; message: string } {
  const allowed = allowedTargetsForCategory(category);

  if (targets === "all") {
    return { ok: true, targets: [...allowed] };
  }

  if (!Array.isArray(targets) || targets.length === 0) {
    return { ok: false, message: "กรุณาเลือกรายการที่ต้องการลบ" };
  }

  const unique = [...new Set(targets)];
  for (const target of unique) {
    if (category === "service" && !isServiceTarget(target)) {
      return { ok: false, message: `รายการไม่ถูกต้อง: ${target}` };
    }
    if (category === "master" && !isMasterTarget(target)) {
      return { ok: false, message: `รายการไม่ถูกต้อง: ${target}` };
    }
    if (category === "supermarket" && !isSupermarketTarget(target)) {
      return { ok: false, message: `รายการไม่ถูกต้อง: ${target}` };
    }
  }

  return { ok: true, targets: unique as DataResetTarget[] };
}

async function resolvePreservedEmployeeIds(
  tx: Prisma.TransactionClient | typeof import("@/lib/prisma").prisma,
  preserveEmployeeIds: string[] = [],
): Promise<string[]> {
  const protectedEmails = getProtectedSupportEmails();
  const emailClauses: Prisma.EmployeeWhereInput[] = protectedEmails.map(
    (email) => ({
      email: { equals: email, mode: "insensitive" },
    }),
  );

  const preserved = await tx.employee.findMany({
    where: {
      OR: [
        ...(emailClauses.length > 0 ? emailClauses : []),
        ...(preserveEmployeeIds.length > 0
          ? [{ id: { in: preserveEmployeeIds } }]
          : []),
      ],
    },
    select: { id: true },
  });

  return [...new Set(preserved.map((row) => row.id))];
}

async function countWipeableEmployees(
  tx: Prisma.TransactionClient | typeof import("@/lib/prisma").prisma,
  preserveEmployeeIds: string[] = [],
): Promise<number> {
  const keepIds = await resolvePreservedEmployeeIds(tx, preserveEmployeeIds);
  if (keepIds.length === 0) {
    return tx.employee.count();
  }
  return tx.employee.count({ where: { id: { notIn: keepIds } } });
}

async function countHrWorkData(
  tx: Prisma.TransactionClient | typeof import("@/lib/prisma").prisma,
): Promise<number> {
  const [
    attendanceAdjustments,
    attendanceEvents,
    attendanceRecords,
    attendancePeriods,
    leaveRequests,
    leaveBalances,
    workSchedules,
    workShifts,
  ] = await Promise.all([
    tx.attendanceAdjustment.count(),
    tx.attendanceEvent.count(),
    tx.attendanceRecord.count(),
    tx.attendancePeriod.count(),
    tx.leaveRequest.count(),
    tx.leaveBalance.count(),
    tx.workSchedule.count(),
    tx.workShift.count(),
  ]);

  return (
    attendanceAdjustments +
    attendanceEvents +
    attendanceRecords +
    attendancePeriods +
    leaveRequests +
    leaveBalances +
    workSchedules +
    workShifts
  );
}

export async function countDataResetTargets(
  tx: Prisma.TransactionClient | typeof import("@/lib/prisma").prisma,
): Promise<DataResetCounts> {
  const [
    bookings,
    guests,
    tourGroups,
    workShifts,
    hrWorkData,
    employees,
    auditLogs,
    products,
    foodCategories,
    productTypes,
    inspectionCatalog,
    paymentChannels,
    rooms,
    roomTypes,
    zones,
    rafts,
    posSales,
    posProducts,
    posCategories,
  ] = await Promise.all([
    tx.booking.count(),
    tx.guest.count(),
    tx.tourGroup.count(),
    tx.workShift.count(),
    countHrWorkData(tx),
    countWipeableEmployees(tx),
    tx.auditLog.count(),
    tx.product.count(),
    tx.foodCategory.count(),
    tx.productType.count(),
    tx.inspectionCatalog.count(),
    tx.paymentChannel.count(),
    tx.room.count(),
    tx.roomType.count(),
    tx.zone.count(),
    tx.raft.count(),
    tx.posSale.count(),
    tx.posProduct.count(),
    tx.posCategory.count(),
  ]);

  return {
    bookings,
    guests,
    tourGroups,
    workShifts,
    hrWorkData,
    employees,
    auditLogs,
    products,
    foodCategories,
    productTypes,
    inspectionCatalog,
    paymentChannels,
    rooms,
    roomTypes,
    zones,
    rafts,
    posSales,
    posProducts,
    posCategories,
  };
}

async function deleteHrWorkDataTarget(
  tx: Prisma.TransactionClient,
): Promise<number> {
  // Dependency-safe order: adjustments/events → records → leave → schedules/legacy shifts
  const adjustments = await tx.attendanceAdjustment.deleteMany({});
  const events = await tx.attendanceEvent.deleteMany({});
  const records = await tx.attendanceRecord.deleteMany({});
  const leaveRequests = await tx.leaveRequest.deleteMany({});
  const leaveBalances = await tx.leaveBalance.deleteMany({});
  const periods = await tx.attendancePeriod.deleteMany({});
  const schedules = await tx.workSchedule.deleteMany({});
  const legacyShifts = await tx.workShift.deleteMany({});

  return (
    adjustments.count +
    events.count +
    records.count +
    leaveRequests.count +
    leaveBalances.count +
    periods.count +
    schedules.count +
    legacyShifts.count
  );
}

async function assertEmployeesAreDeletable(
  tx: Prisma.TransactionClient,
  employeeIds: string[],
) {
  if (employeeIds.length === 0) return;

  const blockers: string[] = [];

  const posSaleRefs = await tx.posSale.count({
    where: {
      OR: [
        { soldById: { in: employeeIds } },
        { voidedById: { in: employeeIds } },
      ],
    },
  });
  if (posSaleRefs > 0) blockers.push("บิลขาย POS");

  const posShiftRefs = await tx.posShift.count({
    where: {
      OR: [
        { openedById: { in: employeeIds } },
        { closedById: { in: employeeIds } },
        { approvedById: { in: employeeIds } },
      ],
    },
  });
  if (posShiftRefs > 0) blockers.push("กะ POS");

  const posHoldRefs = await tx.posHold.count({
    where: { heldById: { in: employeeIds } },
  });
  if (posHoldRefs > 0) blockers.push("พักบิล POS");

  const posRefundRefs = await tx.posRefund.count({
    where: { actorEmployeeId: { in: employeeIds } },
  });
  if (posRefundRefs > 0) blockers.push("คืนเงิน POS");

  const posCashRefs = await tx.posCashMovement.count({
    where: { actorEmployeeId: { in: employeeIds } },
  });
  if (posCashRefs > 0) blockers.push("เคลื่อนไหวเงินสด POS");

  const posStockMoveRefs = await tx.posStockMovement.count({
    where: { actorEmployeeId: { in: employeeIds } },
  });
  if (posStockMoveRefs > 0) blockers.push("เคลื่อนไหวสต๊อก POS");

  const posStockCountRefs = await tx.posStockCount.count({
    where: { actorEmployeeId: { in: employeeIds } },
  });
  if (posStockCountRefs > 0) blockers.push("นับสต๊อก POS");

  if (blockers.length > 0) {
    throw new DataResetDependencyError(
      `ลบพนักงานไม่ได้เพราะยังมีข้อมูลที่อ้างอิง: ${blockers.join(", ")} — ล้างข้อมูลขายซูเปอร์มาร์เก็ตก่อน`,
    );
  }
}

async function deleteEmployeesTarget(
  tx: Prisma.TransactionClient,
  preserveEmployeeIds: string[],
): Promise<{ deleted: number; orphanAuthUserIds: string[] }> {
  const keepIds = await resolvePreservedEmployeeIds(tx, preserveEmployeeIds);
  if (keepIds.length === 0) {
    throw new DataResetSafetyError(
      "ล้างพนักงานไม่ได้ — ต้องมีบัญชี support ของระบบอย่างน้อย 1 คนในฐานข้อมูลก่อน",
    );
  }

  const victims = await tx.employee.findMany({
    where: { id: { notIn: keepIds } },
    select: { id: true, authUserId: true },
  });
  if (victims.length === 0) {
    return { deleted: 0, orphanAuthUserIds: [] };
  }

  const victimIds = victims.map((row) => row.id);
  await assertEmployeesAreDeletable(tx, victimIds);

  // Break self-manager links among victims / into victims.
  await tx.employee.updateMany({
    where: { managerEmployeeId: { in: victimIds } },
    data: { managerEmployeeId: null },
  });

  // Clear SetNull actor references in operational tables still holding those ids.
  await tx.roomInspection.updateMany({
    where: { completedById: { in: victimIds } },
    data: { completedById: null },
  });
  await tx.payment.updateMany({
    where: { createdById: { in: victimIds } },
    data: { createdById: null },
  });
  await tx.payment.updateMany({
    where: { verifiedById: { in: victimIds } },
    data: { verifiedById: null },
  });
  await tx.paymentStatusHistory.updateMany({
    where: { actorId: { in: victimIds } },
    data: { actorId: null },
  });
  await tx.paymentRefund.updateMany({
    where: { createdById: { in: victimIds } },
    data: { createdById: null },
  });
  await tx.promptPayAccount.updateMany({
    where: { createdById: { in: victimIds } },
    data: { createdById: null },
  });
  await tx.promptPayAccount.updateMany({
    where: { updatedById: { in: victimIds } },
    data: { updatedById: null },
  });
  await tx.auditLog.updateMany({
    where: { actorEmployeeId: { in: victimIds } },
    data: { actorEmployeeId: null },
  });
  await tx.attendancePeriod.updateMany({
    where: { lockedById: { in: victimIds } },
    data: { lockedById: null },
  });
  await tx.attendanceAdjustment.updateMany({
    where: { reviewedById: { in: victimIds } },
    data: { reviewedById: null },
  });
  await tx.leaveRequest.updateMany({
    where: { reviewedById: { in: victimIds } },
    data: { reviewedById: null },
  });
  await tx.payrollPeriod.updateMany({
    where: { calculatedById: { in: victimIds } },
    data: { calculatedById: null },
  });
  await tx.payrollPeriod.updateMany({
    where: { reviewedById: { in: victimIds } },
    data: { reviewedById: null },
  });
  await tx.payrollPeriod.updateMany({
    where: { approvedById: { in: victimIds } },
    data: { approvedById: null },
  });
  await tx.payrollPeriod.updateMany({
    where: { paidById: { in: victimIds } },
    data: { paidById: null },
  });

  const deleted = await tx.employee.deleteMany({
    where: { id: { in: victimIds } },
  });

  const orphanAuthUserIds = [
    ...new Set(
      victims
        .map((row) => row.authUserId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];

  return { deleted: deleted.count, orphanAuthUserIds };
}

async function deleteServiceTarget(
  tx: Prisma.TransactionClient,
  target: ServiceResetTarget,
  options: DataResetExecuteOptions,
): Promise<{ deleted: number; orphanAuthUserIds: string[] }> {
  switch (target) {
    case "bookings": {
      await tx.payment.deleteMany({});
      await tx.orderItem.deleteMany({});
      await tx.order.deleteMany({});
      const bookingCount = await tx.booking.deleteMany({});
      await tx.room.updateMany({ data: { status: "AVAILABLE" } });
      await tx.raft.updateMany({ data: { status: "AVAILABLE" } });
      return { deleted: bookingCount.count, orphanAuthUserIds: [] };
    }
    case "guests":
      return {
        deleted: (await tx.guest.deleteMany({})).count,
        orphanAuthUserIds: [],
      };
    case "tourGroups":
      return {
        deleted: (await tx.tourGroup.deleteMany({})).count,
        orphanAuthUserIds: [],
      };
    case "workShifts":
      return {
        deleted: (await tx.workShift.deleteMany({})).count,
        orphanAuthUserIds: [],
      };
    case "hrWorkData":
      return {
        deleted: await deleteHrWorkDataTarget(tx),
        orphanAuthUserIds: [],
      };
    case "employees":
      return deleteEmployeesTarget(tx, options.preserveEmployeeIds ?? []);
    case "auditLogs": {
      await tx.$executeRaw`SELECT set_config('app.allow_audit_purge', 'on', true)`;
      return {
        deleted: (await tx.auditLog.deleteMany({})).count,
        orphanAuthUserIds: [],
      };
    }
  }
}

async function deleteMasterTarget(
  tx: Prisma.TransactionClient,
  target: MasterResetTarget,
): Promise<number> {
  switch (target) {
    case "products":
      return (await tx.product.deleteMany({})).count;
    case "foodCategories":
      return (await tx.foodCategory.deleteMany({})).count;
    case "productTypes":
      return (await tx.productType.deleteMany({})).count;
    case "inspectionCatalog":
      return (await tx.inspectionCatalog.deleteMany({})).count;
    case "paymentChannels":
      return (await tx.paymentChannel.deleteMany({})).count;
    case "rooms":
      return (await tx.room.deleteMany({})).count;
    case "roomTypes":
      return (await tx.roomType.deleteMany({})).count;
    case "zones":
      return (await tx.zone.deleteMany({})).count;
    case "rafts":
      return (await tx.raft.deleteMany({})).count;
  }
}

async function deleteSupermarketTarget(
  tx: Prisma.TransactionClient,
  target: SupermarketResetTarget,
): Promise<number> {
  switch (target) {
    case "posSales": {
      await tx.charge.deleteMany({ where: { sourceType: "POS_SALE" } });
      await tx.posRefundItem.deleteMany({});
      await tx.posRefund.deleteMany({});
      await tx.posAccountingEntry.deleteMany({});
      await tx.posPayment.deleteMany({});
      await tx.posSaleItem.deleteMany({});
      const sales = await tx.posSale.deleteMany({});
      await tx.posHoldItem.deleteMany({});
      await tx.posHold.deleteMany({});
      await tx.posCashMovement.deleteMany({});
      await tx.posShift.deleteMany({});
      await tx.posReceiptSequence.deleteMany({
        where: { prefix: { not: POS_SKU_PREFIX } },
      });
      return sales.count;
    }
    case "posProducts": {
      await tx.posStockCountItem.deleteMany({});
      await tx.posStockCount.deleteMany({});
      await tx.posStockMovement.deleteMany({});
      const products = await tx.posProduct.deleteMany({});
      await tx.posReceiptSequence.deleteMany({
        where: { prefix: POS_SKU_PREFIX },
      });
      return products.count;
    }
    case "posCategories":
      return (await tx.posCategory.deleteMany({})).count;
  }
}

/** Dependency-safe order within each category */
const serviceDeleteOrder: ServiceResetTarget[] = [
  "bookings",
  "guests",
  "tourGroups",
  "workShifts",
  "hrWorkData",
  "employees",
  "auditLogs",
];

const masterDeleteOrder: MasterResetTarget[] = [
  "products",
  "foodCategories",
  "productTypes",
  "inspectionCatalog",
  "paymentChannels",
  "rooms",
  "roomTypes",
  "zones",
  "rafts",
];

const supermarketDeleteOrder: SupermarketResetTarget[] = [
  "posSales",
  "posProducts",
  "posCategories",
];

export function orderDataResetTargets(
  category: DataResetCategory,
  targets: DataResetTarget[],
): DataResetTarget[] {
  const order =
    category === "service"
      ? serviceDeleteOrder
      : category === "master"
        ? masterDeleteOrder
        : supermarketDeleteOrder;
  const selected = new Set(targets);
  return order.filter((target) => selected.has(target));
}

export async function executeDataReset(
  tx: Prisma.TransactionClient,
  category: DataResetCategory,
  targets: DataResetTarget[],
  options: DataResetExecuteOptions = {},
): Promise<DataResetResult> {
  const ordered = orderDataResetTargets(category, targets);
  const deleted: Partial<Record<DataResetTarget, number>> = {};
  const orphanAuthUserIds: string[] = [];

  for (const target of ordered) {
    if (category === "service") {
      const result = await deleteServiceTarget(
        tx,
        target as ServiceResetTarget,
        options,
      );
      deleted[target] = result.deleted;
      orphanAuthUserIds.push(...result.orphanAuthUserIds);
    } else if (category === "master") {
      deleted[target] = await deleteMasterTarget(
        tx,
        target as MasterResetTarget,
      );
    } else {
      deleted[target] = await deleteSupermarketTarget(
        tx,
        target as SupermarketResetTarget,
      );
    }
  }

  return {
    category,
    targets: ordered,
    deleted,
    orphanAuthUserIds: [...new Set(orphanAuthUserIds)],
  };
}

export function dataResetCategoryLabel(category: DataResetCategory): string {
  if (category === "service") return "การเข้ารับบริการ";
  if (category === "master") return "ข้อมูลหลัก";
  return "ซูเปอร์มาร์เก็ต";
}
