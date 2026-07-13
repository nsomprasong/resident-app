import { CalendarDays, Clock3, UsersRound } from "lucide-react";
import type { ReactNode } from "react";

import { calculateShiftHours } from "@/lib/employees/work-shifts";
import { formatThaiDateTime } from "@/lib/format/date";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function startOfToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export default async function EmployeeSchedulePage() {
  const today = startOfToday();
  const rangeEnd = new Date(today);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 14);

  const employees = await prisma.employee.findMany({
    include: {
      roleRecord: true,
      shifts: {
        where: {
          startsAt: { gte: today, lt: rangeEnd },
        },
        orderBy: { startsAt: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const totalShifts = employees.reduce(
    (sum, employee) => sum + employee.shifts.length,
    0,
  );
  const scheduledEmployees = employees.filter(
    (employee) => employee.shifts.length > 0,
  ).length;

  return (
    <div className="min-h-screen bg-muted p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-sm font-medium text-primary">Employee Schedule</p>
          <h1 className="mt-1 text-3xl font-semibold text-foreground">
            ตารางพนักงาน
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            แสดงกะงานจากข้อมูล WorkShift ในช่วง 14 วันข้างหน้า
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard
            title="พนักงานทั้งหมด"
            value={employees.length.toLocaleString("th-TH")}
            icon={<UsersRound size={22} />}
          />
          <SummaryCard
            title="มีตารางในช่วงนี้"
            value={scheduledEmployees.toLocaleString("th-TH")}
            icon={<CalendarDays size={22} />}
          />
          <SummaryCard
            title="จำนวนกะ"
            value={totalShifts.toLocaleString("th-TH")}
            icon={<Clock3 size={22} />}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {employees.map((employee) => (
            <section
              key={employee.id}
              className="rounded-3xl border border-border bg-surface p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {employee.name}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {employee.roleRecord?.displayName ?? "ยังไม่มี role"}
                    {employee.phone ? ` · ${employee.phone}` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  {employee.shifts.length} กะ
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {employee.shifts.length ? (
                  employee.shifts.map((shift) => (
                    <div
                      key={shift.id}
                      className="rounded-2xl border border-border p-3 text-sm"
                    >
                      <p className="font-medium text-foreground">
                        {formatThaiDateTime(shift.startsAt)}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        ถึง {formatThaiDateTime(shift.endsAt)} ·{" "}
                        {calculateShiftHours(shift).toLocaleString("th-TH")} ชม.
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl bg-background p-4 text-sm text-muted-foreground">
                    ยังไม่มีกะงานในช่วงนี้
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
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
          <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </span>
      </div>
    </section>
  );
}