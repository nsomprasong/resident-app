import { permissions, type Permission } from "@/lib/auth/authorization";

/**
 * Thai display names for permission codes.
 * Codes themselves must not change; this is localization only.
 */
export const permissionThaiLabels = {
  "booking.read": "ดูการจอง",
  "booking.write": "สร้างและแก้ไขการจอง",
  "booking.lifecycle": "เปลี่ยนสถานะการจอง",
  "resource.read": "ดูห้องและแพ",
  "resource.manage": "จัดการห้องและแพ",
  "order.read": "ดูออเดอร์อาหาร",
  "order.write": "สั่งอาหาร",
  "order.kitchen": "ดำเนินงานครัว",
  "payment.read": "ดูการชำระเงิน",
  "payment.collect": "รับชำระเงิน",
  "payment.refund": "คืนเงิน",
  "payment_channel.manage": "จัดการช่องทางรับชำระ",
  "inspection.read": "ดูรายการตรวจห้อง",
  "inspection.write": "บันทึกการตรวจห้อง",
  "inspection.complete": "ปิดงานตรวจห้อง",
  "catalog.read": "ดูสินค้าและรายการตรวจ",
  "catalog.manage": "จัดการสินค้าและรายการตรวจ",
  "employee.read": "ดูข้อมูลและตารางพนักงาน",
  "employee.manage": "จัดการพนักงาน",
  "wage.read": "ดูค่าแรง",
  "report.read": "ดูรายงานและแดชบอร์ดบัญชี",
  "ops.read": "ดูภาพรวมงานวันนี้",
  "settings.manage": "จัดการข้อมูลหลัก",
  "authorization.manage": "จัดการบทบาทและสิทธิ์",
  "data.reset": "ล้างข้อมูลเริ่มต้นใหม่",
} as const satisfies Record<Permission, string>;

export function resolvePermissionThaiLabel(code: string): string | null {
  if (code in permissionThaiLabels) {
    return permissionThaiLabels[code as Permission];
  }
  return null;
}

export function assertAllPermissionsHaveThaiLabels(): boolean {
  return permissions.every((code) => Boolean(permissionThaiLabels[code]));
}
