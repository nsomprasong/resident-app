import { AlertTriangle, Banknote, Clock3, UsersRound } from "lucide-react";
import type { ReactNode } from "react";

import {
  calculateEstimatedWage,
  calculateTotalShiftHours,
} from "@/lib/employees/work-shifts";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(value);
}

function startOfCurrentMonth() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export default async function WagePage() {
  const monthStart = startOfCurrentMonth();
  const monthEnd = new Date(monthStart);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);

  const employees = await prisma.employee.findMany({
    include: {
      roleRecord: true,
      shifts: {
        where: {
          startsAt: { gte: monthStart, lt: monthEnd },
        },
        orderBy: { startsAt: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const rows = employees.map((employee) => {
    const hourlyRate = employee.hourlyRate === null ? null : Number(employee.hourlyRate);
    const totalHours = calculateTotalShiftHours(employee.shifts);
    const estimatedWage = calculateEstimatedWage(
      employee.shifts.map((shift) => ({ ...shift, hourlyRate })),
    );

    return {
      id: employee.id,
      name: employee.name,
      role: employee.roleRecord?.displayName ?? "ยังไม่มี role",
      hourlyRate,
      shiftCount: employee.shifts.length,
      totalHours,
      estimatedWage,
    };
  });

  const totalHours = rows.reduce((sum, row) => sum + row.totalHours, 0);
  const totalEstimatedWage = rows.reduce(
    (sum, row) => sum + row.estimatedWage,
    0,
  );
  const missingRateCount = rows.filter(
    (row) => row.shiftCount > 0 && row.hourlyRate === null,
  ).length;

  return (
    <div className="min-h-screen bg-muted p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-sm font-medium text-primary">Wage Overview</p>
          <h1 className="mt-1 text-3xl font-semibold text-foreground">
            ค่าแรงพนักงาน
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            สรุปชั่วโมงจาก WorkShift เดือนปัจจุบันและประเมินค่าแรงจาก hourly rate
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <SummaryCard
            title="พนักงาน"
            value={rows.length.toLocaleString("th-TH")}
            icon={<UsersRound size={22} />}
          />
          <SummaryCard
            title="ชั่วโมงรวม"
            value={totalHours.toLocaleString("th-TH")}
            icon={<Clock3 size={22} />}
          />
          <SummaryCard
            title="ค่าแรงประเมิน"
            value={formatCurrency(totalEstimatedWage)}
            icon={<Banknote size={22} />}
          />
          <SummaryCard
            title="ยังไม่มี rate"
            value={missingRateCount.toLocaleString("th-TH")}
            icon={<AlertTriangle size={22} />}
          />
        </div>

        <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
          <div className="border-b border-border p-5">
            <h2 className="text-lg font-semibold text-foreground">
              รายละเอียดค่าแรง
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              ไม่รวม OT, allowance หรือ deduction ที่ยังไม่มี business rule ในระบบ
            </p>
          </div>
          <div className="divide-y divide-border">
            {rows.map((row) => (
              <div
                key={row.id}
                className="grid gap-3 p-4 text-sm sm:grid-cols-6 sm:items-center"
              >
                <div className="sm:col-span-2">
                  <p className="font-medium text-foreground">{row.name}</p>
                  <p className="text-muted-foreground">{row.role}</p>
                </div>
                <Metric label="กะ" value={row.shiftCount.toLocaleString("th-TH")} />
                <Metric
                  label="ชั่วโมง"
                  value={row.totalHours.toLocaleString("th-TH")}
                />
                <Metric
                  label="rate"
                  value={
                    row.hourlyRate === null ? "ยังไม่ตั้ง" : formatCurrency(row.hourlyRate)
                  }
                />
                <Metric label="ประเมิน" value={formatCurrency(row.estimatedWage)} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </span>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  );
}