/**
 * Destructive data wipe for operational / HR / master / supermarket / system datasets.
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
] as const;

export const hrResetTargets = [
  "hrAttendance",
  "hrLeave",
  "hrSchedules",
  "hrPayroll",
  "hrDocuments",
  "hrShiftTemplates",
  "hrLeaveTypes",
  "hrHolidays",
  "hrPinSettings",
  "hrPayrollSettings",
  "employees",
  "hrOrg",
] as const;

export const masterResetTargets = [
  "products",
  "foodCategories",
  "productTypes",
  "inspectionCatalog",
  "paymentChannels",
  "promptPayAccounts",
  "rooms",
  "roomTypes",
  "zones",
  "rafts",
] as const;

export const supermarketResetTargets = [
  "posSales",
  "posProducts",
  "posCategories",
  "posSettings",
] as const;

export const systemResetTargets = ["auditLogs"] as const;

export type ServiceResetTarget = (typeof serviceResetTargets)[number];
export type HrResetTarget = (typeof hrResetTargets)[number];
export type MasterResetTarget = (typeof masterResetTargets)[number];
export type SupermarketResetTarget = (typeof supermarketResetTargets)[number];
export type SystemResetTarget = (typeof systemResetTargets)[number];
export type DataResetCategory =
  | "service"
  | "hr"
  | "master"
  | "supermarket"
  | "system";
export type DataResetTarget =
  | ServiceResetTarget
  | HrResetTarget
  | MasterResetTarget
  | SupermarketResetTarget
  | SystemResetTarget;

export const serviceResetTargetLabels: Record<ServiceResetTarget, string> = {
  bookings: "การจอง / การรับบริการ (รวมชำระเงิน ออเดอร์ ตรวจห้อง)",
  guests: "ลูกค้า",
  tourGroups: "กรุ๊ปทัวร์",
};

export const hrResetTargetLabels: Record<HrResetTarget, string> = {
  hrAttendance: "ลงเวลา / OT / มาสาย (รายการ เหตุการณ์ คำขอแก้ไข รอบล็อก)",
  hrLeave: "คำขอลาและยอดคงเหลือ",
  hrSchedules: "ตารางงาน (รอบกะ กะที่มอบหมาย ตารางเดิม เวรเดิม)",
  hrPayroll: "รอบจ่าย / สลิป / รายการปรับยอด",
  hrDocuments: "เอกสารพนักงาน",
  hrShiftTemplates: "แม่แบบกะและการจัดสมาชิกกะ",
  hrLeaveTypes: "ประเภทการลา",
  hrHolidays: "ปฏิทินวันหยุด",
  hrPinSettings: "หมุด GPS / รัศมีลงเวลา",
  hrPayrollSettings: "สูตรค่าจ้าง (ตั้งค่า payroll)",
  employees:
    "พนักงาน (โปรไฟล์และบัญชี — คง support/ผู้ทำรายการ; จะล้างกะ/บิล POS ที่อ้างอิงด้วย)",
  hrOrg: "แผนกและตำแหน่ง",
};

export const masterResetTargetLabels: Record<MasterResetTarget, string> = {
  products: "สินค้า / เมนู",
  foodCategories: "หมวดอาหาร",
  productTypes: "ประเภทสินค้า",
  inspectionCatalog: "ราคากลางตรวจห้อง",
  paymentChannels: "ช่องทางรับชำระ",
  promptPayAccounts: "บัญชี PromptPay",
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
  posSettings: "ตั้งค่า POS",
};

export const systemResetTargetLabels: Record<SystemResetTarget, string> = {
  auditLogs: "บันทึกตรวจสอบระบบ (ลบได้เฉพาะจากหน้านี้)",
};

export type DataResetCounts = Record<DataResetTarget, number>;

export type DataResetFailure = {
  target: DataResetTarget;
  message: string;
};

export type DataResetResult = {
  category: DataResetCategory;
  targets: DataResetTarget[];
  deleted: Partial<Record<DataResetTarget, number>>;
  /** Targets that failed after earlier targets already committed (independent mode). */
  failed: DataResetFailure[];
  /** Auth user ids left after employee rows are removed — cleaned outside the DB transaction. */
  orphanAuthUserIds: string[];
};

