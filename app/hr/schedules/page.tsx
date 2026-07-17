import { CalendarDays } from "lucide-react";
import Link from "next/link";

import { HrScheduleRosterBoard } from "@/components/hr/HrScheduleRosterBoard";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default function HrSchedulesPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <PageHeader
        icon={<CalendarDays size={24} />}
        eyebrow="บริหารพนักงาน"
        title="ตารางงาน"
        description="ตารางทำงานจริง (ครึ่งเดือน) เชื่อมกับการลงเวลาและคำนวณค่าจ้าง"
      />
      <p className="text-sm text-muted-foreground">
        จัดการ{" "}
        <Link href="/hr/settings" className="font-medium text-primary hover:underline">
          แม่แบบกะ
        </Link>{" "}
        ได้ที่เมนูตั้งค่าระบบพนักงาน
      </p>
      <HrScheduleRosterBoard />
    </div>
  );
}
