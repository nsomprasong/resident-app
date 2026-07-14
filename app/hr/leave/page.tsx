import { Umbrella } from "lucide-react";

import { HrLeaveBoard } from "@/components/hr/HrLeaveBoard";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

/** Kept for direct/deep links — the main HR menu now points to /hr/time-pay instead. */
export default function HrLeavePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      <PageHeader
        icon={<Umbrella size={24} />}
        eyebrow="บริหารพนักงาน"
        title="วันลา"
        description="ยื่น/อนุมัติคำขอลา ยอดสิทธิคงเหลือ และปฏิทินวันหยุด"
      />
      <HrLeaveBoard />
    </div>
  );
}
