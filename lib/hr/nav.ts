import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  LayoutDashboard,
  Settings2,
  UsersRound,
} from "lucide-react";

import type { Permission } from "@/lib/auth/authorization";

export type HrNavItem = {
  text: string;
  description: string;
  path: string;
  icon: LucideIcon;
  permission: Permission;
  /** แสดงในเมนูเมื่อมีสิทธิ์ใดสิทธิ์หนึ่ง (ไม่ระบุ = ใช้ permission เดียว) */
  menuPermissions?: readonly Permission[];
};

/**
 * Admin HR menu — core HR pages (schedule + time/pay + payroll period summary).
 */
export const hrNavItems: readonly HrNavItem[] = [
  {
    text: "ภาพรวมพนักงาน",
    description: "สรุปสถานะพนักงานและความผิดปกติวันนี้",
    path: "/hr",
    icon: LayoutDashboard,
    permission: "hr.employee.view",
  },
  {
    text: "พนักงาน",
    description: "ข้อมูลพนักงาน บัญชี บทบาท และค่าจ้าง",
    path: "/hr/employees",
    icon: UsersRound,
    permission: "hr.employee.view",
  },
  {
    text: "ตารางงาน",
    description: "ตารางครึ่งเดือน ทำแทน/ควบกะ และประกาศรอบ",
    path: "/hr/schedules",
    icon: CalendarDays,
    permission: "hr.schedule.manage",
  },
  {
    text: "เวลาและค่าจ้าง",
    description: "ลงเวลา การลา OT ความผิดปกติ และสรุปรอบจ่ายเงิน",
    path: "/hr/time-pay",
    icon: Clock3,
    permission: "hr.attendance.manage",
  },
  {
    text: "ตรวจสอบเวลาเข้า–ออก",
    description: "รายการรอตรวจ มาสาย ไม่ลงออก นอกตาราง และอนุมัติแก้ไข",
    path: "/hr/attendance-review",
    icon: ClipboardCheck,
    permission: "hr.attendance.manage",
  },
  {
    text: "สรุปรอบจ่าย",
    description: "สร้างรอบ คำนวณ อนุมัติ ล็อก จ่ายแล้ว และส่งออกสลิป/CSV",
    path: "/hr/payroll",
    icon: Banknote,
    permission: "hr.compensation.view",
  },
  {
    text: "ตั้งค่าระบบพนักงาน",
    description: "แม่แบบกะ สูตรค่าจ้าง และหมุด GPS",
    path: "/hr/settings",
    icon: Settings2,
    permission: "hr.settings.manage",
    menuPermissions: ["hr.settings.manage", "hr.schedule.manage"],
  },
] as const;

export function filterHrNavItems(permissionCodes: readonly string[]) {
  return hrNavItems.filter((item) => {
    const required = item.menuPermissions ?? [item.permission];
    return required.some((code) => permissionCodes.includes(code));
  });
}

export type SelfNavItem = {
  text: string;
  description: string;
  path: string;
  icon: LucideIcon;
  permission: Permission;
};

/** Employee self-service menu — visible to anyone with attendance.self. */
export const selfNavItems: readonly SelfNavItem[] = [
  {
    text: "บันทึกเวลาทำงาน,ลางาน",
    description: "กะวันนี้ ลงเวลาเข้า–ออก แจ้งลา และประวัติของตนเอง",
    path: "/my-work",
    icon: Clock3,
    permission: "hr.attendance.self",
  },
] as const;

export function filterSelfNavItems(permissionCodes: readonly string[]) {
  return selfNavItems.filter((item) => permissionCodes.includes(item.permission));
}
