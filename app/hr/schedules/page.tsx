import { CalendarDays } from "lucide-react";

import { HrSchedulesBoard } from "@/components/hr/HrSchedulesBoard";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default function HrSchedulesPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      <PageHeader
        icon={<CalendarDays size={24} />}
        eyebrow="บริหารพนักงาน"
        title="ตารางงาน"
        description="ตั้งค่ากะ จัดพนักงานลงตาราง ตรวจกะซ้อน/ขาดคน และดูวันหยุด"
      />
      <HrSchedulesBoard />
    </div>
  );
}
