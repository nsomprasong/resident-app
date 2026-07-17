"use client";

import {
  Check,
  Download,
  Lock,
  Pencil,
  Play,
  Plus,
  Trash2,
  Unlock,
  Wallet,
  X,
  MoreHorizontal,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useEmployeePermissions } from "@/components/auth/EmployeePermissionsProvider";
import DateSelector from "@/components/ui/DateSelector";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { formatThaiDate } from "@/lib/format/date";
import { displayEmployeeName } from "@/lib/hr/employees";

type Period = {
  id: string;
  name: string;
  periodType: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  entryCount?: number;
};

type Entry = {
  id: string;
  employeeName: string;
  employeeCode: string | null;
  employmentType: string;
  basePay: number;
  otPay: number;
  holidayPay: number;
  allowances: number;
  bonuses: number;
  deductions: number;
  advances: number;
  unpaidLeaveDeduction: number;
  absenceDeduction: number;
  lateDeduction: number;
  grossPay: number;
  netPay: number;
  workedMinutes: number;
  otMinutes: number;
  absentDays: number;
  unpaidLeaveDays: number;
  lateMinutes: number;
  hourlyRateSnapshot: number | null;
  otHourlyRateSnapshot: number | null;
  otMultiplierSnapshot: number | null;
  dailyRateSnapshot: number | null;
  monthlySalarySnapshot: number | null;
  replacementShiftCount: number;
  doubleShiftCount: number;
  hasPayslip: boolean;
};

type PayrollAdjustmentRow = {
  id: string;
  employeeId: string;
  type: string;
  amount: number;
  reason: string;
};

type EmployeeOption = { id: string; name: string };

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
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function totalEarnings(entry: Entry) {
  return (
    entry.basePay +
    entry.otPay +
    entry.holidayPay +
    entry.allowances +
    entry.bonuses
  );
}

function totalDeductions(entry: Entry) {
  return (
    entry.unpaidLeaveDeduction +
    entry.absenceDeduction +
    entry.lateDeduction +
    entry.deductions +
    entry.advances
  );
}

function deductionCell(value: number) {
  if (value <= 0) {
    return <span className="text-muted-foreground">-</span>;
  }
  return <span className="text-destructive">{money(value)}</span>;
}

function earningCell(value: number) {
  if (value <= 0) {
    return <span className="text-muted-foreground">-</span>;
  }
  return <span>{money(value)}</span>;
}

