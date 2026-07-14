/**
 * Destructive data wipe for operational / master datasets.
 * Employee / role / permission / auth accounts are intentionally never included —
 * support accounts must survive any reset from this module.
 */
import type { Prisma } from "@/generated/prisma/client";

export const DATA_RESET_CONFIRM_PHRASE = "ล้างข้อมูล";

export const serviceResetTargets = [
  "bookings",
  "guests",
  "tourGroups",
  "workShifts",
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

export type ServiceResetTarget = (typeof serviceResetTargets)[number];
export type MasterResetTarget = (typeof masterResetTargets)[number];
export type DataResetCategory = "service" | "master";
export type DataResetTarget = ServiceResetTarget | MasterResetTarget;

export const serviceResetTargetLabels: Record<ServiceResetTarget, string> = {
  bookings: "การจอง / การรับบริการ (รวมชำระเงิน ออเดอร์ ตรวจห้อง)",
  guests: "ลูกค้า",
  tourGroups: "กรุ๊ปทัวร์",
  workShifts: "ตารางเวรพนักงาน",
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

export type DataResetCounts = Record<DataResetTarget, number>;

export type DataResetResult = {
  category: DataResetCategory;
  targets: DataResetTarget[];
  deleted: Partial<Record<DataResetTarget, number>>;
};

function isServiceTarget(value: string): value is ServiceResetTarget {
  return (serviceResetTargets as readonly string[]).includes(value);
}

function isMasterTarget(value: string): value is MasterResetTarget {
  return (masterResetTargets as readonly string[]).includes(value);
}

export function resolveDataResetTargets(
  category: DataResetCategory,
  targets: "all" | string[],
): { ok: true; targets: DataResetTarget[] } | { ok: false; message: string } {
  const allowed =
    category === "service" ? serviceResetTargets : masterResetTargets;

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
  }

  return { ok: true, targets: unique as DataResetTarget[] };
}

export async function countDataResetTargets(
  tx: Prisma.TransactionClient | typeof import("@/lib/prisma").prisma,
): Promise<DataResetCounts> {
  const [
    bookings,
    guests,
    tourGroups,
    workShifts,
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
  ] = await Promise.all([
    tx.booking.count(),
    tx.guest.count(),
    tx.tourGroup.count(),
    tx.workShift.count(),
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
  ]);

  return {
    bookings,
    guests,
    tourGroups,
    workShifts,
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
  };
}

async function deleteServiceTarget(
  tx: Prisma.TransactionClient,
  target: ServiceResetTarget,
): Promise<number> {
  switch (target) {
    case "bookings": {
      await tx.payment.deleteMany({});
      await tx.orderItem.deleteMany({});
      await tx.order.deleteMany({});
      const bookingCount = await tx.booking.deleteMany({});
      await tx.room.updateMany({ data: { status: "AVAILABLE" } });
      await tx.raft.updateMany({ data: { status: "AVAILABLE" } });
      return bookingCount.count;
    }
    case "guests":
      return (await tx.guest.deleteMany({})).count;
    case "tourGroups":
      return (await tx.tourGroup.deleteMany({})).count;
    case "workShifts":
      return (await tx.workShift.deleteMany({})).count;
    case "auditLogs": {
      await tx.$executeRaw`SELECT set_config('app.allow_audit_purge', 'on', true)`;
      return (await tx.auditLog.deleteMany({})).count;
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

/** Dependency-safe order within each category */
const serviceDeleteOrder: ServiceResetTarget[] = [
  "bookings",
  "guests",
  "tourGroups",
  "workShifts",
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

export function orderDataResetTargets(
  category: DataResetCategory,
  targets: DataResetTarget[],
): DataResetTarget[] {
  const order =
    category === "service" ? serviceDeleteOrder : masterDeleteOrder;
  const selected = new Set(targets);
  return order.filter((target) => selected.has(target));
}

export async function executeDataReset(
  tx: Prisma.TransactionClient,
  category: DataResetCategory,
  targets: DataResetTarget[],
): Promise<DataResetResult> {
  const ordered = orderDataResetTargets(category, targets);
  const deleted: Partial<Record<DataResetTarget, number>> = {};

  for (const target of ordered) {
    deleted[target] =
      category === "service"
        ? await deleteServiceTarget(tx, target as ServiceResetTarget)
        : await deleteMasterTarget(tx, target as MasterResetTarget);
  }

  return { category, targets: ordered, deleted };
}
