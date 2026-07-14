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
  "payment.view": "ดูรายการรับชำระเงิน",
  "payment.create": "สร้างรายการรับชำระเงิน",
  "payment.submit": "ส่งหลักฐานการชำระเงิน",
  "payment.verify": "ตรวจสอบและยืนยันการชำระเงิน",
  "payment.cancel": "ยกเลิกรายการรับชำระเงิน",
  "payment.receipt.print": "พิมพ์หรือดาวน์โหลดหลักฐานรับเงิน",
  "payment.promptpay_settings.view": "ดูการตั้งค่าพร้อมเพย์",
  "payment.promptpay_settings.manage": "จัดการบัญชีพร้อมเพย์",
  "payment.report.view": "ดูรายงานการรับชำระเงินในรายงานรวม",
  "payment_channel.manage": "จัดการช่องทางรับชำระ",
  "inspection.read": "ดูรายการตรวจห้อง",
  "inspection.write": "บันทึกการตรวจห้อง",
  "inspection.complete": "ปิดงานตรวจห้อง",
  "catalog.read": "ดูสินค้าและรายการตรวจ",
  "catalog.manage": "จัดการสินค้าและรายการตรวจ",
  "employee.read": "ดูข้อมูลและตารางพนักงาน",
  "employee.manage": "จัดการพนักงาน",
  "wage.read": "ดูค่าแรง",
  "report.read": "เปิดเมนูบัญชี แดชบอร์ด และรายงานรวม",
  "ops.read": "ดูภาพรวมงานวันนี้",
  "settings.manage": "จัดการข้อมูลหลัก",
  "authorization.manage": "แก้ไขชุดสิทธิ์ของบทบาท",
  "data.reset": "ล้างข้อมูลเริ่มต้นใหม่",
  "hr.employee.view": "ดูข้อมูลพนักงาน",
  "hr.employee.create": "เพิ่มพนักงาน",
  "hr.employee.update": "แก้ไขข้อมูลพนักงาน",
  "hr.employee.archive": "ระงับหรือเก็บพนักงาน",
  "hr.sensitive.view": "ดูข้อมูลส่วนบุคคลที่สำคัญ",
  "hr.compensation.view": "ดูค่าจ้างและเงินเดือน",
  "hr.schedule.manage": "จัดการตารางงาน",
  "hr.attendance.manage": "จัดการเวลาเข้า–ออกงาน",
  "hr.attendance.approve": "อนุมัติการแก้ไขเวลาและ OT",
  "hr.leave.request": "ยื่นคำขอลา",
  "hr.leave.approve": "อนุมัติคำขอลา",
  "hr.payroll.calculate": "คำนวณค่าจ้างและเงินเดือน",
  "hr.payroll.approve": "อนุมัติการจ่ายเงิน",
  "hr.payroll.mark_paid": "บันทึกการจ่ายเงินแล้ว",
  "hr.document.manage": "จัดการเอกสารพนักงาน",
  "hr.report.view": "ดูรายงานบุคลากร",
  "hr.settings.manage": "ตั้งค่าระบบบุคลากร",
  "hr.attendance.self": "ลงเวลาและดูเวลาของตนเอง",
  "hr.leave.self": "ส่งและดูคำขอลาของตนเอง",
  "hr.overtime.manage": "ตรวจสอบและอนุมัติ OT",
  "hr.payroll_summary.view": "ดูสรุปค่าแรงรอบจ่ายเงิน",
  "pos.view": "เข้าถึงหน้าขายซูเปอร์มาร์เก็ต",
  "pos.sell": "บันทึกการขายซูเปอร์มาร์เก็ต",
  "pos.discount": "ให้ส่วนลดการขาย",
  "pos.hold": "พักและเรียกบิลขาย",
  "pos.cancel": "ยกเลิกบิลขาย",
  "pos.refund": "คืนสินค้าและคืนเงิน",
  "pos.shift.open": "เปิดกะขาย",
  "pos.shift.close": "ปิดกะขาย",
  "pos.shift.approve": "ตรวจสอบและอนุมัติกะขาย",
  "pos.product.view": "ดูข้อมูลสินค้าซูเปอร์มาร์เก็ต",
  "pos.product.manage": "จัดการสินค้าและหมวดหมู่ซูเปอร์มาร์เก็ต",
  "pos.stock.view": "ดูสต๊อกและประวัติสินค้า",
  "pos.stock.receive": "รับสินค้าเข้าสต๊อก",
  "pos.stock.adjust": "ปรับยอดสต๊อก",
  "pos.stock.count": "ตรวจนับสต๊อก",
  "pos.report.view": "ดูรายงานยอดขายซูเปอร์มาร์เก็ต",
  "pos.accounting.post": "ส่งรายการขายเข้าบัญชี",
  "pos.settings.manage": "จัดการตั้งค่าระบบขาย",
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
