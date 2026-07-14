import { UsersRound } from "lucide-react";

import { HrEmployeesManager } from "@/components/hr/HrEmployeesManager";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default function HrEmployeesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <PageHeader
        icon={<UsersRound size={24} />}
        eyebrow="บริหารพนักงาน"
        title="พนักงาน"
        description="เพิ่ม ดู แก้ไข และเก็บถาวรพนักงานรายวัน/รายเดือน"
      />
      <HrEmployeesManager />
    </div>
  );
}
