import { Eraser } from "lucide-react";

import DataResetManager from "@/components/system/DataResetManager";

export default function DataResetPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      <header className="overflow-hidden rounded-[2rem] border border-border bg-surface shadow-sm">
        <div className="relative bg-gradient-to-br from-destructive via-destructive to-secondary px-6 py-8 text-destructive-foreground sm:px-10 sm:py-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_55%)]" />
          <div className="relative flex items-start gap-4">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-destructive-foreground/15">
              <Eraser size={24} />
            </span>
            <div>
              <p className="text-sm font-medium text-destructive-foreground/80">
                ผู้ดูแลระบบเท่านั้น
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                ล้างข้อมูลเริ่มต้นใหม่
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-destructive-foreground/85">
                แยกลบข้อมูลการเข้ารับบริการ และข้อมูลหลัก ได้ทีละรายการหรือทั้งหมวด
                การลบถาวรและไม่สามารถกู้คืนได้ — ไม่รวมบัญชีพนักงานและบทบาท/สิทธิ์
              </p>
            </div>
          </div>
        </div>
      </header>

      <DataResetManager />
    </div>
  );
}
