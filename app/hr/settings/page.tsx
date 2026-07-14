import {
  Banknote,
  CalendarDays,
  Settings2,
  Umbrella,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

const links = [
  {
    href: "/hr/employees",
    title: "พนักงาน / แผนก / ตำแหน่ง",
    description: "ข้อมูลพนักงานและการจัดโครงสร้างองค์กร",
    icon: UsersRound,
  },
  {
    href: "/hr/schedules",
    title: "กะและตารางงาน",
    description: "ตั้งค่ากะ จัดตาราง และวันหยุด",
    icon: CalendarDays,
  },
  {
    href: "/hr/leave",
    title: "ประเภทลาและสิทธิ",
    description: "ตั้งค่าประเภทลา สิทธิ และปฏิทินวันหยุด",
    icon: Umbrella,
  },
  {
    href: "/hr/payroll",
    title: "กฎค่าจ้าง",
    description: "ค่าตอบแทน สูตร OT และรอบจ่าย",
    icon: Banknote,
  },
] as const;

export default function HrSettingsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      <PageHeader
        icon={<Settings2 size={24} />}
        eyebrow="บริหารพนักงาน"
        title="ตั้งค่าบุคลากร"
        description="ทางลัดไปยังการตั้งค่าที่ใช้จริงในโมดูล HR — การผูกบัญชี/บทบาทยังใช้ Settings → Employees"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {links.map(({ href, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="rounded-3xl border border-border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Icon size={22} />
            </span>
            <h2 className="mt-4 text-lg font-semibold text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </Link>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        หมายเหตุ: `/api/employees` และหน้า Settings Employees ยังคงไว้สำหรับผูก
        Supabase Auth / role ตาม migration map (KEEP ชั่วคราว)
      </p>
    </div>
  );
}
