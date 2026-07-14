"use client";

import { Check, Plus, Umbrella, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useEmployeePermissions } from "@/components/auth/EmployeePermissionsProvider";
import DateSelector from "@/components/ui/DateSelector";
import { displayEmployeeName } from "@/lib/hr/employees";
import { formatThaiDate, formatThaiDateRange } from "@/lib/format/date";

type LeaveType = {
  id: string;
  code: string;
  name: string;
  isPaid: boolean;
  requiresAttachment: boolean;
  defaultAllowanceDays: number;
  isActive: boolean;
};

type LeaveBalance = {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  entitled: number;
  used: number;
  pending: number;
  available: number;
};

type LeaveRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  durationLabel: string;
  daysRequested: number;
  reason: string | null;
  attachmentUrl: string | null;
  status: string;
};

type Holiday = {
  id: string;
  name: string;
  holidayDate: string;
  isDayOff: boolean;
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

export function HrLeaveBoard() {
  const { can } = useEmployeePermissions();
  const canApprove = can("hr.leave.approve");
  const canSettings = can("hr.settings.manage");
  const year = new Date().getUTCFullYear();
  const [types, setTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [employeeId, setEmployeeId] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState(todayKey);
  const [endDate, setEndDate] = useState(todayKey);
  const [duration, setDuration] = useState("FULL_DAY");
  const [reason, setReason] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");

  const [newTypeCode, setNewTypeCode] = useState("");
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeDays, setNewTypeDays] = useState("6");
  const [holidayName, setHolidayName] = useState("");
  const [holidayDate, setHolidayDate] = useState(todayKey);
  const [balanceEmployeeId, setBalanceEmployeeId] = useState("");
  const [balanceTypeId, setBalanceTypeId] = useState("");
  const [balanceEntitled, setBalanceEntitled] = useState("6");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [typesRes, balRes, reqRes, holRes, empRes] = await Promise.all([
        fetch("/api/hr/leave-types", { cache: "no-store" }),
        fetch(`/api/hr/leave-balances?year=${year}`, { cache: "no-store" }),
        fetch("/api/hr/leave-requests?status=PENDING", { cache: "no-store" }),
        fetch(
          `/api/hr/holidays?from=${year}-01-01&to=${year}-12-31`,
          { cache: "no-store" },
        ),
        fetch("/api/hr/employees?pageSize=100", { cache: "no-store" }),
      ]);

      if (!typesRes.ok || !balRes.ok || !reqRes.ok || !holRes.ok) {
        throw new Error("โหลดข้อมูลวันลาไม่สำเร็จ");
      }
      const typesData = (await typesRes.json()) as LeaveType[];
      const balData = (await balRes.json()) as { balances: LeaveBalance[] };
      const reqData = (await reqRes.json()) as { requests: LeaveRequest[] };
      const holData = (await holRes.json()) as Holiday[];
      setTypes(typesData.filter((item) => item.isActive));
      setBalances(balData.balances);
      setRequests(reqData.requests);
      setHolidays(holData);
      if (empRes.ok) {
        const empData = (await empRes.json()) as {
          items: Array<{
            id: string;
            name: string;
            firstName?: string | null;
            lastName?: string | null;
            nickname?: string | null;
            email?: string | null;
            employeeCode?: string | null;
          }>;
        };
        setEmployees(
          empData.items.map((item) => ({
            id: item.id,
            name: displayEmployeeName(item),
          })),
        );
        setEmployeeId((prev) => prev || empData.items[0]?.id || "");
      }
      setLeaveTypeId((prev) => prev || typesData.find((item) => item.isActive)?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingCount = useMemo(
    () => requests.filter((item) => item.status === "PENDING").length,
    [requests],
  );

  async function postJson(url: string, body: Record<string, unknown>) {
    setError("");
    setMessage("");
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    if (!response.ok) {
      setError(payload?.message ?? "ดำเนินการไม่สำเร็จ");
      return false;
    }
    setMessage("บันทึกแล้ว");
    await load();
    return true;
  }

  return (
    <div className="space-y-4">
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

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">รออนุมัติ</p>
          <p className="mt-1 text-2xl font-semibold">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">ประเภทลา</p>
          <p className="mt-1 text-2xl font-semibold">{types.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-sm text-muted-foreground">วันหยุดปี {year}</p>
          <p className="mt-1 text-2xl font-semibold">{holidays.length}</p>
        </div>
      </div>

      <section className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold">
          <Umbrella size={18} />
          ยื่นคำขอลา
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">พนักงาน</span>
            <select
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2"
            >
              {employees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">ประเภทลา</span>
            <select
              value={leaveTypeId}
              onChange={(event) => setLeaveTypeId(event.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2"
            >
              {types.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">รูปแบบ</span>
            <select
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2"
            >
              <option value="FULL_DAY">เต็มวัน</option>
              <option value="HALF_DAY_AM">ครึ่งวันเช้า</option>
              <option value="HALF_DAY_PM">ครึ่งวันบ่าย</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">วันเริ่ม</span>
            <DateSelector
              date={startDate}
              setDate={(next) => {
                setStartDate(next);
                if (duration !== "FULL_DAY") setEndDate(next);
              }}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">วันสิ้นสุด</span>
            <DateSelector
              date={endDate}
              setDate={setEndDate}
              min={startDate}
              disabled={duration !== "FULL_DAY"}
            />
          </label>
          <label className="text-sm sm:col-span-2 lg:col-span-1">
            <span className="mb-1 block text-muted-foreground">
              ลิงก์เอกสารแนบ
            </span>
            <input
              value={attachmentUrl}
              onChange={(event) => setAttachmentUrl(event.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="text-sm sm:col-span-2 lg:col-span-3">
            <span className="mb-1 block text-muted-foreground">เหตุผล</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              className="w-full rounded-xl border border-border bg-background px-3 py-2"
            />
          </label>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={() =>
              void postJson("/api/hr/leave-requests", {
                mode: "create",
                employeeId,
                leaveTypeId,
                startDate,
                endDate: duration === "FULL_DAY" ? endDate : startDate,
                duration,
                reason,
                attachmentUrl: attachmentUrl || null,
                attachmentName: attachmentUrl ? "เอกสารแนบ" : null,
              })
            }
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          >
            <Plus size={16} />
            ส่งคำขอลา
          </button>
        </div>
      </section>

      {canApprove && requests.length > 0 ? (
        <section className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="font-semibold">รออนุมัติ</h2>
          <ul className="mt-3 space-y-2">
            {requests.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 rounded-2xl border border-border bg-background p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="text-sm">
                  <p className="font-medium">
                    {item.employeeName} · {item.leaveTypeName} ·{" "}
                    {item.daysRequested} วัน
                  </p>
                  <p className="text-muted-foreground">
                    {formatThaiDateRange(item.startDate, item.endDate)}{" "}
                    · {item.durationLabel}
                  </p>
                  {item.reason ? (
                    <p className="text-muted-foreground">{item.reason}</p>
                  ) : null}
                  {item.attachmentUrl ? (
                    <a
                      href={item.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary underline"
                    >
                      เอกสารแนบ
                    </a>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void postJson("/api/hr/leave-requests", {
                        mode: "review",
                        requestId: item.id,
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
                      void postJson("/api/hr/leave-requests", {
                        mode: "review",
                        requestId: item.id,
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

      <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
        <div className="border-b border-border px-4 py-3 font-semibold">
          ยอดสิทธิปี {year}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-3">พนักงาน</th>
                <th className="px-4 py-3">ประเภท</th>
                <th className="px-4 py-3">สิทธิ</th>
                <th className="px-4 py-3">ใช้แล้ว</th>
                <th className="px-4 py-3">รออนุมัติ</th>
                <th className="px-4 py-3">คงเหลือ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    กำลังโหลด...
                  </td>
                </tr>
              ) : balances.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    ยังไม่มียอด — ยื่นลาครั้งแรกหรือตั้งสิทธิด้านล่าง
                  </td>
                </tr>
              ) : (
                balances.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-4 py-3">{item.employeeName}</td>
                    <td className="px-4 py-3">{item.leaveTypeName}</td>
                    <td className="px-4 py-3">{item.entitled}</td>
                    <td className="px-4 py-3">{item.used}</td>
                    <td className="px-4 py-3">{item.pending}</td>
                    <td className="px-4 py-3 font-medium">{item.available}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="font-semibold">ปฏิทินวันหยุด</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={holidayName}
            onChange={(event) => setHolidayName(event.target.value)}
            placeholder="ชื่อวันหยุด"
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          />
          <DateSelector
            date={holidayDate}
            setDate={setHolidayDate}
            className="min-w-[12rem]"
          />
          <button
            type="button"
            onClick={() =>
              void postJson("/api/hr/holidays", {
                name: holidayName,
                holidayDate,
                isDayOff: true,
              })
            }
            className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            เพิ่มวันหยุด
          </button>
        </div>
        <ul className="mt-3 space-y-1 text-sm">
          {holidays.length === 0 ? (
            <li className="text-muted-foreground">ยังไม่มีวันหยุดในปีนี้</li>
          ) : (
            holidays.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-border px-3 py-2"
              >
                <span>
                  {formatThaiDate(item.holidayDate)} · {item.name}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    void postJson("/api/hr/holidays", {
                      mode: "delete",
                      id: item.id,
                    })
                  }
                  className="text-xs text-destructive"
                >
                  ลบ
                </button>
              </li>
            ))
          )}
        </ul>
      </section>

      {canSettings ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="font-semibold">ตั้งค่าประเภทลา</h2>
            <div className="mt-3 space-y-2">
              <input
                value={newTypeCode}
                onChange={(event) => setNewTypeCode(event.target.value)}
                placeholder="รหัส เช่น SPECIAL"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
              <input
                value={newTypeName}
                onChange={(event) => setNewTypeName(event.target.value)}
                placeholder="ชื่อประเภทลา"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
              <input
                value={newTypeDays}
                onChange={(event) => setNewTypeDays(event.target.value)}
                placeholder="สิทธิเริ่มต้น (วัน)"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() =>
                  void postJson("/api/hr/leave-types", {
                    code: newTypeCode,
                    name: newTypeName,
                    defaultAllowanceDays: Number(newTypeDays),
                  })
                }
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                เพิ่มประเภทลา
              </button>
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="font-semibold">ตั้งสิทธิพนักงาน</h2>
            <div className="mt-3 space-y-2">
              <select
                value={balanceEmployeeId}
                onChange={(event) => setBalanceEmployeeId(event.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">เลือกพนักงาน</option>
                {employees.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                value={balanceTypeId}
                onChange={(event) => setBalanceTypeId(event.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">เลือกประเภทลา</option>
                {types.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <input
                value={balanceEntitled}
                onChange={(event) => setBalanceEntitled(event.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() =>
                  void postJson("/api/hr/leave-balances", {
                    employeeId: balanceEmployeeId,
                    leaveTypeId: balanceTypeId,
                    year,
                    entitled: Number(balanceEntitled),
                  })
                }
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                บันทึกสิทธิ
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
