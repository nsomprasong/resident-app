import { ScrollText } from "lucide-react";

import { AuditLogViewer } from "@/components/system/AuditLogViewer";
import { PageHeader } from "@/components/ui/PageHeader";

export default function AuditLogsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <PageHeader
        icon={<ScrollText size={24} />}
        eyebrow="งานประจำวัน"
        title="บันทึกตรวจสอบระบบ"
        description="ดูร่องรอยการกระทำในระบบ เช่น ใครแก้ข้อมูลสำคัญ หรือล้างข้อมูล เมื่อไหน — สำหรับตรวจสอบและสอบทาน"
      />
      <AuditLogViewer />
    </div>
  );
}
