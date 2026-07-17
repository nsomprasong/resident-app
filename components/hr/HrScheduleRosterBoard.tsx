"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, Copy, Plus, Sparkles } from "lucide-react";

import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import DateSelector from "@/components/ui/DateSelector";
import { HrScheduleManageActions } from "@/components/hr/HrScheduleManageActions";
import { computeSemiMonthlyRanges } from "@/lib/hr/schedule-periods";
import type { ShiftTemplateRecord } from "@/lib/hr/shift-templates";

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
  shiftTemplateId: string | null;
  isDailyOverride?: boolean;
  note?: string | null;
};

function todayParts() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
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

function badgeFor(shift: ShiftCell) {
  if (shift.status === "CANCELLED" || shift.status === "REPLACED") return null;
  if (shift.note === "DAY_OFF" || shift.shiftName === "หยุด") return "หยุด";
  if (shift.status === "LEAVE" || shift.shiftName === "ลา") return "ลา";
  if (shift.assignmentType === "REPLACEMENT") return "แทน";
  if (shift.assignmentType === "DOUBLE_SHIFT") return "ควบ";
  if (shift.assignmentType === "EXTRA_SHIFT") return "พิเศษ";
  return shift.shiftName.slice(0, 6);
}

export function HrScheduleRosterBoard() {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [{ year, month }, setYm] = useState(todayParts);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [shifts, setShifts] = useState<ShiftCell[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [selectedCellKeys, setSelectedCellKeys] = useState<string[]>([]);
  const [cellSelectMode, setCellSelectMode] = useState(false);
  const [changeLogs, setChangeLogs] = useState<
    Array<{
      id: string;
      changeType: string;
      reason: string | null;
      changedAt: string;
      changedByName: string;
    }>
  >([]);
  const [showLogs, setShowLogs] = useState(false);

  const selectedCells = useMemo(
    () =>
      selectedCellKeys.map((key) => {
        const [employeeId, dateKey] = key.split("|");
        return { employeeId: employeeId!, dateKey: dateKey! };
      }),
    [selectedCellKeys],
  );

  const [editor, setEditor] = useState<{
    employeeId: string;
    workDate: string;
    shiftId?: string;
  } | null>(null);
  const [editorTemplateId, setEditorTemplateId] = useState("");
  const [editorReason, setEditorReason] = useState("");
  const [replaceEmployeeId, setReplaceEmployeeId] = useState("");

  const suggestions = useMemo(
    () =>
      computeSemiMonthlyRanges(year, month).map((item) => ({
        name: item.name,
        startDate: item.startDate.toISOString().slice(0, 10),
        endDate: item.endDate.toISOString().slice(0, 10),
      })),
    [month, year],
  );

  const activePeriod = periods.find((item) => item.id === periodId) ?? null;
  const dateKeys = useMemo(
    () =>
      activePeriod
        ? eachDate(activePeriod.startDate, activePeriod.endDate)
        : [],
    [activePeriod],
  );

  const loadPeriods = useCallback(async () => {
    const response = await fetch(
      `/api/hr/schedule-periods?year=${year}&month=${month}`,
      { cache: "no-store" },
    );
    if (!response.ok) throw new Error("โหลดรอบตารางไม่สำเร็จ");
    const data = (await response.json()) as { periods: Period[] };
    setPeriods(data.periods);
    if (!periodId && data.periods[0]) setPeriodId(data.periods[0].id);
  }, [month, periodId, year]);

  const loadGrid = useCallback(async (id: string) => {
    const response = await fetch(`/api/hr/schedule-periods/${id}?grid=1`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("โหลดตารางไม่สำเร็จ");
    const data = (await response.json()) as {
      employees: EmployeeRow[];
      shifts: ShiftCell[];
      period: Period;
    };
    setEmployees(data.employees);
    setShifts(data.shifts);
    setPeriods((current) =>
      current.map((item) => (item.id === data.period.id ? data.period : item)),
    );

    const logsRes = await fetch(
      `/api/hr/schedule-periods/${id}/change-logs?take=20`,
      { cache: "no-store" },
    );
    if (logsRes.ok) {
      const logsData = (await logsRes.json()) as {
        items: Array<{
          id: string;
          changeType: string;
          reason: string | null;
          changedAt: string;
          changedByName: string;
        }>;
      };
      setChangeLogs(logsData.items);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const templateRes = await fetch("/api/hr/shift-templates", {
        cache: "no-store",
      });
      if (templateRes.ok) {
        setTemplates((await templateRes.json()) as ShiftTemplateRecord[]);
      }
      await loadPeriods();
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [loadPeriods]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!periodId) return;
    void loadGrid(periodId).catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : "โหลดตารางไม่สำเร็จ");
    });
  }, [loadGrid, periodId]);

  function toggleEmployeeSelected(employeeId: string) {
    setSelectedEmployeeIds((current) =>
      current.includes(employeeId)
        ? current.filter((id) => id !== employeeId)
        : [...current, employeeId],
    );
  }

  function cellKey(employeeId: string, dateKey: string) {
    return `${employeeId}|${dateKey}`;
  }

  function toggleCellSelected(employeeId: string, dateKey: string) {
    const key = cellKey(employeeId, dateKey);
    setSelectedCellKeys((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  }

  async function createPeriod(startDate: string, endDate: string, name: string) {
    setError("");
    setMessage("");
    const response = await fetch("/api/hr/schedule-periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate, endDate, name }),
    });
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      id?: string;
    } | null;
    if (!response.ok) {
      setError(body?.message ?? "สร้างรอบไม่สำเร็จ");
      return;
    }
    setMessage("สร้างรอบแล้ว");
    await loadPeriods();
    if (body?.id) setPeriodId(body.id);
  }

  async function generateDefaults() {
    if (!periodId) return;
    const response = await fetch(
      `/api/hr/schedule-periods/${periodId}/generate-from-defaults`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
    );
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      created?: number;
      skippedNoDefault?: number;
      skippedInactive?: number;
      skippedExisting?: number;
      skippedInactiveTemplate?: number;
    } | null;
    if (!response.ok) {
      setError(body?.message ?? "สร้างจากกะประจำไม่สำเร็จ");
      return;
    }
    const parts = [
      `สร้างตารางสำเร็จ ${body?.created ?? 0} รายการ`,
      body?.skippedNoDefault
        ? `ข้าม ${body.skippedNoDefault} พนักงานที่ไม่มีกะประจำ`
        : null,
      body?.skippedInactive
        ? `ข้าม ${body.skippedInactive} พนักงานที่ไม่ได้ใช้งาน`
        : null,
      body?.skippedInactiveTemplate
        ? `ข้าม ${body.skippedInactiveTemplate} พนักงานที่กะประจำปิดใช้งาน`
        : null,
      body?.skippedExisting
        ? `ข้าม ${body.skippedExisting} วันที่มีตารางอยู่แล้ว`
        : null,
    ].filter(Boolean);
    setMessage(parts.join(" · "));
    await loadGrid(periodId);
  }

  async function copyPrevious() {
    if (!periodId || !activePeriod) return;
    const previous = periods.find(
      (item) => item.id !== periodId && item.endDate < activePeriod.startDate,
    );
    if (!previous) {
      setError("ไม่พบรอบก่อนหน้าให้คัดลอก");
      return;
    }
    const response = await fetch(
      `/api/hr/schedule-periods/${periodId}/copy-from/${previous.id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeIds:
            selectedEmployeeIds.length > 0 ? selectedEmployeeIds : undefined,
          dateFrom: previous.startDate,
          dateTo: previous.endDate,
        }),
      },
    );
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      created?: number;
    } | null;
    if (!response.ok) {
      setError(body?.message ?? "คัดลอกไม่สำเร็จ");
      return;
    }
    setMessage(
      selectedEmployeeIds.length > 0
        ? `คัดลอกแล้ว ${body?.created ?? 0} รายการ (พนักงานที่เลือก ${selectedEmployeeIds.length} คน)`
        : `คัดลอกแล้ว ${body?.created ?? 0} รายการ`,
    );
    await loadGrid(periodId);
  }

  async function publishOrClose(action: "publish" | "close") {
    if (!periodId) return;
    let reason = "";
    if (action === "close") {
      reason = window.prompt("เหตุผลในการปิดรอบ", "") ?? "";
      if (!reason.trim()) return;
    } else if (
      !(await confirm({
        title: "ประกาศรอบนี้?",
        description: "พนักงานจะเห็นตารางและใช้เป็นฐานลงเวลา",
        confirmLabel: "ประกาศ",
      }))
    ) {
      return;
    }

    const response = await fetch(`/api/hr/schedule-periods/${periodId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    if (!response.ok) {
      setError(body?.message ?? "เปลี่ยนสถานะรอบไม่สำเร็จ");
      return;
    }
    setMessage(action === "publish" ? "ประกาศรอบแล้ว" : "ปิดรอบแล้ว");
    await loadPeriods();
    await loadGrid(periodId);
  }

  async function saveEditor(options?: {
    assignmentType?: string;
    allowOverlap?: boolean;
    forceCreate?: boolean;
  }) {
    if (!editor || !periodId || !editorTemplateId) {
      setError("เลือกแม่แบบกะก่อน");
      return;
    }
    const needsReason = activePeriod?.status === "PUBLISHED";
    if (needsReason && !editorReason.trim()) {
      setError("รอบประกาศแล้ว — ต้องระบุเหตุผล");
      return;
    }
    const updateExisting = Boolean(editor.shiftId) && !options?.forceCreate;
    const response = await fetch(
      updateExisting
        ? `/api/hr/schedule-periods/${periodId}/shifts/${editor.shiftId}`
        : `/api/hr/schedule-periods/${periodId}/shifts`,
      {
        method: updateExisting ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: editor.employeeId,
          workDate: editor.workDate,
          shiftTemplateId: editorTemplateId,
          reason: editorReason || null,
          allowOverlap: options?.allowOverlap === true,
          assignmentType: options?.assignmentType ?? "NORMAL",
          isDailyOverride: true,
        }),
      },
    );
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    if (!response.ok) {
      setError(body?.message ?? "บันทึกกะไม่สำเร็จ");
      return;
    }
    setEditor(null);
    setEditorReason("");
    setMessage("บันทึกกะรายวันแล้ว");
    await loadGrid(periodId);
  }

  async function markDay(kind: "DAY_OFF" | "LEAVE") {
    if (!editor || !periodId) return;
    const needsReason = activePeriod?.status === "PUBLISHED";
    if (needsReason && !editorReason.trim()) {
      setError("รอบประกาศแล้ว — ต้องระบุเหตุผล");
      return;
    }
    const response = await fetch(
      `/api/hr/schedule-periods/${periodId}/shifts`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: editor.employeeId,
          workDate: editor.workDate,
          markKind: kind,
          reason: editorReason || null,
        }),
      },
    );
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    if (!response.ok) {
      setError(body?.message ?? "บันทึกไม่สำเร็จ");
      return;
    }
    setEditor(null);
    setMessage(kind === "DAY_OFF" ? "กำหนดวันหยุดแล้ว" : "กำหนดลาแล้ว");
    await loadGrid(periodId);
  }

  async function cancelShift(shiftId: string) {
    if (!periodId) return;
    const reason =
      activePeriod?.status === "PUBLISHED"
        ? editorReason || (window.prompt("เหตุผลยกเลิกกะ", "") ?? "")
        : editorReason;
    if (activePeriod?.status === "PUBLISHED" && !reason.trim()) return;
    const response = await fetch(
      `/api/hr/schedule-periods/${periodId}/shifts/${shiftId}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      },
    );
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setError(body?.message ?? "ยกเลิกไม่สำเร็จ");
      return;
    }
    setEditor(null);
    setMessage("ลบกะวันนี้แล้ว");
    await loadGrid(periodId);
  }

  async function replaceShift(shiftId: string) {
    if (!periodId || !replaceEmployeeId) {
      setError("เลือกผู้ทำแทนก่อน");
      return;
    }
    const reason =
      editorReason.trim() || (window.prompt("เหตุผลการทำแทน", "") ?? "");
    if (!reason.trim()) return;
    const response = await fetch(
      `/api/hr/schedule-periods/${periodId}/shifts/${shiftId}/replace`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: replaceEmployeeId, reason }),
      },
    );
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setError(body?.message ?? "จัดผู้ทำแทนไม่สำเร็จ");
      return;
    }
    setEditor(null);
    setReplaceEmployeeId("");
    setMessage("จัดผู้ทำแทนแล้ว");
    await loadGrid(periodId);
  }

  const rosterStats = useMemo(() => {
    const active = shifts.filter(
      (shift) =>
        shift.status !== "CANCELLED" && shift.status !== "REPLACED",
    );
    const employeeIdsWithShift = new Set(active.map((item) => item.employeeId));
    return {
      filledEmployees: employeeIdsWithShift.size,
      emptyEmployees: Math.max(0, employees.length - employeeIdsWithShift.size),
      double: active.filter((item) => item.assignmentType === "DOUBLE_SHIFT")
        .length,
      replacement: active.filter((item) => item.assignmentType === "REPLACEMENT")
        .length,
      extra: active.filter((item) => item.assignmentType === "EXTRA_SHIFT")
        .length,
      overrides: active.filter((item) => item.isDailyOverride).length,
    };
  }, [employees.length, shifts]);

  return (
    <div className="space-y-4">
      {confirmDialog}
      <p className="text-sm text-muted-foreground">
        ตารางนี้เป็นตารางทำงานจริง ใช้เชื่อมกับการลงเวลาและคำนวณค่าจ้าง
        ใช้ปุ่มกลางด้านบนเพื่อจัดการหลายคน — คลิกช่องรายวันเพื่อแก้เฉพาะวัน
      </p>
      {activePeriod ? (
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["จัดกะแล้ว", rosterStats.filledEmployees],
            ["ยังไม่มีกะ", rosterStats.emptyEmployees],
            ["ควบ", rosterStats.double],
            ["ทำแทน", rosterStats.replacement],
            ["พิเศษ", rosterStats.extra],
            ["แก้รายวัน", rosterStats.overrides],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-2xl border border-border bg-surface px-3 py-2 shadow-sm"
            >
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-lg font-semibold">{value}</p>
            </div>
          ))}
        </div>
      ) : null}
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

      <div className="flex flex-wrap items-end gap-3 rounded-3xl border border-border bg-surface p-4">
        <label className="text-sm">
          ปี
          <input
            type="number"
            value={year}
            onChange={(event) =>
              setYm((current) => ({
                ...current,
                year: Number(event.target.value) || current.year,
              }))
            }
            className="mt-1 block w-24 rounded-xl border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="text-sm">
          เดือน
          <input
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(event) =>
              setYm((current) => ({
                ...current,
                month: Number(event.target.value) || current.month,
              }))
            }
            className="mt-1 block w-20 rounded-xl border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="min-w-[14rem] flex-1 text-sm">
          รอบตาราง
          <select
            value={periodId}
            onChange={(event) => setPeriodId(event.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
          >
            <option value="">เลือกรอบ</option>
            {periods.map((period) => (
              <option key={period.id} value={period.id}>
                {period.name} ({period.status})
              </option>
            ))}
          </select>
        </label>
        {suggestions.map((item) => (
          <button
            key={item.name}
            type="button"
            onClick={() => void createPeriod(item.startDate, item.endDate, item.name)}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            <Plus size={16} />
            สร้าง {item.name}
          </button>
        ))}
      </div>

      {activePeriod ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void generateDefaults()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground"
            >
              <Sparkles size={16} />
              สร้างจากกะประจำ
            </button>
            <button
              type="button"
              onClick={() => void copyPrevious()}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted"
            >
              <Copy size={16} />
              คัดลอกจากรอบก่อน
            </button>
            <button
              type="button"
              onClick={() => setShowLogs((current) => !current)}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted"
            >
              ประวัติ ({changeLogs.length})
            </button>
            {activePeriod.status === "DRAFT" ? (
              <button
                type="button"
                onClick={() => void publishOrClose("publish")}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted"
              >
                <CalendarRange size={16} />
                ประกาศรอบ
              </button>
            ) : null}
            {activePeriod.status === "PUBLISHED" ? (
              <button
                type="button"
                onClick={() => void publishOrClose("close")}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted"
              >
                ปิดรอบ
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2">
              <input
                type="checkbox"
                checked={cellSelectMode}
                onChange={(event) => setCellSelectMode(event.target.checked)}
              />
              โหมดเลือกหลายช่อง
            </label>
            {selectedCellKeys.length > 0 ? (
              <button
                type="button"
                onClick={() => setSelectedCellKeys([])}
                className="rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted"
              >
                ล้างการเลือกช่อง ({selectedCellKeys.length})
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">
                หรือ Ctrl/Cmd+คลิกช่องเพื่อเลือกหลายวัน
              </span>
            )}
          </div>
          <HrScheduleManageActions
            period={activePeriod}
            periodId={periodId}
            employees={employees}
            shifts={shifts}
            templates={templates}
            preselectedEmployeeIds={selectedEmployeeIds}
            selectedCells={selectedCells}
            onClearSelectedCells={() => setSelectedCellKeys([])}
            onDone={(text) => {
              setMessage(text);
              setError("");
              void loadGrid(periodId);
            }}
            onError={(text) => setError(text)}
          />
        </div>
      ) : null}

      {showLogs && changeLogs.length > 0 ? (
        <section className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
          <h3 className="text-sm font-semibold">ประวัติการเปลี่ยนรอบนี้</h3>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-muted-foreground">
            {changeLogs.map((log) => (
              <li key={log.id} className="rounded-lg border border-border px-2 py-1">
                <span className="font-medium text-foreground">
                  {log.changeType}
                </span>{" "}
                · {log.changedByName} ·{" "}
                {new Date(log.changedAt).toLocaleString("th-TH")}
                {log.reason ? ` — ${log.reason}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="overflow-auto rounded-3xl border border-border bg-surface">
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">กำลังโหลด...</p>
        ) : !activePeriod ? (
          <p className="p-6 text-sm text-muted-foreground">
            สร้างหรือเลือกรอบครึ่งเดือนก่อน
          </p>
        ) : (
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/40">
                <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2 text-left">
                  พนักงาน
                </th>
                {dateKeys.map((date) => (
                  <th key={date} className="px-2 py-2 text-center font-medium">
                    {date.slice(8)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} className="border-t border-border">
                  <td className="sticky left-0 z-10 min-w-[12rem] bg-surface px-3 py-2">
                    <label className="flex items-start gap-2 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedEmployeeIds.includes(employee.id)}
                        onChange={() => toggleEmployeeSelected(employee.id)}
                        className="mt-1"
                      />
                      <span>
                        {employee.employeeCode
                          ? `${employee.employeeCode} · `
                          : ""}
                        {employee.name}
                      </span>
                    </label>
                  </td>
                  {dateKeys.map((date) => {
                    const dayShifts = shifts.filter(
                      (shift) =>
                        shift.employeeId === employee.id &&
                        shift.workDate === date &&
                        shift.status !== "CANCELLED" &&
                        shift.status !== "REPLACED",
                    );
                    const selected = selectedCellKeys.includes(
                      cellKey(employee.id, date),
                    );
                    return (
                      <td key={date} className="px-1 py-1 align-top">
                        <button
                          type="button"
                          onClick={(event) => {
                            if (
                              cellSelectMode ||
                              event.ctrlKey ||
                              event.metaKey
                            ) {
                              toggleCellSelected(employee.id, date);
                              return;
                            }
                            setEditor({
                              employeeId: employee.id,
                              workDate: date,
                              shiftId: dayShifts[0]?.id,
                            });
                            setEditorTemplateId(
                              dayShifts[0]?.shiftTemplateId ?? "",
                            );
                            setEditorReason("");
                            setReplaceEmployeeId("");
                          }}
                          className={`min-h-12 w-full rounded-lg border px-1 py-1 text-left hover:bg-muted/50 ${
                            selected
                              ? "border-primary bg-primary/10"
                              : "border-dashed border-border"
                          }`}
                        >
                          {dayShifts.length === 0 ? (
                            <span className="text-[11px] text-muted-foreground">
                              +
                            </span>
                          ) : (
                            dayShifts.map((shift) => (
                              <span
                                key={shift.id}
                                className={`mb-0.5 block rounded px-1 text-[11px] ${
                                  shift.isDailyOverride
                                    ? "bg-amber-500/15 text-amber-800"
                                    : "bg-primary/10 text-primary"
                                }`}
                              >
                                {badgeFor(shift)}
                              </span>
                            ))
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editor ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-3xl border border-border bg-surface p-4 shadow-xl">
            <h3 className="font-semibold">แก้เฉพาะวัน · {editor.workDate}</h3>
            <p className="text-xs text-muted-foreground">
              การแก้รายวันเป็นข้อยกเว้น — ไม่เปลี่ยนกะวันอื่นในรอบ
            </p>
            <label className="block text-sm">
              แม่แบบกะ
              <select
                value={editorTemplateId}
                onChange={(event) => setEditorTemplateId(event.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
              >
                <option value="">เลือกกะ</option>
                {templates
                  .filter((item) => item.isActive)
                  .map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.startTime}–{template.endTime})
                    </option>
                  ))}
              </select>
            </label>
            {activePeriod?.status === "PUBLISHED" ? (
              <label className="block text-sm">
                เหตุผล
                <input
                  value={editorReason}
                  onChange={(event) => setEditorReason(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
                />
              </label>
            ) : null}
            {editor.shiftId ? (
              <label className="block text-sm">
                ผู้ทำแทน
                <select
                  value={replaceEmployeeId}
                  onChange={(event) => setReplaceEmployeeId(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
                >
                  <option value="">—</option>
                  {employees
                    .filter((item) => item.id !== editor.employeeId)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void saveEditor()}
                className="rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground"
              >
                เปลี่ยนกะ
              </button>
              <button
                type="button"
                onClick={() =>
                  void saveEditor({
                    assignmentType: "DOUBLE_SHIFT",
                    allowOverlap: true,
                    forceCreate: true,
                  })
                }
                className="rounded-xl border border-border px-3 py-2 text-sm"
              >
                เพิ่มกะควบ
              </button>
              <button
                type="button"
                onClick={() =>
                  void saveEditor({
                    assignmentType: "EXTRA_SHIFT",
                    allowOverlap: true,
                    forceCreate: true,
                  })
                }
                className="rounded-xl border border-border px-3 py-2 text-sm"
              >
                กะพิเศษ
              </button>
              {editor.shiftId ? (
                <button
                  type="button"
                  onClick={() => void replaceShift(editor.shiftId!)}
                  className="rounded-xl border border-border px-3 py-2 text-sm"
                >
                  กำหนดทำแทน
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => void markDay("DAY_OFF")}
                className="rounded-xl border border-border px-3 py-2 text-sm"
              >
                กำหนดวันหยุด
              </button>
              <button
                type="button"
                onClick={() => void markDay("LEAVE")}
                className="rounded-xl border border-border px-3 py-2 text-sm"
              >
                กำหนดลา
              </button>
              {editor.shiftId ? (
                <button
                  type="button"
                  onClick={() => void cancelShift(editor.shiftId!)}
                  className="rounded-xl border border-border px-3 py-2 text-sm text-destructive"
                >
                  ลบกะวันนี้
                </button>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setEditor(null)}
              className="rounded-xl border border-border px-3 py-2 text-sm"
            >
              ปิด
            </button>
            <p className="text-xs text-muted-foreground">
              วันที่อ้างอิง:{" "}
              <DateSelector
                date={editor.workDate}
                setDate={(workDate) =>
                  setEditor((current) =>
                    current ? { ...current, workDate } : current,
                  )
                }
              />
            </p>
          </div>
        </div>
      ) : null}

    </div>
  );
}
