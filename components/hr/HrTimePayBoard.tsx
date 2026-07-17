"use client";

import { Check, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useEmployeePermissions } from "@/components/auth/EmployeePermissionsProvider";
import { HrAttendanceBoard } from "@/components/hr/HrAttendanceBoard";
import { HrLeaveBoard } from "@/components/hr/HrLeaveBoard";
import DateSelector from "@/components/ui/DateSelector";
import { formatThaiDate } from "@/lib/format/date";

const tabs = [
  { id: "attendance", label: "ลงเวลา" },
  { id: "leave", label: "การลา" },
  { id: "ot", label: "OT" },
  { id: "summary", label: "สรุปค่าแรง" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function isTabId(value: string | null): value is TabId {
  return tabs.some((tab) => tab.id === value);
}

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

function firstDayOfMonthKey() {
  const today = todayKey();
  return `${today.slice(0, 7)}-01`;
}

export function HrTimePayBoard() {
  const router = useRouter();
  const pathname = usePathname();
  const { can } = useEmployeePermissions();
  const canApprove = can("hr.attendance.approve") || can("hr.overtime.manage");

  const [tab, setTab] = useState<TabId>("attendance");

  const visibleTabs = useMemo(() => tabs, []);

  function selectTab(next: TabId) {
    setTab(next);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("tab");
    if (requested === "settings") {
      router.replace("/hr/settings");
      return;
    }
    if (isTabId(requested)) {
      setTab(requested);
    }
    // Only sync from the URL once on mount; user-driven tab switches update it after.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      <nav className="flex gap-1.5 overflow-x-auto rounded-2xl border border-border bg-surface p-1.5 shadow-sm">
        {visibleTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectTab(item.id)}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              tab === item.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "attendance" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            ลงเวลาและเปิดรายการจากตาราง — ตั้งค่าหมุด GPS ไปที่{" "}
            <a
              href="/hr/settings"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              ตั้งค่าระบบพนักงาน
            </a>
            {" · "}ตรวจสอบรายการผิดปกติไปที่{" "}
            <a
              href="/hr/attendance-review"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              ตรวจสอบเวลาเข้า–ออก
            </a>
          </p>
          <HrAttendanceBoard />
        </div>
      ) : null}
      {tab === "leave" ? <HrLeaveBoard /> : null}
      {tab === "ot" ? <OtApprovalPanel canApprove={canApprove} /> : null}
      {tab === "summary" ? <PaySummaryPanel /> : null}
    </div>
  );
}

type OtPending = {
  id: string;
  reason: string;
  proposedOtMinutes: number | null;
  workDate: string;
  employeeName: string;
};

