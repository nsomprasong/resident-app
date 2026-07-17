import { Clock3 } from "lucide-react";

import { HrTimePayBoard } from "@/components/hr/HrTimePayBoard";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default function HrTimePayPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      <PageHeader
        icon={<Clock3 size={24} />}
        eyebrow="บริหารพนักงาน"
        title="เวลาและค่าจ้าง"
        description="ลงเวลา การลา คำขอ OT และสรุปค่าแรง"
      />
      <HrTimePayBoard />
    </div>
  );
}
