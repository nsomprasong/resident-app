"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import DateSelector from "@/components/ui/DateSelector";
import { formatThaiDate } from "@/lib/format/date";
import type { ShiftTemplateRecord } from "@/lib/hr/shift-templates";
import {
  addDaysToDateKey,
  monthRangeContaining,
  weekRangeContaining,
} from "@/lib/hr/schedules";

type ViewMode = "day" | "week" | "month";

type ScheduleItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  shiftTemplateId: string | null;
  shiftName: string;
  shiftColor: string | null;
  workDate: string;
  startsAt: string;
  endsAt: string;
};

type HolidayItem = {
  id: string;
  name: string;
  holidayDate: string;
  isDayOff: boolean;
};

type LeaveMarker = {
  employeeId: string;
  date: string;
  label: string;
  duration?: string;
};

type Understaffed = {
  workDate: string;
  shiftTemplateId: string;
  shiftName: string;
  requiredHeadcount: number;
  assignedCount: number;
  shortage: number;
};

type EmployeeOption = {
  id: string;
  name: string;
  employeeCode: string | null;
};

function todayKey() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatTimeRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const fmt = new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
  return `${fmt.format(start)}–${fmt.format(end)}`;
}

export function HrSchedulesBoard() {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [view, setView] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState(todayKey);
  const [templates, setTemplates] = useState<ShiftTemplateRecord[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [leaveMarkers, setLeaveMarkers] = useState<LeaveMarker[]>([]);
  const [understaffed, setUnderstaffed] = useState<Understaffed[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [templateForm, setTemplateForm] = useState({
    name: "",
    startTime: "08:00",
    endTime: "17:00",
    breakMinutes: "60",
    requiredHeadcount: "1",
  });
  const [assignForm, setAssignForm] = useState({
    employeeId: "",
    shiftTemplateId: "",
    workDate: todayKey(),
  });

  const range = useMemo(() => {
    if (view === "day") return { from: anchor, to: anchor };
    if (view === "week") return weekRangeContaining(anchor) ?? { from: anchor, to: anchor };
    return monthRangeContaining(anchor) ?? { from: anchor, to: anchor };
  }, [anchor, view]);

  const dateKeys = useMemo(() => {
    const keys: string[] = [];
    let cursor = range.from;
    while (cursor && cursor <= range.to) {
      keys.push(cursor);
      cursor = addDaysToDateKey(cursor, 1) ?? "";
      if (!cursor) break;
    }
    return keys;
  }, [range]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [templateRes, scheduleRes, employeeRes] = await Promise.all([
        fetch("/api/hr/shift-templates", { cache: "no-store" }),
        fetch(
          `/api/hr/schedules?from=${range.from}&to=${range.to}`,
          { cache: "no-store" },
        ),
        fetch("/api/hr/employees?pageSize=50", {
          cache: "no-store",
        }),
      ]);
      if (!templateRes.ok || !scheduleRes.ok) {
        throw new Error("โหลดตารางไม่สำเร็จ");
      }
      const templateData = (await templateRes.json()) as ShiftTemplateRecord[];
      const scheduleData = (await scheduleRes.json()) as {
        schedules: ScheduleItem[];
        holidays: HolidayItem[];
        understaffed: Understaffed[];
        leaveMarkers?: LeaveMarker[];
      };
      setTemplates(templateData);
      setSchedules(scheduleData.schedules);
      setHolidays(scheduleData.holidays);
      setLeaveMarkers(scheduleData.leaveMarkers ?? []);
      setUnderstaffed(scheduleData.understaffed);
      if (employeeRes.ok) {
        const employeeData = (await employeeRes.json()) as {
          items: Array<{
            id: string;
            name: string;
            employeeCode: string | null;
            hrStatus: string;
          }>;
        };
        setEmployees(
          employeeData.items
            .filter((item) =>
              item.hrStatus === "ACTIVE" || item.hrStatus === "PROBATION",
            )
            .map((item) => ({
              id: item.id,
              name: item.name,
              employeeCode: item.employeeCode,
            })),
        );
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createTemplate() {
    setMessage("");
    setError("");
    const response = await fetch("/api/hr/shift-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: templateForm.name,
        startTime: templateForm.startTime,
        endTime: templateForm.endTime,
        breakMinutes: Number(templateForm.breakMinutes),
        requiredHeadcount: Number(templateForm.requiredHeadcount),
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    if (!response.ok) {
      setError(body?.message ?? "สร้างกะไม่สำเร็จ");
      return;
    }
    setTemplateForm({
      name: "",
      startTime: "08:00",
      endTime: "17:00",
      breakMinutes: "60",
      requiredHeadcount: "1",
    });
    setMessage("สร้างกะแล้ว");
    await load();
  }

  async function assignOne() {
    setMessage("");
    setError("");
    const response = await fetch("/api/hr/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "assign",
        ...assignForm,
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    if (!response.ok) {
      setError(body?.message ?? "จัดตารางไม่สำเร็จ");
      return;
    }
    setMessage("จัดกะสำเร็จ");
    await load();
  }

  async function copyWeek() {
    if (view !== "week") {
      setError("คัดลอกได้เฉพาะมุมมองรายสัปดาห์");
      return;
    }
    const targetFrom = addDaysToDateKey(range.from, 7);
    if (!targetFrom) return;
    setMessage("");
    setError("");
    const response = await fetch("/api/hr/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "copy",
        sourceFrom: range.from,
        sourceTo: range.to,
        targetFrom,
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      count?: number;
      skipped?: number;
    } | null;
    if (!response.ok) {
      setError(body?.message ?? "คัดลอกไม่สำเร็จ");
      return;
    }
    setMessage(
      `คัดลอกไปสัปดาห์ถัดไปแล้ว ${body?.count ?? 0} รายการ (ข้ามซ้อน ${body?.skipped ?? 0})`,
    );
    setAnchor(targetFrom);
  }

  async function cancelSchedule(id: string) {
    if (
      !(await confirm({
        title: "ยกเลิกกะนี้?",
        description: "กะที่เลือกจะถูกยกเลิกจากตารางงาน",
        confirmLabel: "ยกเลิกกะ",
        tone: "warning",
      }))
    ) {
      return;
    }
    const response = await fetch("/api/hr/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "cancel", scheduleId: id }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setError(body?.message ?? "ยกเลิกไม่สำเร็จ");
      return;
    }
    await load();
  }

  async function addHoliday(date: string) {
    const name = window.prompt("ชื่อวันหยุด", "วันหยุด");
    if (!name) return;
    const response = await fetch("/api/hr/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, holidayDate: date, isDayOff: true }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setError(body?.message ?? "บันทึกวันหยุดไม่สำเร็จ");
      return;
    }
    await load();
  }

  function shiftAnchor(delta: number) {
    const step = view === "day" ? 1 : view === "week" ? 7 : 30;
    const next = addDaysToDateKey(anchor, delta * step);
    if (next) setAnchor(next);
  }

  return (
    <div className="space-y-4">
      {confirmDialog}
      <div className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {(["day", "week", "month"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={`rounded-xl px-3 py-2 text-sm ${
                view === mode
                  ? "bg-primary text-primary-foreground"
                  : "border border-border hover:bg-muted"
              }`}
            >
              {mode === "day" ? "รายวัน" : mode === "week" ? "รายสัปดาห์" : "รายเดือน"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftAnchor(-1)}
            className="rounded-lg border border-border p-2 hover:bg-muted"
            aria-label="ก่อนหน้า"
          >
            <ChevronLeft size={16} />
          </button>
          <DateSelector
            date={anchor}
            setDate={setAnchor}
            className="min-w-[12rem]"
          />
          <button
            type="button"
            onClick={() => shiftAnchor(1)}
            className="rounded-lg border border-border p-2 hover:bg-muted"
            aria-label="ถัดไป"
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            onClick={() => void copyWeek()}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            <Copy size={16} />
            คัดลอกสัปดาห์
          </button>
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

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="space-y-4">
          <div className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="font-semibold text-foreground">ตั้งค่ากะ</h2>
            <div className="mt-3 space-y-3">
              <label className="block text-sm text-foreground">
                ชื่อกะ
                <input
                  value={templateForm.name}
                  onChange={(event) =>
                    setTemplateForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="เช่น กะเช้า"
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm text-foreground">
                  เริ่มงาน
                  <input
                    type="time"
                    value={templateForm.startTime}
                    onChange={(event) =>
                      setTemplateForm((current) => ({
                        ...current,
                        startTime: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm text-foreground">
                  เลิกงาน
                  <input
                    type="time"
                    value={templateForm.endTime}
                    onChange={(event) =>
                      setTemplateForm((current) => ({
                        ...current,
                        endTime: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm text-foreground">
                  พัก (นาที)
                  <input
                    value={templateForm.breakMinutes}
                    onChange={(event) =>
                      setTemplateForm((current) => ({
                        ...current,
                        breakMinutes: event.target.value,
                      }))
                    }
                    inputMode="numeric"
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm text-foreground">
                  จำนวนคนที่ต้องการ
                  <input
                    value={templateForm.requiredHeadcount}
                    onChange={(event) =>
                      setTemplateForm((current) => ({
                        ...current,
                        requiredHeadcount: event.target.value,
                      }))
                    }
                    inputMode="numeric"
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => void createTemplate()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground"
              >
                <Plus size={16} />
                เพิ่มกะ
              </button>
            </div>
            <ul className="mt-4 space-y-2">
              {templates.map((template) => (
                <li
                  key={template.id}
                  className="rounded-2xl border border-border bg-background px-3 py-2 text-sm"
                >
                  <p className="font-medium">{template.name}</p>
                  <p className="text-muted-foreground">
                    {template.startTime}–{template.endTime} · ต้องการ{" "}
                    {template.requiredHeadcount} คน
                  </p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="font-semibold text-foreground">จัดพนักงานลงกะ</h2>
            <div className="mt-3 space-y-2">
              <select
                value={assignForm.employeeId}
                onChange={(event) =>
                  setAssignForm((current) => ({
                    ...current,
                    employeeId: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">เลือกพนักงาน</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.employeeCode ? `${employee.employeeCode} · ` : ""}
                    {employee.name}
                  </option>
                ))}
              </select>
              <select
                value={assignForm.shiftTemplateId}
                onChange={(event) =>
                  setAssignForm((current) => ({
                    ...current,
                    shiftTemplateId: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">เลือกกะ</option>
                {templates
                  .filter((template) => template.isActive)
                  .map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
              </select>
              <label className="block text-sm text-foreground">
                วันที่ทำงาน
                <div className="mt-1">
                  <DateSelector
                    date={assignForm.workDate}
                    setDate={(workDate) =>
                      setAssignForm((current) => ({ ...current, workDate }))
                    }
                    className="w-full"
                  />
                </div>
              </label>
              <button
                type="button"
                onClick={() => void assignOne()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm hover:bg-muted"
              >
                <CalendarDays size={16} />
                จัดลงตาราง
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {understaffed.length > 0 ? (
            <div className="rounded-3xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
              <p className="font-semibold">กะที่ขาดคน ({understaffed.length})</p>
              <ul className="mt-2 space-y-1">
                {understaffed.slice(0, 8).map((item) => (
                  <li key={`${item.workDate}-${item.shiftTemplateId}`}>
                    {formatThaiDate(item.workDate)} · {item.shiftName} ขาด{" "}
                    {item.shortage} คน
                    (มี {item.assignedCount}/{item.requiredHeadcount})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
            {loading ? (
              <p className="p-6 text-sm text-muted-foreground">กำลังโหลดตาราง...</p>
            ) : (
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {dateKeys.map((dateKey) => {
                  const daySchedules = schedules.filter(
                    (item) => item.workDate === dateKey,
                  );
                  const dayHolidays = holidays.filter(
                    (item) => item.holidayDate === dateKey,
                  );
                  const dayLeaves = leaveMarkers.filter(
                    (item) => item.date === dateKey,
                  );
                  return (
                    <div
                      key={dateKey}
                      className="rounded-2xl border border-border bg-background p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-foreground">
                            {formatThaiDate(dateKey)}
                          </p>
                          {dayHolidays.map((holiday) => (
                            <p
                              key={holiday.id}
                              className="text-xs text-secondary"
                            >
                              วันหยุด: {holiday.name}
                            </p>
                          ))}
                          {dayLeaves.map((leave) => (
                            <p
                              key={`${leave.employeeId}-${leave.date}-${leave.label}`}
                              className="text-xs text-muted-foreground"
                            >
                              ลา: {leave.label}
                              {leave.duration && leave.duration !== "FULL_DAY"
                                ? ` (${leave.duration})`
                                : ""}
                            </p>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => void addHoliday(dateKey)}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          +วันหยุด
                        </button>
                      </div>
                      <ul className="mt-3 space-y-2">
                        {daySchedules.length === 0 ? (
                          <li className="text-xs text-muted-foreground">
                            ยังไม่มีกะ
                          </li>
                        ) : (
                          daySchedules.map((item) => (
                            <li
                              key={item.id}
                              className="rounded-xl border border-border px-2.5 py-2 text-xs"
                              style={{
                                borderLeftColor: item.shiftColor ?? undefined,
                                borderLeftWidth: item.shiftColor ? 4 : undefined,
                              }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-medium text-foreground">
                                    {item.employeeName}
                                  </p>
                                  <p className="text-muted-foreground">
                                    {item.shiftName} ·{" "}
                                    {formatTimeRange(item.startsAt, item.endsAt)}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void cancelSchedule(item.id)}
                                  className="rounded-lg p-1 hover:bg-muted"
                                  aria-label="ยกเลิกกะ"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
