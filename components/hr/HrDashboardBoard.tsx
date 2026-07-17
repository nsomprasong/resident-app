"use client";

import {
  CalendarDays,
  Clock3,
  LayoutGrid,
  Table2,
  Umbrella,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import DateSelector from "@/components/ui/DateSelector";

type DayMetrics = {
  totalEmployees: number;
  dailyEmployees: number;
  monthlyEmployees: number;
  scheduledToday: number;
  clockedIn: number;
  notClockedIn: number;
  late: number;
  absent: number;
  onLeave: number;
  working: number;
  finished: number;
  pendingOtApprovals: number;
  pendingLeaveRequests: number;
  understaffedCount: number;
  estimatedPayroll: number;
};

type MonthSummary = {
  totalEmployees: number;
  workedMinutes: number;
  otMinutes: number;
  lateMinutes: number;
  absentDays: number;
  approvedLeaveDays: number;
  estimatedMonthlyPayroll: number;
};

type Period = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
};

type EmployeeRow = {
  id: string;
  name: string;
  employeeCode: string | null;
};

type ShiftCell = {
  id: string;
  employeeId: string;
  workDate: string;
  shiftName: string;
  assignmentType: string;
  status: string;
  note?: string | null;
};

type ViewMode = "summary" | "roster" | "both";

function todayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function money(value: number) {
  return value.toLocaleString("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function eachDate(from: string, to: string) {
  const keys: string[] = [];
  let cursor = from;
  while (cursor && cursor <= to) {
    keys.push(cursor);
    const [y, m, d] = cursor.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    cursor = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  }
  return keys;
}

function pickCurrentPeriod(periods: Period[], today: string): string {
  const covering = periods.find(
    (period) => period.startDate <= today && period.endDate >= today,
  );
  if (covering) return covering.id;
  const upcoming = [...periods]
    .filter((period) => period.startDate > today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  if (upcoming) return upcoming.id;
  const past = [...periods]
    .filter((period) => period.endDate < today)
    .sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
  return past?.id ?? periods[0]?.id ?? "";
}

function badgeFor(shift: ShiftCell) {
  if (shift.status === "CANCELLED" || shift.status === "REPLACED") return null;
  if (shift.note === "DAY_OFF" || shift.shiftName === "หยุด") return "หยุด";
  if (shift.status === "LEAVE" || shift.shiftName === "ลา") return "ลา";
  if (shift.assignmentType === "REPLACEMENT") return "แทน";
  if (shift.assignmentType === "DOUBLE_SHIFT") return "ควบ";
  if (shift.assignmentType === "EXTRA_SHIFT") return "พิเศษ";
  return shift.shiftName.slice(0, 8);
}

function badgeClass(label: string) {
  if (label === "หยุด") return "bg-muted text-muted-foreground";
  if (label === "ลา") return "bg-warning/15 text-warning";
  if (label === "แทน") return "bg-secondary/20 text-secondary-foreground";
  if (label === "ควบ" || label === "พิเศษ")
    return "bg-primary/15 text-primary";
  return "bg-success/15 text-success";
}

function statusLabel(status: string) {
  if (status === "PUBLISHED") return "ประกาศแล้ว";
  if (status === "DRAFT") return "ฉบับร่าง";
  if (status === "LOCKED") return "ล็อกแล้ว";
  return status;
}

export function HrDashboardBoard() {
  const [date, setDate] = useState(todayKey);
  const [viewMode, setViewMode] = useState<ViewMode>("both");
  const [day, setDay] = useState<DayMetrics | null>(null);
  const [monthSummary, setMonthSummary] = useState<MonthSummary | null>(null);
  const [understaffed, setUnderstaffed] = useState<
    Array<{ shiftName: string; shortage: number }>
  >([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [shifts, setShifts] = useState<ShiftCell[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(true);
  const [error, setError] = useState("");

  const activePeriod = periods.find((item) => item.id === periodId) ?? null;
  const dateKeys = useMemo(
    () =>
      activePeriod
        ? eachDate(activePeriod.startDate, activePeriod.endDate)
        : [],
    [activePeriod],
  );

  const shiftMap = useMemo(() => {
    const map = new Map<string, ShiftCell[]>();
    for (const shift of shifts) {
      const key = `${shift.employeeId}|${shift.workDate}`;
      const list = map.get(key) ?? [];
      list.push(shift);
      map.set(key, list);
    }
    return map;
  }, [shifts]);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    setError("");
    try {
      const response = await fetch(`/api/hr/dashboard?date=${date}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? "โหลดภาพรวมไม่สำเร็จ");
      }
      const data = (await response.json()) as {
        day: DayMetrics;
        monthSummary: MonthSummary;
        understaffed: Array<{ shiftName: string; shortage: number }>;
      };
      setDay(data.day);
      setMonthSummary(data.monthSummary);
      setUnderstaffed(data.understaffed);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดไม่สำเร็จ");
      setDay(null);
      setMonthSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  }, [date]);

  const loadPeriods = useCallback(async () => {
    setLoadingRoster(true);
    try {
      const response = await fetch("/api/hr/schedule-periods", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("โหลดรอบตารางไม่สำเร็จ");
      const data = (await response.json()) as { periods: Period[] };
      const sorted = [...data.periods].sort((a, b) =>
        b.startDate.localeCompare(a.startDate),
      );
      setPeriods(sorted);
      setPeriodId((current) =>
        current && sorted.some((item) => item.id === current)
          ? current
          : pickCurrentPeriod(sorted, todayKey()),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดตารางไม่สำเร็จ");
      setPeriods([]);
      setPeriodId("");
      setLoadingRoster(false);
    }
  }, []);

  const loadRoster = useCallback(async (id: string) => {
    if (!id) {
      setEmployees([]);
      setShifts([]);
      setLoadingRoster(false);
      return;
    }
    setLoadingRoster(true);
    try {
      const response = await fetch(`/api/hr/schedule-periods/${id}?grid=1`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("โหลดตารางรอบนี้ไม่สำเร็จ");
      const data = (await response.json()) as {
        employees: EmployeeRow[];
        shifts: ShiftCell[];
        period: Period;
      };
      setEmployees(data.employees);
      setShifts(data.shifts);
      setPeriods((current) => {
        const exists = current.some((item) => item.id === data.period.id);
        if (exists) {
          return current.map((item) =>
            item.id === data.period.id ? { ...item, ...data.period } : item,
          );
        }
        return [data.period, ...current];
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดตารางไม่สำเร็จ");
      setEmployees([]);
      setShifts([]);
    } finally {
      setLoadingRoster(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void loadPeriods();
  }, [loadPeriods]);

  useEffect(() => {
    if (periodId) void loadRoster(periodId);
  }, [loadRoster, periodId]);

  const showSummary = viewMode === "summary" || viewMode === "both";
  const showRoster = viewMode === "roster" || viewMode === "both";

  const highlightMetrics = day
    ? [
        {
          label: "พนักงาน",
          value: day.totalEmployees,
          hint: `${day.dailyEmployees} รายวัน · ${day.monthlyEmployees} รายเดือน`,
          icon: UsersRound,
        },
        {
          label: "เข้าเวรวันนี้",
          value: day.scheduledToday,
          hint: `เข้างานแล้ว ${day.clockedIn} · ยังไม่ลง ${day.notClockedIn}`,
          icon: CalendarDays,
        },
        {
          label: "สถานะวันนี้",
          value: day.working,
          hint: `ทำงานอยู่ · เลิกแล้ว ${day.finished} · สาย ${day.late}`,
          icon: Clock3,
        },
        {
          label: "รออนุมัติ",
          value: day.pendingOtApprovals + day.pendingLeaveRequests,
          hint: `OT ${day.pendingOtApprovals} · ลา ${day.pendingLeaveRequests}`,
          icon: Umbrella,
        },
      ]
    : [];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border bg-gradient-to-r from-primary/8 via-surface to-secondary/10 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-primary">
                ตัวเลือกการแสดงผล
              </p>
              <div
                className="inline-flex rounded-2xl border border-border bg-background p-1"
                role="tablist"
                aria-label="โหมดแสดงผล"
              >
                {(
                  [
                    { id: "summary", label: "สรุป", icon: LayoutGrid },
                    { id: "roster", label: "ตารางงาน", icon: Table2 },
                    { id: "both", label: "ทั้งหมด", icon: CalendarDays },
                  ] as const
                ).map((item) => {
                  const active = viewMode === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setViewMode(item.id)}
                      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <item.icon size={15} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              {showSummary ? (
                <label className="min-w-[11rem] text-sm">
                  <span className="mb-1 block text-muted-foreground">วันที่สรุป</span>
                  <DateSelector date={date} setDate={setDate} />
                </label>
              ) : null}
              {showRoster ? (
                <label className="min-w-[16rem] flex-1 text-sm sm:max-w-md">
                  <span className="mb-1 block text-muted-foreground">
                    รอบตารางงาน
                  </span>
                  <select
                    value={periodId}
                    onChange={(event) => setPeriodId(event.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2"
                  >
                    <option value="">ยังไม่มีรอบตาราง</option>
                    {periods.map((period) => (
                      <option key={period.id} value={period.id}>
                        {period.name} · {period.startDate} – {period.endDate} (
                        {statusLabel(period.status)})
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          </div>
        </div>

        {activePeriod && showRoster ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm text-muted-foreground sm:px-5">
            <span>
              กำลังแสดง{" "}
              <span className="font-medium text-foreground">
                {activePeriod.name}
              </span>
            </span>
            <span>
              {activePeriod.startDate} → {activePeriod.endDate}
            </span>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
              {statusLabel(activePeriod.status)}
            </span>
            <span>
              {employees.length} คน · {dateKeys.length} วัน
            </span>
          </div>
        ) : null}
      </section>

      {error ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {showSummary ? (
        <section className="space-y-4">
          {loadingSummary ? (
            <p className="rounded-3xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground shadow-sm">
              กำลังโหลดสรุป...
            </p>
          ) : !day ? (
            <p className="rounded-3xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground shadow-sm">
              ไม่มีข้อมูลสรุป
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {highlightMetrics.map((card) => (
                  <article
                    key={card.label}
                    className="rounded-3xl border border-border bg-surface p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">{card.label}</p>
                      <span className="grid h-9 w-9 place-items-center rounded-2xl bg-primary/10 text-primary">
                        <card.icon size={16} />
                      </span>
                    </div>
                    <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                      {card.value}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
                  </article>
                ))}
              </div>

              <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
                <section className="rounded-3xl border border-border bg-surface p-4 shadow-sm sm:p-5">
                  <h2 className="text-sm font-semibold text-foreground">
                    รายละเอียดวันนี้
                  </h2>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {[
                      ["ขาดงาน", day.absent],
                      ["ลา", day.onLeave],
                      ["กะขาดคน", day.understaffedCount],
                      ["ประมาณการค่าจ้าง", `${money(day.estimatedPayroll)} บาท`],
                    ].map(([label, value]) => (
                      <div
                        key={String(label)}
                        className="flex items-center justify-between rounded-2xl bg-muted/50 px-3 py-2.5 text-sm"
                      >
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium text-foreground">{value}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-3xl border border-border bg-surface p-4 shadow-sm sm:p-5">
                  <h2 className="text-sm font-semibold text-foreground">
                    สรุปรายเดือน
                  </h2>
                  {monthSummary ? (
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">ชั่วโมงทำงาน</span>
                        <span className="font-medium">
                          {(monthSummary.workedMinutes / 60).toFixed(1)} ชม.
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">OT</span>
                        <span className="font-medium">
                          {(monthSummary.otMinutes / 60).toFixed(1)} ชม.
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-muted-foreground">ขาด / ลา</span>
                        <span className="font-medium">
                          {monthSummary.absentDays} /{" "}
                          {monthSummary.approvedLeaveDays} วัน
                        </span>
                      </div>
                      <div className="flex justify-between gap-3 border-t border-border pt-2">
                        <span className="text-muted-foreground">
                          ประมาณการทั้งเดือน
                        </span>
                        <span className="font-semibold">
                          {money(monthSummary.estimatedMonthlyPayroll)} บาท
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">ไม่มีสรุปรายเดือน</p>
                  )}
                </section>
              </div>

              {understaffed.length > 0 ? (
                <section className="rounded-3xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
                  <p className="font-semibold">กะที่ขาดคนวันนี้</p>
                  <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                    {understaffed.map((item) => (
                      <li key={item.shiftName}>
                        {item.shiftName} ขาด {item.shortage} คน
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {showRoster ? (
        <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
            <div>
              <h2 className="font-semibold text-foreground">ตารางงานรอบนี้</h2>
              <p className="text-xs text-muted-foreground">
                แสดงอย่างเดียว — แก้ไขได้ที่เมนูตารางงาน
              </p>
            </div>
          </div>

          {loadingRoster ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              กำลังโหลดตาราง...
            </p>
          ) : !activePeriod ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              ยังไม่มีรอบตารางงาน — สร้างรอบได้ที่เมนูตารางงาน
            </p>
          ) : employees.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              ยังไม่มีพนักงานในตารางรอบนี้
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted/40 text-left">
                    <th className="sticky left-0 z-10 min-w-[10rem] border-b border-border bg-muted/80 px-3 py-2.5 font-medium backdrop-blur">
                      พนักงาน
                    </th>
                    {dateKeys.map((key) => {
                      const dayNum = key.slice(8);
                      const isToday = key === todayKey();
                      return (
                        <th
                          key={key}
                          className={`min-w-[3.25rem] border-b border-border px-1 py-2.5 text-center text-xs font-medium ${
                            isToday
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground"
                          }`}
                        >
                          {dayNum}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr
                      key={employee.id}
                      className="border-b border-border/70 hover:bg-muted/20"
                    >
                      <td className="sticky left-0 z-10 border-r border-border/60 bg-surface px-3 py-2 backdrop-blur">
                        <p className="font-medium text-foreground">
                          {employee.name}
                        </p>
                        {employee.employeeCode ? (
                          <p className="text-xs text-muted-foreground">
                            {employee.employeeCode}
                          </p>
                        ) : null}
                      </td>
                      {dateKeys.map((key) => {
                        const cells = shiftMap.get(`${employee.id}|${key}`) ?? [];
                        const labels = cells
                          .map((cell) => badgeFor(cell))
                          .filter((label): label is string => Boolean(label));
                        const isToday = key === todayKey();
                        return (
                          <td
                            key={key}
                            className={`px-1 py-1.5 text-center align-middle ${
                              isToday ? "bg-primary/5" : ""
                            }`}
                          >
                            {labels.length === 0 ? (
                              <span className="text-xs text-muted-foreground/40">
                                ·
                              </span>
                            ) : (
                              <div className="flex flex-col items-center gap-0.5">
                                {labels.map((label) => (
                                  <span
                                    key={`${key}-${label}`}
                                    className={`inline-flex max-w-full truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-tight ${badgeClass(label)}`}
                                  >
                                    {label}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
