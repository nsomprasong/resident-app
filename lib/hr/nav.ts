import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  CalendarDays,
  ClipboardList,
  Clock3,
  FileStack,
  LayoutDashboard,
  Settings2,
  Umbrella,
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

export const hrNavItems: readonly HrNavItem[] = [
  {
    text: "ภาพรวมบุคลากร",
    description: "สรุปสถานะพนักงาน ตาราง เวลา และค่าจ้าง",
    path: "/hr",
    icon: LayoutDashboard,
    permission: "hr.employee.view",
  },
  {
    text: "พนักงาน",
    description: "ข้อมูลพนักงานรายวันและรายเดือน",
    path: "/hr/employees",
    icon: UsersRound,
    permission: "hr.employee.view",
  },
  {
    text: "ตารางงาน",
    description: "จัดกะและตารางเวร",
    path: "/hr/schedules",
    icon: CalendarDays,
    permission: "hr.schedule.manage",
  },
  {
    text: "ลงเวลา",
    description: "เวลาเข้า–ออก พัก และ OT",
    path: "/hr/attendance",
    icon: Clock3,
    permission: "hr.attendance.manage",
  },
  {
    text: "วันลา",
    description: "คำขอลาและวันหยุด",
    path: "/hr/leave",
    icon: Umbrella,
    permission: "hr.leave.request",
  },
  {
    text: "ค่าจ้างและเงินเดือน",
    description: "รอบจ่าย คำนวณ และสลิป",
    path: "/hr/payroll",
    icon: Banknote,
    permission: "hr.compensation.view",
  },
  {
    text: "เอกสารพนักงาน",
    description: "สัญญา บัตรประชาชน และเอกสารลา",
    path: "/hr/documents",
    icon: FileStack,
    permission: "hr.document.manage",
  },
  {
    text: "รายงานบุคลากร",
    description: "รายงานเข้างาน ลา และต้นทุน",
    path: "/hr/reports",
    icon: ClipboardList,
    permission: "hr.report.view",
  },
  {
    text: "ตั้งค่าบุคลากร",
    description: "แผนก กะ ประเภทลา และกฎค่าจ้าง",
    path: "/hr/settings",
    icon: Settings2,
    permission: "hr.settings.manage",
  },
] as const;

export function filterHrNavItems(permissionCodes: readonly string[]) {
  return hrNavItems.filter((item) => permissionCodes.includes(item.permission));
}
