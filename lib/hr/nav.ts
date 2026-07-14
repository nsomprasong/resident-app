import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  Clock3,
  LayoutDashboard,
  UsersRound,
} from "lucide-react";

import type { Permission } from "@/lib/auth/authorization";

export type HrNavItem = {
  text: string;
  description: string;
  path: string;
  icon: LucideIcon;
  permission: Permission;
};

/**
 * Admin HR menu — trimmed to 4 items per Phase 21 (attendance/leave/OT/payroll
 * summary now live as tabs inside "เวลาและค่าจ้าง" instead of separate pages).
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
    description: "แม่แบบกะและจัดตารางเวรรายสัปดาห์/รายเดือน",
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
] as const;

export function filterHrNavItems(permissionCodes: readonly string[]) {
  return hrNavItems.filter((item) => permissionCodes.includes(item.permission));
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
