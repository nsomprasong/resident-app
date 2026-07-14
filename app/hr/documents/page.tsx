import { FileStack } from "lucide-react";

import { HrDocumentsBoard } from "@/components/hr/HrDocumentsBoard";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default function HrDocumentsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      <PageHeader
        icon={<FileStack size={24} />}
        eyebrow="บริหารพนักงาน"
        title="เอกสารพนักงาน"
        description="อัปโหลดเอกสารสำคัญไปยังที่เก็บส่วนตัว พร้อมติดตามวันหมดอายุ"
      />
      <HrDocumentsBoard />
    </div>
  );
}
