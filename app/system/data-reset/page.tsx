import { Eraser } from "lucide-react";

import DataResetManager from "@/components/system/DataResetManager";
import { PageHeader } from "@/components/ui/PageHeader";

export default function DataResetPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      <PageHeader
        icon={<Eraser size={24} />}
        eyebrow="งานประจำวัน"
        title="ล้างข้อมูลเริ่มต้นใหม่"
        description="แยกลบข้อมูลบริการ พนักงาน ข้อมูลหลัก ซูเปอร์มาร์เก็ต และระบบ ได้ทีละรายการหรือทั้งหมวด — การลบถาวรและกู้คืนไม่ได้ · ไม่รวมบทบาท/สิทธิ์"
      />

      <DataResetManager />
    </div>
  );
}