type DataResetDb = {
  $transaction: <T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { timeout?: number; maxWait?: number },
  ) => Promise<T>;
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

function isHrTarget(value: string): value is HrResetTarget {
  return (hrResetTargets as readonly string[]).includes(value);
}

function isMasterTarget(value: string): value is MasterResetTarget {
  return (masterResetTargets as readonly string[]).includes(value);
}

function isSupermarketTarget(value: string): value is SupermarketResetTarget {
  return (supermarketResetTargets as readonly string[]).includes(value);
}

function isSystemTarget(value: string): value is SystemResetTarget {
  return (systemResetTargets as readonly string[]).includes(value);
}

function allowedTargetsForCategory(category: DataResetCategory) {
  if (category === "service") return serviceResetTargets;
  if (category === "hr") return hrResetTargets;
  if (category === "master") return masterResetTargets;
  if (category === "supermarket") return supermarketResetTargets;
  return systemResetTargets;
}

/**
 * Within a category, selecting a target may require wiping dependencies first.
 * This expands the selection so FK order can succeed.
 */
export function expandDataResetTargets(
  category: DataResetCategory,
  targets: DataResetTarget[],
): DataResetTarget[] {
  const selected = new Set(targets);

  if (category === "service") {
    if (selected.has("guests") || selected.has("tourGroups")) {
      selected.add("bookings");
    }
  }

  if (category === "hr") {
    if (selected.has("hrLeaveTypes")) selected.add("hrLeave");
    if (selected.has("hrShiftTemplates")) {
      selected.add("hrAttendance");
      selected.add("hrSchedules");
    }
    if (selected.has("employees")) {
      selected.add("hrAttendance");
      selected.add("hrLeave");
      selected.add("hrPayroll");
      selected.add("hrDocuments");
      selected.add("hrSchedules");
    }
    if (selected.has("hrOrg")) {
      // Org can SetNull on employees, but wipe employee-linked HR first if also wiping employees.
    }
  }

  if (category === "master") {
    if (selected.has("foodCategories") || selected.has("productTypes")) {
      selected.add("products");
    }
    if (
      selected.has("roomTypes") ||
      selected.has("zones") ||
      selected.has("rafts")
    ) {
      selected.add("rooms");
    }
  }

  if (category === "supermarket") {
    if (selected.has("posProducts") || selected.has("posCategories")) {
      selected.add("posSales");
    }
    if (selected.has("posCategories")) {
      selected.add("posProducts");
    }
  }

  return orderDataResetTargets(category, [...selected]);
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
    if (category === "hr" && !isHrTarget(target)) {
      return { ok: false, message: `รายการไม่ถูกต้อง: ${target}` };
    }
    if (category === "master" && !isMasterTarget(target)) {
      return { ok: false, message: `รายการไม่ถูกต้อง: ${target}` };
    }
    if (category === "supermarket" && !isSupermarketTarget(target)) {
      return { ok: false, message: `รายการไม่ถูกต้อง: ${target}` };
    }
    if (category === "system" && !isSystemTarget(target)) {
      return { ok: false, message: `รายการไม่ถูกต้อง: ${target}` };
    }
  }

  return {
    ok: true,
    targets: expandDataResetTargets(category, unique as DataResetTarget[]),
  };
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

async function sumCounts(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0);
}

