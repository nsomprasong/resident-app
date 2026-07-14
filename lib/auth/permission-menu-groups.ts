import { permissions, type Permission } from "@/lib/auth/authorization";

/**
 * Permission UI order aligned with Sidebar / HR nav.
 * Within each group: manage/write/action first, then read/view.
 * Shared page permissions (e.g. report.read) may appear in more than one menu group.
 */
export type PermissionMenuGroup = {
  id: string;
  sectionTitle: string;
  title: string;
  permissions: readonly Permission[];
};

/** Codes intentionally shown under more than one menu for clearer assignment UX */
export const sharedPermissionCodes = ["report.read"] as const satisfies readonly Permission[];

export const permissionMenuGroups: readonly PermissionMenuGroup[] = [
  {
    id: "today",
    sectionTitle: "งานประจำวัน",
    title: "ภาพรวมวันนี้",
    permissions: ["ops.read"],
  },
  {
    id: "booking",
    sectionTitle: "งานประจำวัน",
    title: "รายการจอง",
    permissions: [
      "booking.write",
      "booking.lifecycle",
      "booking.read",
      "resource.read",
      "payment.create",
      "payment.collect",
      "payment.submit",
      "payment.verify",
      "payment.cancel",
      "payment.refund",
      "payment.receipt.print",
      "payment.view",
      "payment.read",
    ],
  },
  {
    id: "food-order",
    sectionTitle: "งานประจำวัน",
    title: "สั่งอาหาร",
    permissions: ["order.write", "catalog.read"],
  },
  {
    id: "kitchen",
    sectionTitle: "งานประจำวัน",
    title: "ครัว",
    permissions: ["order.kitchen", "order.read"],
  },
  {
    id: "housekeeping",
    sectionTitle: "งานประจำวัน",
    title: "แม่บ้านและตรวจสอบห้องพัก",
    permissions: [
      "inspection.complete",
      "inspection.write",
      "inspection.read",
    ],
  },
  {
    id: "dashboard",
    sectionTitle: "งานประจำวัน",
    title: "บัญชีและแดชบอร์ด",
    permissions: ["report.read"],
  },
  {
    id: "settings",
    sectionTitle: "งานประจำวัน",
    title: "ตั้งค่าข้อมูลหลัก",
    permissions: [
      "settings.manage",
      "resource.manage",
      "catalog.manage",
      "payment_channel.manage",
      "payment.promptpay_settings.manage",
      "payment.promptpay_settings.view",
      "employee.manage",
      "employee.read",
      "authorization.manage",
    ],
  },
  {
    id: "data-reset",
    sectionTitle: "งานประจำวัน",
    title: "ล้างข้อมูลเริ่มต้นใหม่",
    permissions: ["data.reset"],
  },
  {
    id: "report",
    sectionTitle: "งานประจำวัน",
    title: "รายงานรวม",
    permissions: ["report.read", "payment.report.view"],
  },
  {
    id: "hr-overview",
    sectionTitle: "บริหารพนักงาน",
    title: "ภาพรวมบุคลากร · พนักงาน",
    permissions: [
      "hr.employee.create",
      "hr.employee.update",
      "hr.employee.archive",
      "hr.employee.view",
      "hr.sensitive.view",
    ],
  },
  {
    id: "hr-schedule",
    sectionTitle: "บริหารพนักงาน",
    title: "ตารางงาน",
    permissions: ["hr.schedule.manage"],
  },
  {
    id: "hr-attendance",
    sectionTitle: "บริหารพนักงาน",
    title: "ลงเวลา",
    permissions: ["hr.attendance.manage", "hr.attendance.approve"],
  },
  {
    id: "hr-leave",
    sectionTitle: "บริหารพนักงาน",
    title: "วันลา",
    permissions: ["hr.leave.approve", "hr.leave.request"],
  },
  {
    id: "hr-payroll",
    sectionTitle: "บริหารพนักงาน",
    title: "ค่าจ้างและเงินเดือน",
    permissions: [
      "hr.payroll.calculate",
      "hr.payroll.approve",
      "hr.payroll.mark_paid",
      "hr.compensation.view",
      "wage.read",
    ],
  },
  {
    id: "hr-documents",
    sectionTitle: "บริหารพนักงาน",
    title: "เอกสารพนักงาน",
    permissions: ["hr.document.manage"],
  },
  {
    id: "hr-reports",
    sectionTitle: "บริหารพนักงาน",
    title: "รายงานบุคลากร",
    permissions: ["hr.report.view"],
  },
  {
    id: "hr-settings",
    sectionTitle: "บริหารพนักงาน",
    title: "ตั้งค่าบุคลากร",
    permissions: ["hr.settings.manage"],
  },
  {
    id: "pos-sales",
    sectionTitle: "ซูเปอร์มาร์เก็ต",
    title: "หน้าขาย",
    permissions: [
      "pos.sell",
      "pos.discount",
      "pos.hold",
      "pos.cancel",
      "pos.refund",
      "pos.view",
    ],
  },
  {
    id: "pos-products",
    sectionTitle: "ซูเปอร์มาร์เก็ต",
    title: "สินค้าและหมวดหมู่",
    permissions: ["pos.product.manage", "pos.product.view"],
  },
  {
    id: "pos-stock",
    sectionTitle: "ซูเปอร์มาร์เก็ต",
    title: "สต๊อก",
    permissions: [
      "pos.stock.receive",
      "pos.stock.adjust",
      "pos.stock.count",
      "pos.stock.view",
    ],
  },
  {
    id: "pos-shifts",
    sectionTitle: "ซูเปอร์มาร์เก็ต",
    title: "กะขาย",
    permissions: ["pos.shift.open", "pos.shift.close", "pos.shift.approve"],
  },
  {
    id: "pos-reports",
    sectionTitle: "ซูเปอร์มาร์เก็ต",
    title: "รายงานและบัญชี",
    permissions: ["pos.accounting.post", "pos.report.view"],
  },
  {
    id: "pos-settings",
    sectionTitle: "ซูเปอร์มาร์เก็ต",
    title: "ตั้งค่าระบบขาย",
    permissions: ["pos.settings.manage"],
  },
] as const;

