"use client";

import {
  Check,
  Clock3,
  Lock,
  Pencil,
  Play,
  Square,
  Timer,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useEmployeePermissions } from "@/components/auth/EmployeePermissionsProvider";
import DateSelector from "@/components/ui/DateSelector";
import {
  formatAttendanceClockTime,
  formatThaiDate,
} from "@/lib/format/date";
import { displayEmployeeName } from "@/lib/hr/employees";
import {
  bangkokDateTimeFromParts,
  isoToBangkokTimeInput,
} from "@/lib/hr/attendance-time-edit";

type AttendanceRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  shiftName: string | null;
  workDate: string;
  clockIn: string | null;
  clockOut: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  otMinutes: number;
  otApprovedMinutes: number;
  status: string;
};

type AttendanceFilter =
  | "ALL"
  | "NEEDS_REVIEW"
  | "LATE"
  | "NO_CLOCK_OUT"
  | "OFF_SCHEDULE"
  | "OT"
  | "ABSENT";

type PendingApproval = {
  id: string;
  type: string;
  reason: string;
  proposedOtMinutes: number | null;
  workDate: string;
  employeeId: string;
  employeeName: string;
};

type EmployeeOption = {
  id: string;
  name: string;
};

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

function formatMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  return `${hours}:${String(mins).padStart(2, "0")}`;
}

function formatTime(value: string | null) {
  if (!value) return "-";
  return formatAttendanceClockTime(value);
}

export type HrAttendanceBoardProps = {
  variant?: "default" | "review";
};

