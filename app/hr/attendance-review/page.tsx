import { ClipboardCheck } from "lucide-react";

import { HrAttendanceBoard } from "@/components/hr/HrAttendanceBoard";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default function HrAttendanceReviewPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <PageHeader
        icon={<ClipboardCheck size={24} />}
        eyebrow="บริหารพนักงาน"
        title="ตรวจสอบเวลาเข้า–ออก"
        description="ดูรายการที่ต้องตรวจสอบ อนุมัติคำขอแก้ไข/OT และแก้เวลาเลิกกะตามตาราง"
      />
      <HrAttendanceBoard variant="review" />
    </div>
  );
}
