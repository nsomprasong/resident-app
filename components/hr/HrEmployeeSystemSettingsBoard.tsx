"use client";

import { useState } from "react";

import { useEmployeePermissions } from "@/components/auth/EmployeePermissionsProvider";
import { HrAttendancePinSettingsPanel } from "@/components/hr/HrAttendancePinSettingsPanel";
import { HrPayrollSettingsPanel } from "@/components/hr/HrPayrollSettingsPanel";
import { HrSchedulesBoard } from "@/components/hr/HrSchedulesBoard";

type Tab = "templates" | "payroll" | "pin";

export function HrEmployeeSystemSettingsBoard() {
  const { can } = useEmployeePermissions();
  const canTemplates = can("hr.schedule.manage");
  const canPayrollFormula =
    can("hr.settings.manage") || can("hr.compensation.view");
  const canPin =
    can("hr.settings.manage") || can("hr.attendance.manage");

  const defaultTab: Tab = canTemplates
    ? "templates"
    : canPayrollFormula
      ? "payroll"
      : canPin
        ? "pin"
        : "templates";
  const [tab, setTab] = useState<Tab>(defaultTab);

  if (!canTemplates && !canPayrollFormula && !canPin) {
    return (
      <p className="rounded-2xl border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
        ไม่มีสิทธิ์เข้าถึงการตั้งค่าในหน้านี้
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {canTemplates ? (
          <button
            type="button"
            onClick={() => setTab("templates")}
            className={`rounded-xl px-3 py-2 text-sm font-medium ${
              tab === "templates"
                ? "bg-primary text-primary-foreground"
                : "border border-border hover:bg-muted"
            }`}
          >
            แม่แบบกะ
          </button>
        ) : null}
        {canPayrollFormula ? (
          <button
            type="button"
            onClick={() => setTab("payroll")}
            className={`rounded-xl px-3 py-2 text-sm font-medium ${
              tab === "payroll"
                ? "bg-primary text-primary-foreground"
                : "border border-border hover:bg-muted"
            }`}
          >
            สูตรค่าจ้าง
          </button>
        ) : null}
        {canPin ? (
          <button
            type="button"
            onClick={() => setTab("pin")}
            className={`rounded-xl px-3 py-2 text-sm font-medium ${
              tab === "pin"
                ? "bg-primary text-primary-foreground"
                : "border border-border hover:bg-muted"
            }`}
          >
            ตั้งค่าหมุด
          </button>
        ) : null}
      </div>

      {tab === "templates" && canTemplates ? (
        <HrSchedulesBoard />
      ) : null}
      {tab === "payroll" && canPayrollFormula ? (
        <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="mb-4 border-b border-border pb-3">
            <h2 className="font-semibold text-foreground">สูตรค่าจ้าง</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              ตัวคูณ OT หักมาสาย วันทำงานมาตรฐาน และ prorate เงินเดือน
            </p>
          </div>
          <HrPayrollSettingsPanel />
        </section>
      ) : null}
      {tab === "pin" && canPin ? (
        <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="mb-4 border-b border-border pb-3">
            <h2 className="font-semibold text-foreground">ตั้งค่าหมุดเข้างาน</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              พิกัด GPS รัศมีที่อนุญาต และเงื่อนไขการลงเวลาจากมือถือ
            </p>
          </div>
          <HrAttendancePinSettingsPanel />
        </section>
      ) : null}
    </div>
  );
}
