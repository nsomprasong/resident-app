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
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { formatThaiDate } from "@/lib/format/date";

import { useEmployeePermissions } from "@/components/auth/EmployeePermissionsProvider";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
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
  grossPay: number;
  netPay: number;
  hasPayslip: boolean;
};

type Compensation = {
  id: string;
  employeeId: string;
  employeeName: string | null;
  employmentType: string;
  dailyRate: number;
  hourlyRate: number;
  monthlySalary: number;
};

type EmployeeOption = { id: string; name: string };

type Setting = { key: string; value: string; labelTh: string | null };

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

export function HrPayrollBoard() {
  const { can } = useEmployeePermissions();
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const canCalculate = can("hr.payroll.calculate");
  const canApprove = can("hr.payroll.approve");
  const canMarkPaid = can("hr.payroll.mark_paid");
  const canSettings = can("hr.settings.manage");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [compensations, setCompensations] = useState<Compensation[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [periodName, setPeriodName] = useState("รอบจ่าย");
  const [periodType, setPeriodType] = useState("MONTHLY");
  const [periodStart, setPeriodStart] = useState(todayKey().slice(0, 8) + "01");
  const [periodEnd, setPeriodEnd] = useState(todayKey());

  const [compEmployeeId, setCompEmployeeId] = useState("");
  const [compType, setCompType] = useState("MONTHLY");
  const [dailyRate, setDailyRate] = useState("0");
  const [hourlyRate, setHourlyRate] = useState("0");
  const [monthlySalary, setMonthlySalary] = useState("15000");

  const [adjEmployeeId, setAdjEmployeeId] = useState("");
  const [adjType, setAdjType] = useState("BONUS");
  const [adjAmount, setAdjAmount] = useState("0");
  const [adjReason, setAdjReason] = useState("");

  const loadList = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [periodRes, compRes, empRes, setRes] = await Promise.all([
        fetch("/api/hr/payroll/periods", { cache: "no-store" }),
        fetch("/api/hr/compensations", { cache: "no-store" }),
        fetch("/api/hr/employees?pageSize=100", { cache: "no-store" }),
        fetch("/api/hr/payroll/settings", { cache: "no-store" }),
      ]);
      if (!periodRes.ok || !compRes.ok) {
        throw new Error("โหลดข้อมูลค่าจ้างไม่สำเร็จ");
      }
      const periodData = (await periodRes.json()) as { periods: Period[] };
      const compData = (await compRes.json()) as { items: Compensation[] };
      setPeriods(periodData.periods);
      setCompensations(compData.items);
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
        setCompEmployeeId((prev) => prev || empData.items[0]?.id || "");
        setAdjEmployeeId((prev) => prev || empData.items[0]?.id || "");
      }
      if (setRes.ok) {
        const setData = (await setRes.json()) as { items: Setting[] };
        setSettings(setData.items);
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
    };
    setEntries(data.entries);
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
    <div className="space-y-4">
      {confirmDialog}
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

      {canCalculate ? (
        <section className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">
              {editingPeriodId ? "แก้ไขรอบจ่าย" : "สร้างรอบจ่าย"}
            </h2>
            {editingPeriodId ? (
              <button
                type="button"
                onClick={resetPeriodForm}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
              >
                <X size={14} />
                ยกเลิกแก้ไข
              </button>
            ) : null}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              value={periodName}
              onChange={(event) => setPeriodName(event.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
              placeholder="ชื่อรอบ"
            />
            <select
              value={periodType}
              onChange={(event) => setPeriodType(event.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="DAILY">รายวัน</option>
              <option value="WEEKLY">รายสัปดาห์</option>
              <option value="SEMI_MONTHLY">ครึ่งเดือน</option>
              <option value="MONTHLY">รายเดือน</option>
              <option value="CUSTOM">กำหนดเอง</option>
            </select>
            <input
              type="date"
              value={periodStart}
              onChange={(event) => setPeriodStart(event.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={periodEnd}
              onChange={(event) => setPeriodEnd(event.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => void savePeriod()}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          >
            {editingPeriodId ? (
              <>
                <Check size={16} />
                บันทึกการแก้ไข
              </>
            ) : (
              <>
                <Plus size={16} />
                สร้างรอบ
              </>
            )}
          </button>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <section className="rounded-3xl border border-border bg-surface p-3 shadow-sm">
          <h2 className="px-2 py-1 text-sm font-semibold">รอบจ่าย</h2>
          <ul className="mt-2 space-y-1">
            {loading ? (
              <li className="px-2 py-3 text-sm text-muted-foreground">กำลังโหลด...</li>
            ) : periods.length === 0 ? (
              <li className="px-2 py-3 text-sm text-muted-foreground">ยังไม่มีรอบ</li>
            ) : (
              periods.map((item) => (
                <li key={item.id}>
                  <div
                    className={`flex items-start gap-1 rounded-xl ${
                      selectedId === item.id ? "bg-primary/10" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(item.id)}
                      className={`min-w-0 flex-1 rounded-xl px-3 py-2 text-left text-sm ${
                        selectedId === item.id
                          ? "text-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatThaiDate(item.periodStart)} →{" "}
                        {formatThaiDate(item.periodEnd)} · {item.status}
                      </p>
                    </button>
                    {canCalculate && !periodIsLocked(item.status) ? (
                      <div className="flex shrink-0 gap-0.5 py-1 pr-1">
                        <button
                          type="button"
                          onClick={() => startEditPeriod(item)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label={`แก้ไข ${item.name}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deletePeriod(item)}
                          className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`ลบ ${item.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="space-y-4">
          {selected ? (
            <>
              <div className="flex flex-wrap gap-2 rounded-3xl border border-border bg-surface p-4 shadow-sm">
                <div className="mr-auto">
                  <p className="font-semibold">{selected.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatThaiDate(selected.periodStart)} →{" "}
                    {formatThaiDate(selected.periodEnd)} ·{" "}
                    {selected.status}
                  </p>
                </div>
                {canCalculate ? (
                  <button
                    type="button"
                    onClick={() =>
                      void postMode({
                        mode: "calculate",
                        periodId: selected.id,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted"
                  >
                    <Play size={14} />
                    คำนวณ
                  </button>
                ) : null}
                {canCalculate ? (
                  <button
                    type="button"
                    onClick={() =>
                      void postMode({ mode: "review", periodId: selected.id })
                    }
                    className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted"
                  >
                    <Check size={14} />
                    Review
                  </button>
                ) : null}
                {canApprove ? (
                  <button
                    type="button"
                    onClick={() =>
                      void postMode({ mode: "approve", periodId: selected.id })
                    }
                    className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted"
                  >
                    <Lock size={14} />
                    อนุมัติ/ล็อก
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
                    className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted"
                  >
                    <Wallet size={14} />
                    จ่ายแล้ว
                  </button>
                ) : null}
                {canApprove ? (
                  <button
                    type="button"
                    onClick={() =>
                      void postMode({ mode: "unlock", periodId: selected.id })
                    }
                    className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted"
                  >
                    <Unlock size={14} />
                    ปลดล็อก
                  </button>
                ) : null}
                {canCalculate && !periodIsLocked(selected.status) ? (
                  <>
                    <button
                      type="button"
                      onClick={() => startEditPeriod(selected)}
                      className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted"
                    >
                      <Pencil size={14} />
                      แก้ไข
                    </button>
                    <button
                      type="button"
                      onClick={() => void deletePeriod(selected)}
                      className="inline-flex items-center gap-1 rounded-xl border border-destructive/30 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 size={14} />
                      ลบ
                    </button>
                  </>
                ) : null}
                <a
                  href={`/api/hr/payroll/periods/${selected.id}/export?format=csv`}
                  className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted"
                >
                  <Download size={14} />
                  Export CSV
                </a>
                <a
                  href={`/api/hr/payroll/periods/${selected.id}/export?format=json`}
                  className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted"
                  target="_blank"
                  rel="noreferrer"
                >
                  สลิป JSON/พิมพ์
                </a>
              </div>

              {canCalculate ? (
                <div className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
                  <h3 className="text-sm font-semibold">เพิ่มโบนัส/หัก/เบิก</h3>
                  <div className="mt-2 grid gap-2 sm:grid-cols-4">
                    <select
                      value={adjEmployeeId}
                      onChange={(event) => setAdjEmployeeId(event.target.value)}
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
                    className="mt-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted"
                  >
                    เพิ่มรายการ (แล้วกดคำนวณใหม่)
                  </button>
                </div>
              ) : null}

              <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-muted/40 text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">พนักงาน</th>
                        <th className="px-4 py-3">ประเภท</th>
                        <th className="px-4 py-3">พื้นฐาน</th>
                        <th className="px-4 py-3">OT</th>
                        <th className="px-4 py-3">รวม</th>
                        <th className="px-4 py-3">สุทธิ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-8 text-center text-muted-foreground"
                          >
                            ยังไม่มีรายการ — กดคำนวณ
                          </td>
                        </tr>
                      ) : (
                        entries.map((item) => (
                          <tr key={item.id} className="border-t border-border">
                            <td className="px-4 py-3">
                              <p className="font-medium">{item.employeeName}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.employeeCode ?? "-"}
                              </p>
                            </td>
                            <td className="px-4 py-3">{item.employmentType}</td>
                            <td className="px-4 py-3">{money(item.basePay)}</td>
                            <td className="px-4 py-3">{money(item.otPay)}</td>
                            <td className="px-4 py-3">{money(item.grossPay)}</td>
                            <td className="px-4 py-3 font-medium">
                              {money(item.netPay)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <p className="rounded-3xl border border-border bg-surface p-6 text-sm text-muted-foreground shadow-sm">
              เลือกรอบจ่ายด้านซ้าย
            </p>
          )}
        </section>
      </div>

      {canCalculate ? (
        <section className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="font-semibold">ตั้งค่าค่าตอบแทนพนักงาน</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <select
              value={compEmployeeId}
              onChange={(event) => setCompEmployeeId(event.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              {employees.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              value={compType}
              onChange={(event) => setCompType(event.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="DAILY">รายวัน</option>
              <option value="MONTHLY">รายเดือน</option>
            </select>
            <input
              value={dailyRate}
              onChange={(event) => setDailyRate(event.target.value)}
              placeholder="ค่าแรง/วัน"
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={hourlyRate}
              onChange={(event) => setHourlyRate(event.target.value)}
              placeholder="ค่าแรง/ชม."
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <input
              value={monthlySalary}
              onChange={(event) => setMonthlySalary(event.target.value)}
              placeholder="เงินเดือน"
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={async () => {
                setError("");
                const response = await fetch("/api/hr/compensations", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    employeeId: compEmployeeId,
                    employmentType: compType,
                    dailyRate: Number(dailyRate),
                    hourlyRate: Number(hourlyRate),
                    monthlySalary: Number(monthlySalary),
                    effectiveFrom: todayKey(),
                  }),
                });
                const payload = (await response.json().catch(() => null)) as {
                  message?: string;
                } | null;
                if (!response.ok) {
                  setError(payload?.message ?? "บันทึกค่าตอบแทนไม่สำเร็จ");
                  return;
                }
                setMessage("บันทึกค่าตอบแทนแล้ว");
                await loadList();
              }}
              className="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
            >
              บันทึกค่าตอบแทน
            </button>
          </div>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {compensations.slice(0, 8).map((item) => (
              <li key={item.id}>
                {item.employeeName} · {item.employmentType} · วัน {item.dailyRate}{" "}
                / ชม. {item.hourlyRate} / เดือน {item.monthlySalary}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {canSettings ? (
        <section className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="font-semibold">สูตรค่าจ้าง (ตั้งค่า)</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {settings.map((item) => (
              <li
                key={item.key}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-3 py-2"
              >
                <span className="min-w-48 text-muted-foreground">
                  {item.labelTh ?? item.key}
                </span>
                <input
                  defaultValue={item.value}
                  id={`setting-${item.key}`}
                  className="w-28 rounded-lg border border-border bg-background px-2 py-1"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const input = document.getElementById(
                      `setting-${item.key}`,
                    ) as HTMLInputElement | null;
                    const response = await fetch("/api/hr/payroll/settings", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        key: item.key,
                        value: input?.value ?? item.value,
                      }),
                    });
                    if (!response.ok) {
                      setError("บันทึกตั้งค่าไม่สำเร็จ");
                      return;
                    }
                    setMessage("อัปเดตสูตรแล้ว");
                    await loadList();
                  }}
                  className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
                >
                  บันทึก
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
