import { Clock3 } from "lucide-react";

import { MyWorkBoard } from "@/components/hr/MyWorkBoard";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default function MyWorkPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 sm:p-8">
      <PageHeader
        icon={<Clock3 size={24} />}
        eyebrow="งานประจำวัน"
        title="บันทึกเวลาทำงาน,ลางาน"
        description="กะวันนี้ ลงเวลาเข้า–ออก แจ้งลา และประวัติของตนเอง"
      />
      <MyWorkBoard />
    </div>
  );
}