export function HrAttendanceBoard({
  variant = "default",
}: HrAttendanceBoardProps = {}) {
  const isReview = variant === "review";
  const { can } = useEmployeePermissions();
  const canApprove = can("hr.attendance.approve");
  const canEditTime =
    can("hr.attendance.approve") || can("hr.attendance.manage");
  const [workDate, setWorkDate] = useState(todayKey);
  const [filterEmployeeId, setFilterEmployeeId] = useState("");
  const [filterWorkDate, setFilterWorkDate] = useState("");
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [approveOtRow, setApproveOtRow] = useState<AttendanceRow | null>(null);
  const [otMinutes, setOtMinutes] = useState("60");
  const [otReason, setOtReason] = useState("");
  const [editRow, setEditRow] = useState<AttendanceRow | null>(null);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editClearIn, setEditClearIn] = useState(false);
  const [editClearOut, setEditClearOut] = useState(false);
  const [filter, setFilter] = useState<AttendanceFilter>(
    variant === "review" ? "ALL" : "NEEDS_REVIEW",
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (isReview) {
        if (filterWorkDate) {
          params.set("from", filterWorkDate);
          params.set("to", filterWorkDate);
        }
        if (filterEmployeeId) {
          params.set("employeeId", filterEmployeeId);
        }
      } else {
        params.set("from", workDate);
        params.set("to", workDate);
      }
      const query = params.toString();
      const dataRes = await fetch(
        `/api/hr/attendance${query ? `?${query}` : ""}`,
        { cache: "no-store" },
      );
      if (!dataRes.ok) {
        const body = (await dataRes.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(body?.message ?? "โหลดไม่สำเร็จ");
      }
      const data = (await dataRes.json()) as {
        records: AttendanceRow[];
        pendingApprovals: PendingApproval[];
      };
      setRecords(data.records);
      setPending(data.pendingApprovals);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [filterEmployeeId, filterWorkDate, isReview, workDate]);

  useEffect(() => {
    if (!isReview) return;
    void fetch("/api/hr/employees?pageSize=50&page=1", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return;
        const body = (await res.json()) as {
          items: Array<{
            id: string;
            name: string;
            firstName?: string | null;
            lastName?: string | null;
            nickname?: string | null;
            email?: string | null;
            employeeCode?: string | null;
          }>;
          totalPages?: number;
        };
        const firstPage = body.items ?? [];
        setEmployees(
          firstPage
            .map((item) => ({
              id: item.id,
              name: displayEmployeeName(item),
            }))
            .sort((a, b) => a.name.localeCompare(b.name, "th")),
        );
      })
      .catch(() => {
        /* optional list */
      });
  }, [isReview]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    return {
      total: records.length,
      needsReview: records.filter(
        (item) =>
          item.status === "PENDING_REVIEW" ||
          (item.clockIn && !item.clockOut) ||
          item.status === "OPEN",
      ).length,
      late: records.filter((item) => item.lateMinutes > 0).length,
      noClockOut: records.filter((item) => item.clockIn && !item.clockOut)
        .length,
      ot: records.filter((item) => item.otMinutes > 0).length,
      offSchedule: records.filter((item) => item.status === "PENDING_REVIEW")
        .length,
    };
  }, [records]);

  const filteredRecords = useMemo(() => {
    switch (filter) {
      case "NEEDS_REVIEW":
        return records.filter(
          (item) =>
            item.status === "PENDING_REVIEW" ||
            (item.clockIn && !item.clockOut) ||
            item.status === "OPEN",
        );
      case "LATE":
        return records.filter((item) => item.lateMinutes > 0);
      case "NO_CLOCK_OUT":
        return records.filter((item) => item.clockIn && !item.clockOut);
      case "OFF_SCHEDULE":
        return records.filter((item) => item.status === "PENDING_REVIEW");
      case "OT":
        return records.filter((item) => item.otMinutes > 0);
      case "ABSENT":
        return records.filter(
          (item) =>
            item.status === "ABSENT" || (!item.clockIn && !item.clockOut),
        );
      default:
        return records;
    }
  }, [filter, records]);

  async function postMode(body: Record<string, unknown>) {
    setError("");
    setMessage("");
    const response = await fetch("/api/hr/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
      created?: number;
    } | null;
    if (!response.ok) {
      setError(payload?.message ?? "ดำเนินการไม่สำเร็จ");
      return false;
    }
    if (typeof payload?.created === "number") {
      setMessage(`เปิดรายการจากตาราง ${payload.created} รายการ`);
    } else {
      setMessage("บันทึกแล้ว");
    }
    await load();
    return true;
  }

  function openEditModal(row: AttendanceRow) {
    setEditRow(row);
    setEditClockIn(isoToBangkokTimeInput(row.clockIn));
    setEditClockOut(isoToBangkokTimeInput(row.clockOut));
    setEditReason("");
    setEditClearIn(false);
    setEditClearOut(false);
  }

  async function saveTimeEdit() {
    if (!editRow) return;
    if (editReason.trim().length < 3) {
      setError("กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร");
      return;
    }
    const body: Record<string, unknown> = {
      mode: "correct-time",
      attendanceId: editRow.id,
      reason: editReason.trim(),
    };
    if (editClearIn) {
      body.clockIn = null;
    } else if (editClockIn) {
      const parsed = bangkokDateTimeFromParts(editRow.workDate, editClockIn);
      if (!parsed) {
        setError("รูปแบบเวลาเข้าไม่ถูกต้อง");
        return;
      }
      body.clockIn = parsed.toISOString();
    }
    if (editClearOut) {
      body.clockOut = null;
    } else if (editClockOut) {
      const parsed = bangkokDateTimeFromParts(editRow.workDate, editClockOut);
      if (!parsed) {
        setError("รูปแบบเวลาออกไม่ถูกต้อง");
        return;
      }
      body.clockOut = parsed.toISOString();
    }
    if (!("clockIn" in body) && !("clockOut" in body)) {
      setError("ระบุเวลาเข้าหรือเวลาออก หรือเลือกล้างค่า");
      return;
    }
    const ok = await postMode(body);
    if (ok) setEditRow(null);
  }

  function openApproveOtModal(row: AttendanceRow) {
    setApproveOtRow(row);
    setOtMinutes(
      String(
        row.otApprovedMinutes > 0
          ? row.otApprovedMinutes
          : Math.max(row.otMinutes, 0),
      ),
    );
    setOtReason(
      row.otApprovedMinutes > 0
        ? "ปรับการอนุมัติ OT"
        : row.otMinutes > 0
          ? "อนุมัติ OT ตามเวลาที่คำนวณจากการลงเวลา"
          : "อนุมัติ OT",
    );
  }

  async function saveOtApproval(otApprovedMinutes: number) {
    if (!approveOtRow) return;
    if (otReason.trim().length < 3) {
      setError("กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร");
      return;
    }
    if (
      otApprovedMinutes !== 0 &&
      (!Number.isFinite(otApprovedMinutes) || otApprovedMinutes <= 0)
    ) {
      setError("นาที OT ที่อนุมัติต้องมากกว่า 0");
      return;
    }
    const ok = await postMode({
      mode: "set-ot-approved",
      attendanceId: approveOtRow.id,
      otApprovedMinutes,
      reason: otReason.trim(),
    });
    if (ok) setApproveOtRow(null);
  }

  const filterSummary = useMemo(() => {
    if (!isReview) return null;
    const parts: string[] = [];
    if (filterEmployeeId) {
      const name =
        employees.find((item) => item.id === filterEmployeeId)?.name ??
        "ที่เลือก";
      parts.push(`พนักงาน: ${name}`);
    }
    if (filterWorkDate) {
      parts.push(`วันที่: ${formatThaiDate(filterWorkDate)}`);
    }
    if (parts.length === 0) {
      return "แสดงทั้งหมด (ล่าสุดไม่เกิน 5,000 รายการ)";
    }
    return parts.join(" · ");
  }, [employees, filterEmployeeId, filterWorkDate, isReview]);

  return (
    <div className="space-y-3">
      {isReview ? (
        <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <div className="flex flex-wrap items-end gap-2 border-b border-border px-3 py-2">
            <label className="min-w-[10rem] flex-1 text-sm">
              <span className="mb-0.5 block text-xs text-muted-foreground">
                พนักงาน
              </span>
              <select
                value={filterEmployeeId}
                onChange={(event) => setFilterEmployeeId(event.target.value)}
                className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
              >
                <option value="">ทั้งหมด</option>
                {employees.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="text-sm">
              <span className="mb-0.5 block text-xs text-muted-foreground">
                วันที่
              </span>
              <div className="flex items-center gap-1">
                {filterWorkDate ? (
                  <DateSelector
                    date={filterWorkDate}
                    setDate={setFilterWorkDate}
                    className="min-w-[10rem]"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setFilterWorkDate(todayKey())}
                    className="rounded-lg border border-dashed border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                  >
                    ทั้งหมด — กดเลือกวัน
                  </button>
                )}
                {filterWorkDate ? (
                  <button
                    type="button"
                    onClick={() => setFilterWorkDate("")}
                    className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted"
                    title="ล้างวันที่ (แสดงทั้งหมด)"
                    aria-label="ล้างตัวกรองวันที่"
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
          <p className="border-b border-border bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
            {filterSummary}
            {!loading ? (
              <>
                {" "}
                ·{" "}
                <span className="font-medium text-foreground">
                  {records.length}
                </span>{" "}
                รายการ
                {summary.needsReview > 0 ? (
                  <>
                    {" "}
                    ·{" "}
                    <span className="font-medium text-amber-700 dark:text-amber-400">
                      {summary.needsReview}
                    </span>{" "}
                    ต้องตรวจสอบ
                  </>
                ) : null}
              </>
            ) : null}
          </p>
          <div className="flex flex-wrap gap-1 px-2 py-2">
            {(
              [
                ["ทั้งหมด", summary.total, "ALL"],
                ["ต้องตรวจสอบ", summary.needsReview, "NEEDS_REVIEW"],
                ["มาสาย", summary.late, "LATE"],
                ["ไม่มีเวลาออก", summary.noClockOut, "NO_CLOCK_OUT"],
                ["นอกตาราง", summary.offSchedule, "OFF_SCHEDULE"],
                ["มี OT", summary.ot, "OT"],
              ] as const
            ).map(([label, value, key]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  filter === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                }`}
              >
                {label}{" "}
                <span className="tabular-nums opacity-90">({value})</span>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3 shadow-sm sm:flex-row sm:items-end sm:justify-between">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">
                วันที่
              </span>
              <DateSelector
                date={workDate}
                setDate={setWorkDate}
                className="min-w-[12rem]"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  void postMode({ mode: "open-from-schedule", workDate })
                }
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                <Play size={16} />
                เปิดจากตารางงาน
              </button>
              {canApprove ? (
                <button
                  type="button"
                  onClick={() =>
                    void postMode({
                      mode: "lock-period",
                      periodStart: workDate,
                      periodEnd: workDate,
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted"
                >
                  <Lock size={16} />
                  ปิดรอบวันนี้
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ["ทั้งหมด", summary.total, "ALL"],
                ["ต้องตรวจสอบ", summary.needsReview, "NEEDS_REVIEW"],
                ["มาสาย", summary.late, "LATE"],
                ["ไม่มีเวลาออก", summary.noClockOut, "NO_CLOCK_OUT"],
                ["นอกตาราง", summary.offSchedule, "OFF_SCHEDULE"],
                ["มี OT", summary.ot, "OT"],
              ] as const
            ).map(([label, value, key]) => (
              <button
                key={label}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-xl border px-3 py-2 text-left text-sm shadow-sm ${
                  filter === key
                    ? "border-primary bg-primary/10"
                    : "border-border bg-surface"
                }`}
              >
                <span className="text-muted-foreground">{label}</span>{" "}
                <span className="font-semibold tabular-nums">{value}</span>
              </button>
            ))}
          </div>
        </>
      )}

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

      {canApprove && pending.length > 0 ? (
        <section className="rounded-2xl border border-border bg-surface p-3 shadow-sm">
          <h2 className="text-sm font-semibold">
            รออนุมัติ ({pending.length})
          </h2>
          <ul className="mt-2 space-y-1.5">
            {pending.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 rounded-xl border border-border bg-background p-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="text-sm">
                  <p className="font-medium">
                    {item.employeeName} · {formatThaiDate(item.workDate)} ·{" "}
                    {item.type}
                  </p>
                  <p className="text-muted-foreground">{item.reason}</p>
                  {item.proposedOtMinutes !== null ? (
                    <p className="text-muted-foreground">
                      OT ขอ {formatMinutes(item.proposedOtMinutes)} ชม.
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void postMode({
                        mode: "review",
                        adjustmentId: item.id,
                        decision: "APPROVED",
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-xl bg-success/15 px-3 py-2 text-sm text-success"
                  >
                    <Check size={14} />
                    อนุมัติ
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void postMode({
                        mode: "review",
                        adjustmentId: item.id,
                        decision: "REJECTED",
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    <X size={14} />
                    ไม่อนุมัติ
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2">พนักงาน</th>
                {isReview ? (
                  <th className="px-3 py-2">วันที่</th>
                ) : null}
                <th className="px-3 py-2">กะ</th>
                <th className="px-3 py-2">เข้า/ออก</th>
                <th className="px-3 py-2">ชั่วโมง</th>
                <th className="px-3 py-2">สาย/ออกก่อน/OT</th>
                <th className="px-3 py-2">สถานะ</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={isReview ? 8 : 7}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    กำลังโหลด...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td
                    colSpan={isReview ? 8 : 7}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    {records.length === 0
                      ? isReview
                        ? "ไม่มีรายการตามตัวกรอง"
                        : "ยังไม่มีรายการ — กด “เปิดจากตารางงาน”"
                      : "ไม่มีรายการในตัวกรองนี้"}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <p className="font-medium">{item.employeeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.employeeCode ?? "-"}
                      </p>
                    </td>
                    {isReview ? (
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatThaiDate(item.workDate)}
                      </td>
                    ) : null}
                    <td className="px-3 py-2">{item.shiftName ?? "-"}</td>
                    <td className="px-3 py-2">
                      {formatTime(item.clockIn)} / {formatTime(item.clockOut)}
                    </td>
                    <td className="px-3 py-2">
                      {formatMinutes(item.workedMinutes)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      สาย {item.lateMinutes} · ออกก่อน {item.earlyLeaveMinutes} ·
                      OT {item.otMinutes}
                      {item.otApprovedMinutes
                        ? ` (อนุมัติ ${item.otApprovedMinutes})`
                        : ""}
                    </td>
                    <td className="px-3 py-2">{item.status}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap justify-end gap-1">
                        {canEditTime && item.status !== "LOCKED" ? (
                          <button
                            type="button"
                            title="แก้ไขเวลาเข้า–ออก"
                            onClick={() => openEditModal(item)}
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted"
                          >
                            <Pencil size={14} />
                            แก้ไข
                          </button>
                        ) : null}
                        {!isReview ? (
                          <>
                            <button
                              type="button"
                              title="เข้างาน"
                              onClick={() =>
                                void postMode({
                                  mode: "clock",
                                  attendanceId: item.id,
                                  action: "clock-in",
                                })
                              }
                              className="rounded-lg border border-border p-2 hover:bg-muted"
                            >
                              <Play size={14} />
                            </button>
                            <button
                              type="button"
                              title="พัก"
                              onClick={() =>
                                void postMode({
                                  mode: "clock",
                                  attendanceId: item.id,
                                  action:
                                    item.breakStart && !item.breakEnd
                                      ? "break-end"
                                      : "break-start",
                                })
                              }
                              className="rounded-lg border border-border p-2 hover:bg-muted"
                            >
                              <Timer size={14} />
                            </button>
                            <button
                              type="button"
                              title="เลิกงาน"
                              onClick={() =>
                                void postMode({
                                  mode: "clock",
                                  attendanceId: item.id,
                                  action: "clock-out",
                                })
                              }
                              className="rounded-lg border border-border p-2 hover:bg-muted"
                            >
                              <Square size={14} />
                            </button>
                          </>
                        ) : null}
                        {item.scheduledEnd && item.clockIn && !item.clockOut ? (
                          <button
                            type="button"
                            title="ใช้เวลาเลิกกะ"
                            onClick={() =>
                              void postMode({
                                mode: "adjust",
                                attendanceId: item.id,
                                type: "CLOCK_CORRECTION",
                                reason: "ใช้เวลาเลิกกะตามตาราง",
                                proposedClockOut: item.scheduledEnd,
                              })
                            }
                            className="rounded-lg border border-border px-2 py-1 text-[11px] hover:bg-muted"
                          >
                            ใช้เลิกกะ
                          </button>
                        ) : null}
                        {item.clockIn ? (
                          <button
                            type="button"
                            title="ไม่นับวันทำงาน"
                            onClick={() =>
                              void postMode({
                                mode: "adjust",
                                attendanceId: item.id,
                                type: "CLOCK_CORRECTION",
                                reason: "ไม่นับวันทำงาน",
                                proposedClockIn: item.clockIn,
                                proposedClockOut: item.clockIn,
                              })
                            }
                            className="rounded-lg border border-border px-2 py-1 text-[11px] hover:bg-muted"
                          >
                            ไม่นับวัน
                          </button>
                        ) : null}
                        {isReview && canEditTime && item.status !== "LOCKED" ? (
                          <button
                            type="button"
                            title={
                              item.otApprovedMinutes > 0
                                ? "แก้ไข/ยกเลิกการอนุมัติ OT"
                                : "อนุมัติ OT"
                            }
                            onClick={() => openApproveOtModal(item)}
                            className={`rounded-lg border p-2 hover:bg-muted ${
                              item.otApprovedMinutes > 0
                                ? "border-success/40 bg-success/10 text-success"
                                : "border-border"
                            }`}
                          >
                            <Clock3 size={14} />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editRow ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-5 shadow-lg">
            <h2 className="text-lg font-semibold">แก้ไขเวลาเข้า–ออก</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {editRow.employeeName} · {formatThaiDate(editRow.workDate)}
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">
                  เวลาเข้า (ไทย)
                </span>
                <input
                  type="time"
                  value={editClockIn}
                  disabled={editClearIn}
                  onChange={(event) => setEditClockIn(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 disabled:opacity-50"
                />
                <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={editClearIn}
                    onChange={(event) => setEditClearIn(event.target.checked)}
                  />
                  ล้างเวลาเข้า
                </label>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">
                  เวลาออก (ไทย)
                </span>
                <input
                  type="time"
                  value={editClockOut}
                  disabled={editClearOut}
                  onChange={(event) => setEditClockOut(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 disabled:opacity-50"
                />
                <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={editClearOut}
                    onChange={(event) => setEditClearOut(event.target.checked)}
                  />
                  ล้างเวลาออก
                </label>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">
                  เหตุผล (บังคับ)
                </span>
                <textarea
                  value={editReason}
                  onChange={(event) => setEditReason(event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2"
                  placeholder="เช่น ตรวจจากกล้องวงจรปิด / พนักงานลืมลงเวลาออก"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditRow(null)}
                className="rounded-xl border border-border px-4 py-2 text-sm"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void saveTimeEdit()}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {approveOtRow ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-5 shadow-lg">
            <h2 className="text-lg font-semibold">อนุมัติ OT</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {approveOtRow.employeeName} · {formatThaiDate(approveOtRow.workDate)}
              {approveOtRow.otMinutes > 0 ? (
                <> · คำนวณได้ {approveOtRow.otMinutes} นาที</>
              ) : null}
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">
                  นาที OT ที่อนุมัติ
                </span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={otMinutes}
                  onChange={(event) => setOtMinutes(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">เหตุผล</span>
                <textarea
                  value={otReason}
                  onChange={(event) => setOtReason(event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2"
                />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setApproveOtRow(null)}
                className="rounded-xl border border-border px-4 py-2 text-sm"
              >
                ปิด
              </button>
              {approveOtRow.otApprovedMinutes > 0 ? (
                <button
                  type="button"
                  onClick={() => void saveOtApproval(0)}
                  className="rounded-xl border border-destructive/40 px-4 py-2 text-sm text-destructive hover:bg-destructive/10"
                >
                  ยกเลิกการอนุมัติ
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void saveOtApproval(Number(otMinutes))}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                บันทึกการอนุมัติ
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