export function HrPayrollBoard() {
  const { can } = useEmployeePermissions();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const canCalculate = can("hr.payroll.calculate");
  const canApprove = can("hr.payroll.approve");
  const canUnlock = can("hr.payroll.unlock");
  const canMarkPaid = can("hr.payroll.mark_paid");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [adjustments, setAdjustments] = useState<PayrollAdjustmentRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [periodName, setPeriodName] = useState("รอบจ่าย");
  const [periodType, setPeriodType] = useState("MONTHLY");
  const [periodStart, setPeriodStart] = useState(todayKey().slice(0, 8) + "01");
  const [periodEnd, setPeriodEnd] = useState(todayKey());

  const [adjEmployeeId, setAdjEmployeeId] = useState("");
  const [adjType, setAdjType] = useState("BONUS");
  const [adjAmount, setAdjAmount] = useState("0");
  const [adjReason, setAdjReason] = useState("");
  const [periodFormOpen, setPeriodFormOpen] = useState(false);
  const [adjPanelOpen, setAdjPanelOpen] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [periodRes, empRes] = await Promise.all([
        fetch("/api/hr/payroll/periods", { cache: "no-store" }),
        fetch("/api/hr/employees?pageSize=100", { cache: "no-store" }),
      ]);
      if (!periodRes.ok) {
        throw new Error("โหลดข้อมูลค่าจ้างไม่สำเร็จ");
      }
      const periodData = (await periodRes.json()) as { periods: Period[] };
      setPeriods(periodData.periods);
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
        setAdjEmployeeId((prev) => prev || empData.items[0]?.id || "");
      }
      if (!selectedId && periodData.periods[0]) {
        setSelectedId(periodData.periods[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPeriod = useCallback(async (periodId: string) => {
    const response = await fetch(
      `/api/hr/payroll/periods?periodId=${periodId}`,
      { cache: "no-store" },
    );
    if (!response.ok) throw new Error("โหลดรายละเอียดรอบไม่สำเร็จ");
    const data = (await response.json()) as {
      period: Period;
      entries: Entry[];
      adjustments?: PayrollAdjustmentRow[];
    };
    setEntries(data.entries);
    setAdjustments(data.adjustments ?? []);
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setEntries([]);
      return;
    }
    void loadPeriod(selectedId).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "โหลดรอบไม่สำเร็จ");
    });
  }, [selectedId, loadPeriod]);

  async function postMode(body: Record<string, unknown>) {
    setError("");
    setMessage("");
    const response = await fetch("/api/hr/payroll/periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
      id?: string;
    } | null;
    if (!response.ok) {
      setError(payload?.message ?? "ดำเนินการไม่สำเร็จ");
      return false;
    }
    setMessage("บันทึกแล้ว");
    await loadList();
    if (payload?.id) setSelectedId(payload.id);
    if (selectedId) await loadPeriod(selectedId);
    return true;
  }

  function resetPeriodForm() {
    setEditingPeriodId(null);
    setPeriodName("รอบจ่าย");
    setPeriodType("MONTHLY");
    setPeriodStart(todayKey().slice(0, 8) + "01");
    setPeriodEnd(todayKey());
  }

  function startEditPeriod(item: Period) {
    setEditingPeriodId(item.id);
    setSelectedId(item.id);
    setPeriodName(item.name);
    setPeriodType(item.periodType);
    setPeriodStart(item.periodStart);
    setPeriodEnd(item.periodEnd);
    setError("");
    setMessage("");
  }

  function periodIsLocked(status: string) {
    return status === "APPROVED" || status === "PAID";
  }

  function openCreatePeriod() {
    resetPeriodForm();
    setPeriodFormOpen(true);
  }

  function openEditPeriodForm(item: Period) {
    startEditPeriod(item);
    setPeriodFormOpen(true);
  }

  async function savePeriodAndClose() {
    const ok = await savePeriod();
    if (ok) setPeriodFormOpen(false);
  }

  async function savePeriod() {
    const ok = await postMode(
      editingPeriodId
        ? {
            mode: "update",
            periodId: editingPeriodId,
            name: periodName,
            periodType,
            periodStart,
            periodEnd,
          }
        : {
            mode: "create",
            name: periodName,
            periodType,
            periodStart,
            periodEnd,
          },
    );
    if (ok) {
      if (editingPeriodId) {
        setSelectedId(editingPeriodId);
        await loadPeriod(editingPeriodId);
      }
      resetPeriodForm();
    }
    return ok;
  }

  async function deletePeriod(item: Period) {
    if (periodIsLocked(item.status)) {
      setError("รอบถูกล็อกแล้ว — ปลดล็อกก่อนลบ");
      return;
    }
    if (
      !(await confirm({
        title: `ลบรอบจ่าย ${item.name}?`,
        description:
          "จะลบรายการคำนวณ ค่าปรับ และสลิปในรอบนี้ทั้งหมด และกู้คืนไม่ได้",
        confirmLabel: "ลบรอบ",
        tone: "danger",
      }))
    ) {
      return;
    }
    const ok = await postMode({ mode: "delete", periodId: item.id });
    if (!ok) return;
    if (selectedId === item.id) {
      setSelectedId(null);
      setEntries([]);
    }
    if (editingPeriodId === item.id) {
      resetPeriodForm();
    }
  }

  const selected = periods.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="space-y-3">
      {confirmDialog}
      {error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
          {message}
        </p>
      ) : null}

      {canCalculate && periodFormOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-4 shadow-lg">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">
                {editingPeriodId ? "แก้ไขรอบจ่าย" : "สร้างรอบจ่าย"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setPeriodFormOpen(false);
                  if (!selectedId) resetPeriodForm();
                }}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                aria-label="ปิด"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-3 grid gap-2">
              <input
                value={periodName}
                onChange={(event) => setPeriodName(event.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="ชื่อรอบ"
              />
              <select
                value={periodType}
                onChange={(event) => setPeriodType(event.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="DAILY">รายวัน</option>
                <option value="WEEKLY">รายสัปดาห์</option>
                <option value="SEMI_MONTHLY">ครึ่งเดือน</option>
                <option value="MONTHLY">รายเดือน</option>
                <option value="CUSTOM">กำหนดเอง</option>
              </select>
              <div className="grid gap-2 sm:grid-cols-2">
                <DateSelector
                  date={periodStart}
                  setDate={setPeriodStart}
                  max={periodEnd}
                  className="min-w-0"
                />
                <DateSelector
                  date={periodEnd}
                  setDate={setPeriodEnd}
                  min={periodStart}
                  className="min-w-0"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPeriodFormOpen(false)}
                className="rounded-lg border border-border px-3 py-2 text-sm"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void savePeriodAndClose()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                {editingPeriodId ? <Check size={15} /> : <Plus size={15} />}
                {editingPeriodId ? "บันทึก" : "สร้าง"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          {canCalculate ? (
            <button
              type="button"
              onClick={openCreatePeriod}
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-border p-2 hover:bg-muted"
              title="สร้างรอบจ่าย"
              aria-label="สร้างรอบจ่าย"
            >
              <Plus size={18} />
            </button>
          ) : null}
          <select
            value={selectedId ?? ""}
            onChange={(event) =>
              setSelectedId(event.target.value ? event.target.value : null)
            }
            disabled={loading || periods.length === 0}
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            aria-label="เลือกรอบจ่าย"
          >
            {periods.length === 0 ? (
              <option value="">ยังไม่มีรอบจ่าย</option>
            ) : (
              <>
                <option value="" disabled={selectedId !== null}>
                  เลือกรอบจ่าย…
                </option>
                {periods.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {formatThaiDate(item.periodStart)}–
                    {formatThaiDate(item.periodEnd)} · {item.status}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>

        {selected ? (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
              <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                {selected.status}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatThaiDate(selected.periodStart)} →{" "}
                {formatThaiDate(selected.periodEnd)}
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-1">
                {canCalculate ? (
                  <button
                    type="button"
                    onClick={() =>
                      void postMode({
                        mode: "calculate",
                        periodId: selected.id,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                    title="คำนวณ"
                  >
                    <Play size={15} />
                    <span className="hidden sm:inline">คำนวณ</span>
                  </button>
                ) : null}
                {canCalculate ? (
                  <button
                    type="button"
                    onClick={() =>
                      void postMode({ mode: "review", periodId: selected.id })
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-border p-1.5 hover:bg-muted"
                    title="ตรวจทาน"
                    aria-label="ตรวจทาน"
                  >
                    <Check size={15} />
                  </button>
                ) : null}
                {canApprove ? (
                  <button
                    type="button"
                    onClick={() =>
                      void postMode({ mode: "approve", periodId: selected.id })
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-border p-1.5 hover:bg-muted"
                    title="อนุมัติ"
                    aria-label="อนุมัติ"
                  >
                    <Lock size={15} />
                  </button>
                ) : null}
                {canMarkPaid ? (
                  <button
                    type="button"
                    onClick={() =>
                      void postMode({
                        mode: "mark-paid",
                        periodId: selected.id,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-border p-1.5 hover:bg-muted"
                    title="จ่ายแล้ว"
                    aria-label="จ่ายแล้ว"
                  >
                    <Wallet size={15} />
                  </button>
                ) : null}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMoreActionsOpen((open) => !open)}
                    className="inline-flex items-center rounded-lg border border-border p-1.5 hover:bg-muted"
                    title="เพิ่มเติม"
                    aria-label="เมนูเพิ่มเติม"
                    aria-expanded={moreActionsOpen}
                  >
                    <MoreHorizontal size={15} />
                  </button>
                  {moreActionsOpen ? (
                    <>
                      <button
                        type="button"
                        className="fixed inset-0 z-10 cursor-default"
                        aria-label="ปิดเมนู"
                        onClick={() => setMoreActionsOpen(false)}
                      />
                      <div className="absolute right-0 z-20 mt-1 min-w-[11rem] rounded-lg border border-border bg-surface py-1 shadow-lg">
                        {canUnlock ? (
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                            onClick={() => {
                              setMoreActionsOpen(false);
                              const reason =
                                window.prompt("เหตุผลการปลดล็อกรอบจ่าย", "") ??
                                "";
                              if (!reason.trim()) return;
                              void postMode({
                                mode: "unlock",
                                periodId: selected.id,
                                reason: reason.trim(),
                              });
                            }}
                          >
                            <Unlock size={14} />
                            ปลดล็อก
                          </button>
                        ) : null}
                        <a
                          href={`/api/hr/payroll/periods/${selected.id}/export?format=csv`}
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                          onClick={() => setMoreActionsOpen(false)}
                        >
                          <Download size={14} />
                          ส่งออก CSV
                        </a>
                        <a
                          href={`/api/hr/payroll/periods/${selected.id}/export?format=json`}
                          className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => setMoreActionsOpen(false)}
                        >
                          สลิป JSON
                        </a>
                        {canCalculate && !periodIsLocked(selected.status) ? (
                          <>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                              onClick={() => {
                                setMoreActionsOpen(false);
                                openEditPeriodForm(selected);
                              }}
                            >
                              <Pencil size={14} />
                              แก้ไขรอบ
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                              onClick={() => {
                                setMoreActionsOpen(false);
                                void deletePeriod(selected);
                              }}
                            >
                              <Trash2 size={14} />
                              ลบรอบ
                            </button>
                          </>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

              {canCalculate ? (
                <div className="border-b border-border px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setAdjPanelOpen((open) => !open)}
                    className="flex w-full items-center justify-between gap-2 text-left text-sm"
                  >
                    <span>เพิ่มโบนัส / หัก / เบิก</span>
                    <span className="text-xs text-muted-foreground">
                      {adjPanelOpen ? "ซ่อน" : "แสดง"}
                    </span>
                  </button>
                  {adjPanelOpen ? (
                    <div className="mt-3 pb-1">
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        <select
                          value={adjEmployeeId}
                          onChange={(event) =>
                            setAdjEmployeeId(event.target.value)
                          }
                          className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                        >
                          {employees.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={adjType}
                          onChange={(event) => setAdjType(event.target.value)}
                          className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                        >
                          <option value="BONUS">โบนัส</option>
                          <option value="OTHER_EARNING">รายได้เพิ่ม</option>
                          <option value="DEDUCTION">รายการหัก</option>
                          <option value="ADVANCE">เงินเบิก</option>
                        </select>
                        <input
                          value={adjAmount}
                          onChange={(event) => setAdjAmount(event.target.value)}
                          className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                          placeholder="จำนวนเงิน"
                        />
                        <input
                          value={adjReason}
                          onChange={(event) => setAdjReason(event.target.value)}
                          placeholder="เหตุผล"
                          className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void postMode({
                            mode: "add-adjustment",
                            periodId: selected.id,
                            employeeId: adjEmployeeId,
                            type: adjType,
                            amount: Number(adjAmount),
                            reason: adjReason,
                          })
                        }
                        className="mt-3 rounded-xl border border-border px-4 py-2 text-sm hover:bg-muted"
                      >
                        เพิ่มรายการ (แล้วกดคำนวณใหม่)
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {adjustments.length > 0 ? (
                <div className="border-b border-border px-3 py-2">
                  <h3 className="text-xs font-semibold text-muted-foreground">
                    ปรับยอด · {adjustments.length}
                  </h3>
                  <ul className="mt-1 max-h-24 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                    {adjustments.map((item) => {
                      const employeeName =
                        employees.find((entry) => entry.id === item.employeeId)
                          ?.name ?? item.employeeId;
                      return (
                        <li key={item.id} className="rounded-lg bg-muted/40 px-2 py-1">
                          {employeeName} · {item.type} · {money(item.amount)} —{" "}
                          {item.reason}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-muted/80 text-muted-foreground backdrop-blur-sm">
                      <tr>
                        <th className="px-3 py-2.5" rowSpan={2}>
                          พนักงาน
                        </th>
                        <th className="px-3 py-2.5" rowSpan={2}>
                          ประเภท
                        </th>
                        <th className="px-3 py-2.5" rowSpan={2}>
                          ขาด/ลา/สาย
                        </th>
                        <th
                          className="border-b border-border bg-success/10 px-3 py-1.5 text-center text-xs font-semibold text-success"
                          colSpan={6}
                        >
                          รายการรับ
                        </th>
                        <th
                          className="border-b border-border bg-destructive/10 px-3 py-1.5 text-center text-xs font-semibold text-destructive"
                          colSpan={6}
                        >
                          รายการหัก
                        </th>
                        <th className="bg-muted/80 px-3 py-2.5" rowSpan={2}>
                          สุทธิ
                        </th>
                      </tr>
                      <tr>
                        <th className="px-3 py-2 whitespace-nowrap">พื้นฐาน</th>
                        <th className="px-3 py-2 whitespace-nowrap">OT</th>
                        <th className="px-3 py-2 whitespace-nowrap">วันหยุด</th>
                        <th className="px-3 py-2 whitespace-nowrap">เบี้ย</th>
                        <th className="px-3 py-2 whitespace-nowrap">โบนัส+</th>
                        <th className="px-3 py-2 whitespace-nowrap">รวมรับ</th>
                        <th className="px-3 py-2 whitespace-nowrap">ลาไม่รับ</th>
                        <th className="px-3 py-2 whitespace-nowrap">ขาด</th>
                        <th className="px-3 py-2 whitespace-nowrap">มาสาย</th>
                        <th className="px-3 py-2 whitespace-nowrap">หักอื่น</th>
                        <th className="px-3 py-2 whitespace-nowrap">เบิก</th>
                        <th className="px-3 py-2 whitespace-nowrap">รวมหัก</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.length === 0 ? (
                        <tr>
                          <td
                            colSpan={15}
                            className="px-4 py-8 text-center text-muted-foreground"
                          >
                            ยังไม่มีรายการ — กดคำนวณ
                          </td>
                        </tr>
                      ) : (
                        entries.map((item, rowIndex) => (
                          <tr
                            key={item.id}
                            className={`border-t border-border ${
                              rowIndex % 2 === 1 ? "bg-muted/20" : ""
                            }`}
                          >
                            <td className="px-3 py-3">
                              <p className="font-medium">{item.employeeName}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.employeeCode ?? "-"}
                              </p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {item.employmentType === "DAILY" &&
                                item.dailyRateSnapshot != null
                                  ? `รายวัน ${money(item.dailyRateSnapshot)}`
                                  : null}
                                {item.employmentType === "MONTHLY" &&
                                item.monthlySalarySnapshot != null
                                  ? `เดือน ${money(item.monthlySalarySnapshot)}`
                                  : null}
                              </p>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              {item.employmentType}
                            </td>
                            <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                              ขาด {item.absentDays} · ลาไม่รับ{" "}
                              {item.unpaidLeaveDays}
                              <br />
                              สาย {item.lateMinutes} น. · OT อนุมัติ{" "}
                              {item.otMinutes} น.
                            </td>
                            <td className="px-3 py-3 tabular-nums">
                              {earningCell(item.basePay)}
                            </td>
                            <td className="px-3 py-3 tabular-nums">
                              {earningCell(item.otPay)}
                            </td>
                            <td className="px-3 py-3 tabular-nums">
                              {earningCell(item.holidayPay)}
                            </td>
                            <td className="px-3 py-3 tabular-nums">
                              {earningCell(item.allowances)}
                            </td>
                            <td className="px-3 py-3 tabular-nums text-success">
                              {earningCell(item.bonuses)}
                            </td>
                            <td className="px-3 py-3 tabular-nums font-medium">
                              {money(totalEarnings(item))}
                              {Math.abs(totalEarnings(item) - item.grossPay) >
                              0.01 ? (
                                <span
                                  className="ml-1 text-[10px] text-amber-600"
                                  title={`gross ในระบบ ${money(item.grossPay)}`}
                                >
                                  ≠
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-3 tabular-nums">
                              {deductionCell(item.unpaidLeaveDeduction)}
                            </td>
                            <td className="px-3 py-3 tabular-nums">
                              {deductionCell(item.absenceDeduction)}
                            </td>
                            <td className="px-3 py-3 tabular-nums">
                              {deductionCell(item.lateDeduction)}
                            </td>
                            <td className="px-3 py-3 tabular-nums">
                              {deductionCell(item.deductions)}
                            </td>
                            <td className="px-3 py-3 tabular-nums">
                              {deductionCell(item.advances)}
                            </td>
                            <td className="px-3 py-3 tabular-nums font-medium text-destructive">
                              {totalDeductions(item) <= 0
                                ? "-"
                                : money(totalDeductions(item))}
                            </td>
                            <td className="px-3 py-3 tabular-nums font-semibold">
                              {money(item.netPay)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {entries.length > 0 ? (
                  <p className="border-t border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    สุทธิ = รวมรับ − รวมหัก · หักลา/ขาด/สายจาก attendance ·
                    หักอื่น/เบิกจากรายการปรับยอด
                  </p>
                ) : null}
          </>
        ) : (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {loading ? "กำลังโหลด…" : "เลือกรอบจ่ายด้านบน"}
          </p>
        )}
      </section>
    </div>
  );
}
