import { ClipboardList } from "lucide-react";

import { HrReportsBoard } from "@/components/hr/HrReportsBoard";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default function HrReportsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      <PageHeader
        icon={<ClipboardList size={24} />}
        eyebrow="บริหารพนักงาน"
        title="รายงานบุคลากร"
        description="รายงานเข้างาน ลา ชั่วโมง ค่าจ้าง และต้นทุนตามแผนก พร้อม filter/export"
      />
      <HrReportsBoard />
    </div>
  );
}