export async function countDataResetTargets(
  tx: Prisma.TransactionClient | typeof import("@/lib/prisma").prisma,
): Promise<DataResetCounts> {
  const [
    bookings,
    guests,
    tourGroups,
    hrAttendance,
    hrLeave,
    hrSchedules,
    hrPayroll,
    hrDocuments,
    hrShiftTemplates,
    hrLeaveTypes,
    hrHolidays,
    hrPinSettings,
    hrPayrollSettings,
    employees,
    hrOrg,
    products,
    foodCategories,
    productTypes,
    inspectionCatalog,
    paymentChannels,
    promptPayAccounts,
    rooms,
    roomTypes,
    zones,
    rafts,
    posSales,
    posProducts,
    posCategories,
    posSettings,
    auditLogs,
  ] = await Promise.all([
    tx.booking.count(),
    tx.guest.count(),
    tx.tourGroup.count(),
    sumCounts(
      await Promise.all([
        tx.attendanceAdjustment.count(),
        tx.attendanceEvent.count(),
        tx.attendanceRecord.count(),
        tx.attendancePeriod.count(),
      ]),
    ),
    sumCounts(
      await Promise.all([tx.leaveRequest.count(), tx.leaveBalance.count()]),
    ),
    sumCounts(
      await Promise.all([
        tx.scheduleChangeLog.count(),
        tx.scheduledShift.count(),
        tx.schedulePeriod.count(),
        tx.workSchedule.count(),
        tx.workShift.count(),
      ]),
    ),
    sumCounts(
      await Promise.all([
        tx.payrollPayslip.count(),
        tx.payrollAdjustment.count(),
        tx.payrollEntry.count(),
        tx.payrollPeriod.count(),
      ]),
    ),
    tx.employeeDocument.count(),
    tx.shiftTemplate.count(),
    tx.leaveType.count(),
    tx.holidayCalendar.count(),
    tx.hrAttendanceSetting.count(),
    tx.payrollSetting.count(),
    countWipeableEmployees(tx),
    sumCounts(
      await Promise.all([tx.position.count(), tx.department.count()]),
    ),
    tx.product.count(),
    tx.foodCategory.count(),
    tx.productType.count(),
    tx.inspectionCatalog.count(),
    tx.paymentChannel.count(),
    tx.promptPayAccount.count(),
    tx.room.count(),
    tx.roomType.count(),
    tx.zone.count(),
    tx.raft.count(),
    tx.posSale.count(),
    tx.posProduct.count(),
    tx.posCategory.count(),
    tx.posSetting.count(),
    tx.auditLog.count(),
  ]);

  return {
    bookings,
    guests,
    tourGroups,
    hrAttendance,
    hrLeave,
    hrSchedules,
    hrPayroll,
    hrDocuments,
    hrShiftTemplates,
    hrLeaveTypes,
    hrHolidays,
    hrPinSettings,
    hrPayrollSettings,
    employees,
    hrOrg,
    products,
    foodCategories,
    productTypes,
    inspectionCatalog,
    paymentChannels,
    promptPayAccounts,
    rooms,
    roomTypes,
    zones,
    rafts,
    posSales,
    posProducts,
    posCategories,
    posSettings,
    auditLogs,
  };
}

