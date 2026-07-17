import { Settings2 } from "lucide-react";

import { HrEmployeeSystemSettingsBoard } from "@/components/hr/HrEmployeeSystemSettingsBoard";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default function HrEmployeeSystemSettingsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <PageHeader
        icon={<Settings2 size={24} />}
        eyebrow="บริหารพนักงาน"
        title="ตั้งค่าระบบพนักงาน"
        description="แม่แบบกะ สูตรค่าจ้าง และหมุด GPS สำหรับลงเวลา"
      />
      <HrEmployeeSystemSettingsBoard />
    </div>
  );
}
