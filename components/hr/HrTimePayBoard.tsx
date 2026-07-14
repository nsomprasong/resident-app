"use client";

import { Check, MapPin, Save, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useEmployeePermissions } from "@/components/auth/EmployeePermissionsProvider";
import { HrAttendanceBoard } from "@/components/hr/HrAttendanceBoard";
import { HrLeaveBoard } from "@/components/hr/HrLeaveBoard";
import { describeGeolocationFailure } from "@/lib/hr/geo";

const tabs = [
  { id: "attendance", label: "ลงเวลา" },
  { id: "leave", label: "การลา" },
  { id: "ot", label: "OT" },
  { id: "summary", label: "สรุปค่าแรง" },
  { id: "settings", label: "ตั้งค่าหมุด" },
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
  const canManageSettings = can("hr.settings.manage");
  const canApprove = can("hr.attendance.approve") || can("hr.overtime.manage");

  const [tab, setTab] = useState<TabId>("attendance");

  const visibleTabs = useMemo(
    () => tabs.filter((item) => item.id !== "settings" || canManageSettings),
    [canManageSettings],
  );

  function selectTab(next: TabId) {
    setTab(next);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get("tab");
    if (isTabId(requested) && (requested !== "settings" || canManageSettings)) {
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

      {tab === "attendance" ? <HrAttendanceBoard /> : null}
      {tab === "leave" ? <HrLeaveBoard /> : null}
      {tab === "ot" ? <OtApprovalPanel canApprove={canApprove} /> : null}
      {tab === "summary" ? <PaySummaryPanel /> : null}
      {tab === "settings" && canManageSettings ? <AttendanceSettingsPanel /> : null}
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
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2"
            />
          </label>
          <label>
            <span className="mb-1 block text-muted-foreground">ถึงวันที่</span>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2"
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
                    {item.employeeName} · {item.workDate}
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
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2"
            />
          </label>
          <label>
            <span className="mb-1 block text-muted-foreground">ถึงวันที่</span>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2"
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

type AttendanceSettings = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
  maxAccuracyMeters: number;
  timezone: string;
  allowClockWithoutSchedule: boolean;
  updatedAt: string;
};

function AttendanceSettingsPanel() {
  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [locating, setLocating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/hr/attendance-settings", {
        cache: "no-store",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? "โหลดการตั้งค่าไม่สำเร็จ");
      }
      const data = (await response.json()) as AttendanceSettings;
      setSettings(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "โหลดการตั้งค่าไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function useCurrentLocation() {
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setError(describeGeolocationFailure(new Error("insecure")));
      return;
    }
    if (!navigator.geolocation) {
      setError("อุปกรณ์นี้ไม่รองรับ GPS");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSettings((prev) =>
          prev
            ? {
                ...prev,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              }
            : prev,
        );
        setLocating(false);
      },
      (geoError) => {
        setError(describeGeolocationFailure(geoError));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/hr/attendance-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: settings.latitude,
          longitude: settings.longitude,
          radiusMeters: settings.radiusMeters,
          maxAccuracyMeters: settings.maxAccuracyMeters,
          timezone: settings.timezone,
          allowClockWithoutSchedule: settings.allowClockWithoutSchedule,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | (AttendanceSettings & { message?: string })
        | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? "บันทึกการตั้งค่าไม่สำเร็จ");
      }
      if (payload) setSettings(payload);
      setMessage("บันทึกการตั้งค่าหมุดแล้ว");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "บันทึกการตั้งค่าไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) {
    return (
      <div className="rounded-3xl border border-border bg-surface p-4 text-sm text-muted-foreground shadow-sm">
        กำลังโหลด...
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-3xl border border-border bg-surface p-4 shadow-sm">
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

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">ละติจูด (Latitude)</span>
          <input
            type="number"
            step="0.000001"
            value={settings.latitude}
            onChange={(event) =>
              setSettings({ ...settings, latitude: Number(event.target.value) })
            }
            className="w-full rounded-xl border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">ลองจิจูด (Longitude)</span>
          <input
            type="number"
            step="0.000001"
            value={settings.longitude}
            onChange={(event) =>
              setSettings({ ...settings, longitude: Number(event.target.value) })
            }
            className="w-full rounded-xl border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">รัศมีที่อนุญาต (เมตร)</span>
          <input
            type="number"
            value={settings.radiusMeters}
            onChange={(event) =>
              setSettings({ ...settings, radiusMeters: Number(event.target.value) })
            }
            className="w-full rounded-xl border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">
            ความแม่นยำ GPS สูงสุดที่ยอมรับ (เมตร)
          </span>
          <input
            type="number"
            value={settings.maxAccuracyMeters}
            onChange={(event) =>
              setSettings({
                ...settings,
                maxAccuracyMeters: Number(event.target.value),
              })
            }
            className="w-full rounded-xl border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">เขตเวลา</span>
          <input
            type="text"
            value={settings.timezone}
            onChange={(event) =>
              setSettings({ ...settings, timezone: event.target.value })
            }
            className="w-full rounded-xl border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="flex items-center gap-2 text-sm sm:mt-6">
          <input
            type="checkbox"
            checked={settings.allowClockWithoutSchedule}
            onChange={(event) =>
              setSettings({
                ...settings,
                allowClockWithoutSchedule: event.target.checked,
              })
            }
            className="h-4 w-4 rounded border-border"
          />
          <span>อนุญาตให้ลงเวลาได้แม้ไม่มีตารางงานวันนี้</span>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={locating}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm hover:bg-muted disabled:opacity-60"
        >
          <MapPin size={16} />
          {locating ? "กำลังอ่านตำแหน่ง..." : "ใช้ตำแหน่งปัจจุบัน"}
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          <Save size={16} />
          {saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
        </button>
      </div>
    </div>
  );
}
