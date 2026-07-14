import { Banknote } from "lucide-react";

import { HrPayrollBoard } from "@/components/hr/HrPayrollBoard";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default function HrPayrollPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      <PageHeader
        icon={<Banknote size={24} />}
        eyebrow="บริหารพนักงาน"
        title="ค่าจ้างและเงินเดือน"
        description="ตั้งค่าตอบแทน สร้างรอบ คำนวณ อนุมัติ ล็อก จ่ายแล้ว และส่งออกสลิป/CSV"
      />
      <HrPayrollBoard />
    </div>
  );
}
