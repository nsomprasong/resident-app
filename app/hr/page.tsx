import { UsersRound } from "lucide-react";

import { HrDashboardBoard } from "@/components/hr/HrDashboardBoard";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default function HrOverviewPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      <PageHeader
        icon={<UsersRound size={24} />}
        eyebrow="บริหารพนักงาน"
        title="ภาพรวมบุคลากร"
        description="ดูสรุปรายวันและตารางงานรอบปัจจุบัน — เลือกสิ่งที่ต้องการแสดงจากด้านบน"
      />
      <HrDashboardBoard />
    </div>
  );
}
