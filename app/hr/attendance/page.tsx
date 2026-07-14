import { Clock3 } from "lucide-react";

import { HrAttendanceBoard } from "@/components/hr/HrAttendanceBoard";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default function HrAttendancePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      <PageHeader
        icon={<Clock3 size={24} />}
        eyebrow="บริหารพนักงาน"
        title="ลงเวลา"
        description="เปิดรายการจากตาราง ลงเวลาเข้า–ออก/พัก คำนวณสาย·OT อนุมัติ และปิดรอบ"
      />
      <HrAttendanceBoard />
    </div>
  );
}
