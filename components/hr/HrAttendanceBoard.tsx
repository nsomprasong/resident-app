"use client";

import {
  Check,
  Clock3,
  Lock,
  Play,
  Square,
  Timer,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useEmployeePermissions } from "@/components/auth/EmployeePermissionsProvider";

type AttendanceRow = {
  id: string;
  employeeName: string;
  employeeCode: string | null;
  shiftName: string | null;
  workDate: string;
  clockIn: string | null;
  clockOut: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  workedMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  otMinutes: number;
  otApprovedMinutes: number;
  status: string;
};

type PendingApproval = {
  id: string;
  type: string;
  reason: string;
  proposedOtMinutes: number | null;
  workDate: string;
  employeeName: string;
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
  return new Intl.DateTimeFormat("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

export function HrAttendanceBoard() {
  const { can } = useEmployeePermissions();
  const canApprove = can("hr.attendance.approve");
  const [workDate, setWorkDate] = useState(todayKey);
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [adjustOtId, setAdjustOtId] = useState<string | null>(null);
  const [otMinutes, setOtMinutes] = useState("60");
  const [otReason, setOtReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const dataRes = await fetch(
        `/api/hr/attendance?from=${workDate}&to=${workDate}`,
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
  }, [workDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    return {
      total: records.length,
      complete: records.filter((item) => item.status === "COMPLETE").length,
      late: records.filter((item) => item.lateMinutes > 0).length,
      ot: records.filter((item) => item.otMinutes > 0).length,
    };
  }, [records]);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-3xl border border-border bg-surface p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">วันที่</span>
          <input
            type="date"
            value={workDate}
            onChange={(event) => setWorkDate(event.target.value)}
            className="rounded-xl border border-border bg-background px-3 py-2"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              void postMode({ mode: "open-from-schedule", workDate })
            }
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
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
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm hover:bg-muted"
            >
              <Lock size={16} />
              ปิดรอบวันนี้
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["รายการ", summary.total],
          ["ครบ", summary.complete],
          ["มาสาย", summary.late],
          ["มี OT", summary.ot],
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
        <section className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="font-semibold">รออนุมัติ ({pending.length})</h2>
          <ul className="mt-3 space-y-2">
            {pending.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="text-sm">
                  <p className="font-medium">
                    {item.employeeName} · {item.workDate} · {item.type}
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

      <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-3">พนักงาน</th>
                <th className="px-4 py-3">กะ</th>
                <th className="px-4 py-3">เข้า/ออก</th>
                <th className="px-4 py-3">ชั่วโมง</th>
                <th className="px-4 py-3">สาย/ออกก่อน/OT</th>
                <th className="px-4 py-3">สถานะ</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    กำลังโหลด...
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    ยังไม่มีรายการ — กด “เปิดจากตารางงาน”
                  </td>
                </tr>
              ) : (
                records.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <p className="font-medium">{item.employeeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.employeeCode ?? "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3">{item.shiftName ?? "-"}</td>
                    <td className="px-4 py-3">
                      {formatTime(item.clockIn)} / {formatTime(item.clockOut)}
                    </td>
                    <td className="px-4 py-3">
                      {formatMinutes(item.workedMinutes)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      สาย {item.lateMinutes} · ออกก่อน {item.earlyLeaveMinutes} ·
                      OT {item.otMinutes}
                      {item.otApprovedMinutes
                        ? ` (อนุมัติ ${item.otApprovedMinutes})`
                        : ""}
                    </td>
                    <td className="px-4 py-3">{item.status}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1">
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
                              action: item.breakStart && !item.breakEnd
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
                        <button
                          type="button"
                          title="ขอ OT"
                          onClick={() => {
                            setAdjustOtId(item.id);
                            setOtMinutes(String(Math.max(item.otMinutes, 60)));
                            setOtReason("ขออนุมัติ OT");
                          }}
                          className="rounded-lg border border-border p-2 hover:bg-muted"
                        >
                          <Clock3 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {adjustOtId ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-5 shadow-lg">
            <h2 className="text-lg font-semibold">ขออนุมัติ OT / แก้ไขย้อนหลัง</h2>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="mb-1 block text-muted-foreground">นาที OT</span>
                <input
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
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdjustOtId(null)}
                className="rounded-xl border border-border px-4 py-2 text-sm"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    const ok = await postMode({
                      mode: "adjust",
                      attendanceId: adjustOtId,
                      type: "OT_REQUEST",
                      reason: otReason,
                      proposedOtMinutes: Number(otMinutes),
                    });
                    if (ok) setAdjustOtId(null);
                  })();
                }}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                ส่งคำขอ
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