export type PermissionMenuGroupView<T extends { code: string }> = {
  id: string;
  sectionTitle: string;
  title: string;
  items: T[];
};

/** Group catalog rows by menu order; unknown codes go to ท้ายสุด */
export function groupPermissionsByMenu<T extends { code: string }>(
  catalog: readonly T[],
): PermissionMenuGroupView<T>[] {
  const byCode = new Map(catalog.map((item) => [item.code, item]));
  const used = new Set<string>();
  const groups: PermissionMenuGroupView<T>[] = [];

  for (const group of permissionMenuGroups) {
    const items: T[] = [];
    for (const code of group.permissions) {
      const row = byCode.get(code);
      if (!row) continue;
      items.push(row);
      used.add(code);
    }
    if (items.length) {
      groups.push({
        id: group.id,
        sectionTitle: group.sectionTitle,
        title: group.title,
        items,
      });
    }
  }

  const leftovers = catalog.filter((item) => !used.has(item.code));
  if (leftovers.length) {
    groups.push({
      id: "other",
      sectionTitle: "อื่นๆ",
      title: "สิทธิ์ที่ยังไม่ได้จัดหมวด",
      items: leftovers,
    });
  }

  return groups;
}

export function assertPermissionMenuGroupsCoverAll(): {
  ok: boolean;
  missing: string[];
  unexpectedDuplicates: string[];
} {
  const shared = new Set<string>(sharedPermissionCodes);
  const seen = new Map<string, string>();
  const unexpectedDuplicates: string[] = [];
  for (const group of permissionMenuGroups) {
    for (const code of group.permissions) {
      const previous = seen.get(code);
      if (previous && !shared.has(code)) {
        unexpectedDuplicates.push(`${code} (${previous}, ${group.id})`);
      } else if (!previous) {
        seen.set(code, group.id);
      }
    }
  }
  const missing = permissions.filter((code) => !seen.has(code));
  return {
    ok: missing.length === 0 && unexpectedDuplicates.length === 0,
    missing,
    unexpectedDuplicates,
  };
}
