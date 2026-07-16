"use client";

import {
  Banknote,
  CalendarDays,
  Clock3,
  Umbrella,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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

type QuickAction = { label: string; href: string };

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

export function HrDashboardBoard() {
  const [date, setDate] = useState(todayKey);
  const [day, setDay] = useState<DayMetrics | null>(null);
  const [monthSummary, setMonthSummary] = useState<MonthSummary | null>(null);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [understaffed, setUnderstaffed] = useState<
    Array<{ shiftName: string; shortage: number }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
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
        quickActions: QuickAction[];
        understaffed: Array<{
          shiftName: string;
          shortage: number;
        }>;
      };
      setDay(data.day);
      setMonthSummary(data.monthSummary);
      setQuickActions(data.quickActions);
      setUnderstaffed(data.understaffed);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดไม่สำเร็จ");
      setDay(null);
      setMonthSummary(null);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const cards = day
    ? [
        { label: "พนักงานทั้งหมด", value: day.totalEmployees, icon: UsersRound },
        { label: "รายวัน / รายเดือน", value: `${day.dailyEmployees}/${day.monthlyEmployees}`, icon: UsersRound },
        { label: "เข้าเวรวันนี้", value: day.scheduledToday, icon: CalendarDays },
        { label: "เข้างานแล้ว", value: day.clockedIn, icon: Clock3 },
        { label: "ยังไม่ลงเวลา", value: day.notClockedIn, icon: Clock3 },
        { label: "มาสาย", value: day.late, icon: Clock3 },
        { label: "ขาดงาน", value: day.absent, icon: Clock3 },
        { label: "ลา", value: day.onLeave, icon: Umbrella },
        { label: "กำลังทำงาน", value: day.working, icon: Clock3 },
        { label: "เลิกงานแล้ว", value: day.finished, icon: Clock3 },
        { label: "OT รออนุมัติ", value: day.pendingOtApprovals, icon: Clock3 },
        { label: "ลารออนุมัติ", value: day.pendingLeaveRequests, icon: Umbrella },
        { label: "กะขาดคน", value: day.understaffedCount, icon: CalendarDays },
        {
          label: "ประมาณการค่าจ้างวันนี้",
          value: money(day.estimatedPayroll),
          icon: Banknote,
        },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <label className="min-w-[12rem] text-sm">
          <span className="mb-1 block text-muted-foreground">วันที่</span>
          <DateSelector date={date} setDate={setDate} />
        </label>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted"
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="rounded-3xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground shadow-sm">
          กำลังโหลดภาพรวม...
        </p>
      ) : !day ? (
        <p className="rounded-3xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground shadow-sm">
          ไม่มีข้อมูลภาพรวม
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-border bg-surface p-4 shadow-sm"
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <card.icon size={16} />
                  <p className="text-sm">{card.label}</p>
                </div>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {card.value}
                </p>
              </div>
            ))}
          </div>

          {monthSummary ? (
            <section className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
              <h2 className="font-semibold">สรุปรายเดือน</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                <p>
                  ชั่วโมงทำงาน:{" "}
                  <span className="font-medium">
                    {(monthSummary.workedMinutes / 60).toFixed(1)} ชม.
                  </span>
                </p>
                <p>
                  OT:{" "}
                  <span className="font-medium">
                    {(monthSummary.otMinutes / 60).toFixed(1)} ชม.
                  </span>
                </p>
                <p>
                  ขาดงาน:{" "}
                  <span className="font-medium">{monthSummary.absentDays} วัน</span>
                </p>
                <p>
                  ลาที่อนุมัติ:{" "}
                  <span className="font-medium">
                    {monthSummary.approvedLeaveDays} วัน
                  </span>
                </p>
                <p className="sm:col-span-2">
                  ประมาณการเงินเดือนทั้งเดือน:{" "}
                  <span className="font-medium">
                    {money(monthSummary.estimatedMonthlyPayroll)} บาท
                  </span>
                </p>
              </div>
            </section>
          ) : null}

          {understaffed.length > 0 ? (
            <section className="rounded-3xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
              <p className="font-semibold">กะที่ขาดคนวันนี้</p>
              <ul className="mt-2 space-y-1">
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
    </div>
  );
}