function OtApprovalPanel({ canApprove }: { canApprove: boolean }) {
  const [from, setFrom] = useState(firstDayOfMonthKey);
  const [to, setTo] = useState(todayKey);
  const [pending, setPending] = useState<OtPending[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/hr/attendance?from=${from}&to=${to}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? "โหลดไม่สำเร็จ");
      }
      const data = (await response.json()) as {
        pendingApprovals: Array<{
          id: string;
          type: string;
          reason: string;
          proposedOtMinutes: number | null;
          workDate: string;
          employeeName: string;
        }>;
      };
      setPending(
        data.pendingApprovals.filter((item) => item.type === "OT_REQUEST"),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(adjustmentId: string, decision: "APPROVED" | "REJECTED") {
    setError("");
    setMessage("");
    const response = await fetch("/api/hr/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "review", adjustmentId, decision }),
    });
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    if (!response.ok) {
      setError(payload?.message ?? "ดำเนินการไม่สำเร็จ");
      return;
    }
    setMessage(decision === "APPROVED" ? "อนุมัติ OT แล้ว" : "ไม่อนุมัติ OT แล้ว");
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-3 text-sm">
          <label>
            <span className="mb-1 block text-muted-foreground">จากวันที่</span>
            <DateSelector
              date={from}
              setDate={setFrom}
              max={to}
              className="min-w-[12rem]"
            />
          </label>
          <label>
            <span className="mb-1 block text-muted-foreground">ถึงวันที่</span>
            <DateSelector
              date={to}
              setDate={setTo}
              min={from}
              className="min-w-[12rem]"
            />
          </label>
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          {message}
        </p>
      ) : null}

      <section className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="font-semibold">คำขอ OT รออนุมัติ ({pending.length})</h2>
        {loading ? (
          <p className="mt-3 text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : pending.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">ไม่มีคำขอ OT รออนุมัติในช่วงนี้</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {pending.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="text-sm">
                  <p className="font-medium">
                    {item.employeeName} · {formatThaiDate(item.workDate)}
                  </p>
                  <p className="text-muted-foreground">{item.reason}</p>
                  {item.proposedOtMinutes !== null ? (
                    <p className="text-muted-foreground">
                      ขอ OT {(item.proposedOtMinutes / 60).toFixed(1)} ชม.
                    </p>
                  ) : null}
                </div>
                {canApprove ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void review(item.id, "APPROVED")}
                      className="inline-flex items-center gap-1 rounded-xl bg-success/15 px-3 py-2 text-sm text-success"
                    >
                      <Check size={14} />
                      อนุมัติ
                    </button>
                    <button
                      type="button"
                      onClick={() => void review(item.id, "REJECTED")}
                      className="inline-flex items-center gap-1 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                      <X size={14} />
                      ไม่อนุมัติ
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

type PaySummaryEmployee = {
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  employmentType: string;
  daysPresent: number;
  daysAbsent: number;
  daysOnLeave: number;
  totalWorkedMinutes: number;
  otApprovedMinutes: number;
  otHours: number;
  basePay: number;
  otPay: number;
  totalPay: number;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("th-TH", { maximumFractionDigits: 2 }).format(value);
}

function formatHoursFromMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  return `${hours}:${String(mins).padStart(2, "0")}`;
}

function PaySummaryPanel() {
  const [from, setFrom] = useState(firstDayOfMonthKey);
  const [to, setTo] = useState(todayKey);
  const [employees, setEmployees] = useState<PaySummaryEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/hr/time-pay/summary?from=${from}&to=${to}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? "โหลดสรุปค่าแรงไม่สำเร็จ");
      }
      const data = (await response.json()) as { employees: PaySummaryEmployee[] };
      setEmployees(data.employees);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "โหลดสรุปค่าแรงไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(
    () =>
      employees.reduce(
        (acc, item) => ({
          basePay: acc.basePay + item.basePay,
          otPay: acc.otPay + item.otPay,
          totalPay: acc.totalPay + item.totalPay,
        }),
        { basePay: 0, otPay: 0, totalPay: 0 },
      ),
    [employees],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap gap-3 text-sm">
          <label>
            <span className="mb-1 block text-muted-foreground">จากวันที่</span>
            <DateSelector
              date={from}
              setDate={setFrom}
              max={to}
              className="min-w-[12rem]"
            />
          </label>
          <label>
            <span className="mb-1 block text-muted-foreground">ถึงวันที่</span>
            <DateSelector
              date={to}
              setDate={setTo}
              min={from}
              className="min-w-[12rem]"
            />
          </label>
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["ค่าแรงพื้นฐานรวม", formatCurrency(totals.basePay)],
          ["ค่า OT รวม", formatCurrency(totals.otPay)],
          ["รวมทั้งหมด", formatCurrency(totals.totalPay)],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-border bg-surface p-4 shadow-sm"
          >
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-3">พนักงาน</th>
                <th className="px-4 py-3">มา/ขาด/ลา</th>
                <th className="px-4 py-3">ชั่วโมงทำงาน</th>
                <th className="px-4 py-3">OT (ชม./บาท)</th>
                <th className="px-4 py-3">ค่าแรงพื้นฐาน</th>
                <th className="px-4 py-3">รวม</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    กำลังโหลด...
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    ไม่มีข้อมูลในช่วงที่เลือก
                  </td>
                </tr>
              ) : (
                employees.map((item) => (
                  <tr key={item.employeeId} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.employeeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.employeeCode ?? "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {item.daysPresent} / {item.daysAbsent} / {item.daysOnLeave}
                    </td>
                    <td className="px-4 py-3">
                      {formatHoursFromMinutes(item.totalWorkedMinutes)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {item.otHours.toFixed(1)} ชม. · {formatCurrency(item.otPay)}
                    </td>
                    <td className="px-4 py-3">{formatCurrency(item.basePay)}</td>
                    <td className="px-4 py-3 font-medium">
                      {formatCurrency(item.totalPay)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