async function enableAuditPurge(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$executeRaw`SELECT set_config('app.allow_audit_purge', 'on', true)`;
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
      `ลบพนักงานไม่ได้เพราะยังมีข้อมูลที่อ้างอิง: ${blockers.join(", ")} — ไปหมวดซูเปอร์มาร์เก็ต ลบข้อมูลขายก่อน แล้วค่อยลบพนักงาน`,
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

  // POS employee FKs are Restrict — clear sales/shift graph as part of wipe
  await purgePosSalesGraph(tx);
  await purgePosProductDependents(tx);
  await assertEmployeesAreDeletable(tx, victimIds);

  // Audit logs block employee delete via ON DELETE SET NULL → UPDATE trigger
  await enableAuditPurge(tx);

  await tx.employee.updateMany({
    where: { managerEmployeeId: { in: victimIds } },
    data: { managerEmployeeId: null },
  });

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
  await tx.schedulePeriod.updateMany({
    where: { createdById: { in: victimIds } },
    data: { createdById: null },
  });
  await tx.schedulePeriod.updateMany({
    where: { updatedById: { in: victimIds } },
    data: { updatedById: null },
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

async function purgeBookingGraph(tx: Prisma.TransactionClient): Promise<number> {
  // PaymentRefund Restrict → Payment; Payment Restrict → Booking
  await tx.paymentRefund.deleteMany({});
  await tx.payment.deleteMany({});
  await tx.orderItem.deleteMany({});
  await tx.order.deleteMany({});
  // BookingRoom / Raft / Charge / Inspection cascade from Booking
  const bookingCount = await tx.booking.deleteMany({});
  await tx.room.updateMany({ data: { status: "AVAILABLE" } });
  await tx.raft.updateMany({ data: { status: "AVAILABLE" } });
  return bookingCount.count;
}

/** POS sale/shift graph that Restrict-locks pos products. */
async function purgePosSalesGraph(tx: Prisma.TransactionClient): Promise<number> {
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

/** Stock/count rows that Restrict-lock pos products (sales already wiped). */
async function purgePosProductDependents(
  tx: Prisma.TransactionClient,
): Promise<void> {
  await tx.posStockCountItem.deleteMany({});
  await tx.posStockCount.deleteMany({});
  await tx.posStockMovement.deleteMany({});
}

async function deleteServiceTarget(
  tx: Prisma.TransactionClient,
  target: ServiceResetTarget,
): Promise<number> {
  switch (target) {
    case "bookings":
      return purgeBookingGraph(tx);
    case "guests": {
      await tx.booking.updateMany({
        where: { guestId: { not: null } },
        data: { guestId: null },
      });
      return (await tx.guest.deleteMany({})).count;
    }
    case "tourGroups": {
      await tx.booking.updateMany({
        where: { tourGroupId: { not: null } },
        data: { tourGroupId: null },
      });
      return (await tx.tourGroup.deleteMany({})).count;
    }
  }
}

async function deleteHrTarget(
  tx: Prisma.TransactionClient,
  target: HrResetTarget,
  options: DataResetExecuteOptions,
): Promise<{ deleted: number; orphanAuthUserIds: string[] }> {
  switch (target) {
    case "hrAttendance": {
      const adjustments = await tx.attendanceAdjustment.deleteMany({});
      const events = await tx.attendanceEvent.deleteMany({});
      const records = await tx.attendanceRecord.deleteMany({});
      const periods = await tx.attendancePeriod.deleteMany({});
      return {
        deleted:
          adjustments.count + events.count + records.count + periods.count,
        orphanAuthUserIds: [],
      };
    }
    case "hrLeave": {
      const requests = await tx.leaveRequest.deleteMany({});
      const balances = await tx.leaveBalance.deleteMany({});
      return {
        deleted: requests.count + balances.count,
        orphanAuthUserIds: [],
      };
    }
    case "hrSchedules": {
      // Break self-FK on scheduled shifts before bulk delete
      await tx.scheduledShift.updateMany({
        data: {
          sourceScheduledShiftId: null,
          replacedEmployeeId: null,
        },
      });
      const logs = await tx.scheduleChangeLog.deleteMany({});
      const shifts = await tx.scheduledShift.deleteMany({});
      const periods = await tx.schedulePeriod.deleteMany({});
      // Clear attendance links that still point at schedules (if attendance not wiped)
      await tx.attendanceRecord.updateMany({
        where: {
          OR: [
            { workScheduleId: { not: null } },
            { scheduledShiftId: { not: null } },
          ],
        },
        data: { workScheduleId: null, scheduledShiftId: null },
      });
      const schedules = await tx.workSchedule.deleteMany({});
      const legacy = await tx.workShift.deleteMany({});
      return {
        deleted:
          logs.count +
          shifts.count +
          periods.count +
          schedules.count +
          legacy.count,
        orphanAuthUserIds: [],
      };
    }
    case "hrPayroll": {
      const payslips = await tx.payrollPayslip.deleteMany({});
      const adjustments = await tx.payrollAdjustment.deleteMany({});
      const entries = await tx.payrollEntry.deleteMany({});
      const periods = await tx.payrollPeriod.deleteMany({});
      return {
        deleted:
          payslips.count +
          adjustments.count +
          entries.count +
          periods.count,
        orphanAuthUserIds: [],
      };
    }
    case "hrDocuments":
      return {
        deleted: (await tx.employeeDocument.deleteMany({})).count,
        orphanAuthUserIds: [],
      };
    case "hrShiftTemplates": {
      await tx.employee.updateMany({
        where: { defaultShiftTemplateId: { not: null } },
        data: { defaultShiftTemplateId: null },
      });
      await tx.workSchedule.updateMany({
        where: { shiftTemplateId: { not: null } },
        data: { shiftTemplateId: null },
      });
      await tx.scheduledShift.updateMany({
        where: { shiftTemplateId: { not: null } },
        data: { shiftTemplateId: null },
      });
      // memberships + time periods cascade with template
      return {
        deleted: (await tx.shiftTemplate.deleteMany({})).count,
        orphanAuthUserIds: [],
      };
    }
    case "hrLeaveTypes": {
      // LeaveRequest Restrict on leaveType — wipe leave data first if still present
      await tx.leaveRequest.deleteMany({});
      await tx.leaveBalance.deleteMany({});
      return {
        deleted: (await tx.leaveType.deleteMany({})).count,
        orphanAuthUserIds: [],
      };
    }
    case "hrHolidays":
      return {
        deleted: (await tx.holidayCalendar.deleteMany({})).count,
        orphanAuthUserIds: [],
      };
    case "hrPinSettings":
      return {
        deleted: (await tx.hrAttendanceSetting.deleteMany({})).count,
        orphanAuthUserIds: [],
      };
    case "hrPayrollSettings":
      return {
        deleted: (await tx.payrollSetting.deleteMany({})).count,
        orphanAuthUserIds: [],
      };
    case "employees":
      return deleteEmployeesTarget(tx, options.preserveEmployeeIds ?? []);
    case "hrOrg": {
      await tx.employee.updateMany({
        where: {
          OR: [
            { departmentId: { not: null } },
            { positionId: { not: null } },
          ],
        },
        data: { departmentId: null, positionId: null },
      });
      const positions = await tx.position.deleteMany({});
      const departments = await tx.department.deleteMany({});
      return {
        deleted: positions.count + departments.count,
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
    case "products": {
      // OrderItem Restrict → Product (orders themselves may remain empty)
      // Food set lines also Restrict → Product
      await tx.orderItem.deleteMany({});
      await tx.tourGroupFoodSetItem.deleteMany({});
      await tx.tourGroupFoodSet.deleteMany({});
      await tx.foodSetItem.deleteMany({});
      await tx.foodSet.deleteMany({});
      await tx.productOption.deleteMany({});
      await tx.productOptionGroup.deleteMany({});
      return (await tx.product.deleteMany({})).count;
    }
    case "foodCategories": {
      await tx.product.updateMany({
        where: { categoryId: { not: null } },
        data: { categoryId: null },
      });
      return (await tx.foodCategory.deleteMany({})).count;
    }
    case "productTypes": {
      // Product.typeId required — products target usually ran first via expand
      await tx.orderItem.deleteMany({});
      await tx.tourGroupFoodSetItem.deleteMany({});
      await tx.tourGroupFoodSet.deleteMany({});
      await tx.foodSetItem.deleteMany({});
      await tx.foodSet.deleteMany({});
      await tx.productOption.deleteMany({});
      await tx.productOptionGroup.deleteMany({});
      await tx.product.deleteMany({});
      return (await tx.productType.deleteMany({})).count;
    }
    case "inspectionCatalog":
      return (await tx.inspectionCatalog.deleteMany({})).count;
    case "paymentChannels": {
      await tx.payment.updateMany({
        where: { channelId: { not: null } },
        data: { channelId: null },
      });
      return (await tx.paymentChannel.deleteMany({})).count;
    }
    case "promptPayAccounts": {
      // Payment.promptpayAccount Restrict
      await tx.payment.updateMany({
        where: { promptpayAccountId: { not: null } },
        data: { promptpayAccountId: null },
      });
      return (await tx.promptPayAccount.deleteMany({})).count;
    }
    case "rooms": {
      // BookingRoom.roomId required — clear bookings that lock rooms
      await purgeBookingGraph(tx);
      await tx.order.updateMany({
        where: { roomId: { not: null } },
        data: { roomId: null },
      });
      return (await tx.room.deleteMany({})).count;
    }
    case "roomTypes": {
      // rooms target (via expand) already purged bookings; avoid re-purging the graph
      await tx.order.updateMany({
        where: { roomId: { not: null } },
        data: { roomId: null },
      });
      await tx.room.deleteMany({});
      return (await tx.roomType.deleteMany({})).count;
    }
    case "zones": {
      await tx.order.updateMany({
        where: { roomId: { not: null } },
        data: { roomId: null },
      });
      await tx.room.deleteMany({});
      return (await tx.zone.deleteMany({})).count;
    }
    case "rafts": {
      // BookingRaft cascades from booking; rooms expand already cleared bookings
      return (await tx.raft.deleteMany({})).count;
    }
  }
}

async function deleteSupermarketTarget(
  tx: Prisma.TransactionClient,
  target: SupermarketResetTarget,
): Promise<number> {
  switch (target) {
    case "posSales":
      return purgePosSalesGraph(tx);
    case "posProducts": {
      // posSales is expanded first — only clear stock/product rows here
      await purgePosProductDependents(tx);
      const products = await tx.posProduct.deleteMany({});
      await tx.posReceiptSequence.deleteMany({
        where: { prefix: POS_SKU_PREFIX },
      });
      return products.count;
    }
    case "posCategories": {
      // posSales + posProducts expanded first — do not re-wipe the sales graph
      await purgePosProductDependents(tx);
      await tx.posProduct.deleteMany({});
      return (await tx.posCategory.deleteMany({})).count;
    }
    case "posSettings":
      return (await tx.posSetting.deleteMany({})).count;
  }
}

async function deleteSystemTarget(
  tx: Prisma.TransactionClient,
  target: SystemResetTarget,
): Promise<number> {
  switch (target) {
    case "auditLogs": {
      await enableAuditPurge(tx);
      return (await tx.auditLog.deleteMany({})).count;
    }
  }
}

/** Dependency-safe order within each category */
const serviceDeleteOrder: ServiceResetTarget[] = [
  "bookings",
  "guests",
  "tourGroups",
];

const hrDeleteOrder: HrResetTarget[] = [
  "hrAttendance",
  "hrLeave",
  "hrPayroll",
  "hrDocuments",
  "hrSchedules",
  "hrShiftTemplates",
  "hrLeaveTypes",
  "hrHolidays",
  "hrPinSettings",
  "hrPayrollSettings",
  "employees",
  "hrOrg",
];

const masterDeleteOrder: MasterResetTarget[] = [
  "products",
  "foodCategories",
  "productTypes",
  "inspectionCatalog",
  "paymentChannels",
  "promptPayAccounts",
  "rooms",
  "roomTypes",
  "zones",
  "rafts",
];

const supermarketDeleteOrder: SupermarketResetTarget[] = [
  "posSales",
  "posProducts",
  "posCategories",
  "posSettings",
];

const systemDeleteOrder: SystemResetTarget[] = ["auditLogs"];

export function orderDataResetTargets(
  category: DataResetCategory,
  targets: DataResetTarget[],
): DataResetTarget[] {
  const order =
    category === "service"
      ? serviceDeleteOrder
      : category === "hr"
        ? hrDeleteOrder
        : category === "master"
          ? masterDeleteOrder
          : category === "supermarket"
            ? supermarketDeleteOrder
            : systemDeleteOrder;
  const selected = new Set(targets);
  return order.filter((target) => selected.has(target));
}

async function deleteCategoryTarget(
  tx: Prisma.TransactionClient,
  category: DataResetCategory,
  target: DataResetTarget,
  options: DataResetExecuteOptions,
): Promise<{ deleted: number; orphanAuthUserIds: string[] }> {
  if (category === "service") {
    return {
      deleted: await deleteServiceTarget(tx, target as ServiceResetTarget),
      orphanAuthUserIds: [],
    };
  }
  if (category === "hr") {
    return deleteHrTarget(tx, target as HrResetTarget, options);
  }
  if (category === "master") {
    return {
      deleted: await deleteMasterTarget(tx, target as MasterResetTarget),
      orphanAuthUserIds: [],
    };
  }
  if (category === "supermarket") {
    return {
      deleted: await deleteSupermarketTarget(
        tx,
        target as SupermarketResetTarget,
      ),
      orphanAuthUserIds: [],
    };
  }
  return {
    deleted: await deleteSystemTarget(tx, target as SystemResetTarget),
    orphanAuthUserIds: [],
  };
}

function dataResetFailureMessage(error: unknown): string {
  if (
    error instanceof DataResetDependencyError ||
    error instanceof DataResetSafetyError
  ) {
    return error.message;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2003"
  ) {
    return "ไม่สามารถลบได้ เพราะยังมีข้อมูลที่อ้างอิงอยู่ — ลบข้อมูลที่ขึ้นกับรายการนั้นก่อน";
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "ลบไม่สำเร็จ";
}

/**
 * Single DB transaction for all selected targets (all-or-nothing).
 * Prefer {@link executeDataResetIndependently} for UI wipes so one blocked
 * target (e.g. employees ↔ POS) does not roll back attendance/schedules.
 */
export async function executeDataReset(
  tx: Prisma.TransactionClient,
  category: DataResetCategory,
  targets: DataResetTarget[],
  options: DataResetExecuteOptions = {},
): Promise<DataResetResult> {
  const ordered = expandDataResetTargets(category, targets);
  const deleted: Partial<Record<DataResetTarget, number>> = {};
  const orphanAuthUserIds: string[] = [];

  for (const target of ordered) {
    const result = await deleteCategoryTarget(tx, category, target, options);
    deleted[target] = result.deleted;
    orphanAuthUserIds.push(...result.orphanAuthUserIds);
  }

  return {
    category,
    targets: ordered,
    deleted,
    failed: [],
    orphanAuthUserIds: [...new Set(orphanAuthUserIds)],
  };
}

/** Commit each target in its own transaction; collect per-target failures. */
export async function executeDataResetIndependently(
  db: DataResetDb,
  category: DataResetCategory,
  targets: DataResetTarget[],
  options: DataResetExecuteOptions = {},
): Promise<DataResetResult> {
  const txOptions = { timeout: 120_000, maxWait: 30_000 };

  // Non-HR categories are safe as one transaction and much faster over remote DB
  // (avoids N connection round-trips). HR stays per-target so POS-blocked
  // employees do not roll back attendance/schedules.
  if (category !== "hr") {
    try {
      return await db.$transaction(
        async (tx) => executeDataReset(tx, category, targets, options),
        txOptions,
      );
    } catch (error) {
      const ordered = expandDataResetTargets(category, targets);
      return {
        category,
        targets: ordered,
        deleted: {},
        failed: ordered.map((target) => ({
          target,
          message: dataResetFailureMessage(error),
        })),
        orphanAuthUserIds: [],
      };
    }
  }

  const ordered = expandDataResetTargets(category, targets);
  const deleted: Partial<Record<DataResetTarget, number>> = {};
  const orphanAuthUserIds: string[] = [];
  const failed: DataResetFailure[] = [];

  for (const target of ordered) {
    try {
      const result = await db.$transaction(
        async (tx) => deleteCategoryTarget(tx, category, target, options),
        txOptions,
      );
      deleted[target] = result.deleted;
      orphanAuthUserIds.push(...result.orphanAuthUserIds);
    } catch (error) {
      failed.push({
        target,
        message: dataResetFailureMessage(error),
      });
    }
  }

  return {
    category,
    targets: ordered,
    deleted,
    failed,
    orphanAuthUserIds: [...new Set(orphanAuthUserIds)],
  };
}

export function dataResetCategoryLabel(category: DataResetCategory): string {
  if (category === "service") return "การเข้ารับบริการ";
  if (category === "hr") return "พนักงาน";
  if (category === "master") return "ข้อมูลหลัก";
  if (category === "supermarket") return "ซูเปอร์มาร์เก็ต";
  return "ระบบ";
}
