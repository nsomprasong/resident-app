"use client";

import { useMemo, useState } from "react";

import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { WEEKDAY_PRESETS } from "@/lib/hr/schedule-bulk-assign";
import type { ShiftTemplateRecord } from "@/lib/hr/shift-templates";

type EmployeeRow = {
  id: string;
  name: string;
  employeeCode: string | null;
};

type Period = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
};

type ShiftCell = {
  employeeId: string;
  workDate: string;
  assignmentType: string;
  status: string;
  note?: string | null;
};

type BulkMode = "FILL_EMPTY" | "REPLACE_ALL";
type DateRangePreset = "PERIOD" | "CUSTOM";
type WeekdayPreset = "EVERY_DAY" | "MON_FRI" | "MON_SAT" | "CUSTOM";
type ManageModal = "assign" | "assign-cells" | "clear" | "copy" | null;

type SelectedCell = { employeeId: string; dateKey: string };

const weekdayLabels = [
  { value: 0, label: "อาทิตย์" },
  { value: 1, label: "จันทร์" },
  { value: 2, label: "อังคาร" },
  { value: 3, label: "พุธ" },
  { value: 4, label: "พฤหัสบดี" },
  { value: 5, label: "ศุกร์" },
  { value: 6, label: "เสาร์" },
] as const;

function employeeLabel(item: EmployeeRow) {
  return item.employeeCode
    ? `${item.employeeCode} · ${item.name}`
    : item.name;
}

function EmployeeChecklist(props: {
  employees: EmployeeRow[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  search: string;
  excludeIds?: string[];
  mode?: "checkbox" | "radio";
  radioValue?: string;
  onRadioChange?: (id: string) => void;
}) {
  const filtered = props.employees.filter((item) => {
    if (props.excludeIds?.includes(item.id)) return false;
    if (!props.search.trim()) return true;
    const q = props.search.trim().toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      (item.employeeCode ?? "").toLowerCase().includes(q)
    );
  });

  if (props.mode === "radio") {
    return (
      <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
        {filtered.map((item) => (
          <li key={item.id}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="source-employee"
                checked={props.radioValue === item.id}
                onChange={() => props.onRadioChange?.(item.id)}
              />
              {employeeLabel(item)}
            </label>
          </li>
        ))}
      </ul>
    );
  }

  const allIds = filtered.map((item) => item.id);
  const allSelected =
    allIds.length > 0 && allIds.every((id) => props.selectedIds.includes(id));

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={(event) => {
            if (event.target.checked) {
              props.onChange([
                ...new Set([...props.selectedIds, ...allIds]),
              ]);
            } else {
              props.onChange(
                props.selectedIds.filter((id) => !allIds.includes(id)),
              );
            }
          }}
        />
        เลือกทั้งหมด
      </label>
      <p className="text-xs text-muted-foreground">
        เลือกแล้ว {props.selectedIds.length} คน
      </p>
      <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
        {filtered.map((item) => (
          <li key={item.id}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={props.selectedIds.includes(item.id)}
                onChange={(event) => {
                  props.onChange(
                    event.target.checked
                      ? [...props.selectedIds, item.id]
                      : props.selectedIds.filter((id) => id !== item.id),
                  );
                }}
              />
              {employeeLabel(item)}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HrScheduleManageActions(props: {
  period: Period;
  periodId: string;
  employees: EmployeeRow[];
  shifts: ShiftCell[];
  templates: ShiftTemplateRecord[];
  preselectedEmployeeIds: string[];
  selectedCells?: SelectedCell[];
  onClearSelectedCells?: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [modal, setModal] = useState<ManageModal>(null);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [mode, setMode] = useState<BulkMode>("FILL_EMPTY");
  const [datePreset, setDatePreset] = useState<DateRangePreset>("PERIOD");
  const [dateFrom, setDateFrom] = useState(props.period.startDate);
  const [dateTo, setDateTo] = useState(props.period.endDate);
  const [weekdayPreset, setWeekdayPreset] = useState<WeekdayPreset>("MON_SAT");
  const [weekdays, setWeekdays] = useState<number[]>([
    ...WEEKDAY_PRESETS.MON_SAT,
  ]);
  const [includeOverrides, setIncludeOverrides] = useState(false);
  const [reason, setReason] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [targetIds, setTargetIds] = useState<string[]>([]);

  function openModal(next: ManageModal) {
    const pre = props.preselectedEmployeeIds;
    setSearch("");
    setSelectedIds(pre);
    setTemplateId(props.templates.find((item) => item.isActive)?.id ?? "");
    setMode("FILL_EMPTY");
    setDatePreset("PERIOD");
    setDateFrom(props.period.startDate);
    setDateTo(props.period.endDate);
    setWeekdayPreset("MON_SAT");
    setWeekdays([...WEEKDAY_PRESETS.MON_SAT]);
    setIncludeOverrides(false);
    setReason("");
    setSourceId(pre.length === 1 ? pre[0]! : "");
    setTargetIds(pre.length === 1 ? [] : pre.filter((id) => id !== pre[0]));
    setModal(next);
  }

  function applyWeekdayPreset(preset: WeekdayPreset) {
    setWeekdayPreset(preset);
    if (preset === "EVERY_DAY") setWeekdays([...WEEKDAY_PRESETS.EVERY_DAY]);
    if (preset === "MON_FRI") setWeekdays([...WEEKDAY_PRESETS.MON_FRI]);
    if (preset === "MON_SAT") setWeekdays([...WEEKDAY_PRESETS.MON_SAT]);
  }

  const rangeFrom =
    datePreset === "CUSTOM" ? dateFrom : props.period.startDate;
  const rangeTo = datePreset === "CUSTOM" ? dateTo : props.period.endDate;

  const sourceSummary = useMemo(() => {
    if (!sourceId) return null;
    const rows = props.shifts.filter(
      (shift) =>
        shift.employeeId === sourceId &&
        shift.status !== "CANCELLED" &&
        shift.status !== "REPLACED",
    );
    return {
      days: new Set(rows.map((item) => item.workDate)).size,
      off: rows.filter(
        (item) => item.note === "DAY_OFF" || item.status === "LEAVE",
      ).length,
      double: rows.filter((item) => item.assignmentType === "DOUBLE_SHIFT")
        .length,
    };
  }, [props.shifts, sourceId]);

  async function submitAssignCells() {
    const cells = props.selectedCells ?? [];
    if (cells.length === 0) {
      props.onError("เลือกช่องบนตารางอย่างน้อย 1 ช่อง");
      return;
    }
    if (!templateId) {
      props.onError("เลือกกะก่อน");
      return;
    }
    if (props.period.status === "PUBLISHED" && !reason.trim()) {
      props.onError("รอบประกาศแล้ว — ต้องระบุเหตุผล");
      return;
    }

    const payload = {
      cells,
      shiftTemplateId: templateId,
      mode: mode === "REPLACE_ALL" ? "REPLACE_ALL" : "FILL_EMPTY",
      reason: reason || null,
    };

    const dry = await fetch(
      `/api/hr/schedule-periods/${props.periodId}/bulk-assign`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, dryRun: true }),
      },
    );
    const dryBody = (await dry.json().catch(() => null)) as {
      message?: string;
      created?: number;
      replaced?: number;
      skippedExisting?: number;
      shiftName?: string;
    } | null;
    if (!dry.ok) {
      props.onError(dryBody?.message ?? "ตรวจสอบไม่สำเร็จ");
      return;
    }

    const ok = await confirm({
      title: "ยืนยันกำหนดกะที่เลือก?",
      description: [
        `ช่องที่เลือก: ${cells.length} ช่อง`,
        `กะ: ${dryBody?.shiftName ?? "—"}`,
        `วิธีบันทึก: ${mode === "FILL_EMPTY" ? "เติมเฉพาะช่องว่าง" : "แทนที่กะเดิมในช่องที่เลือก"}`,
        dryBody?.created ? `จะสร้าง ${dryBody.created} รายการ` : null,
        dryBody?.replaced ? `จะแทนที่ ${dryBody.replaced} รายการ` : null,
        dryBody?.skippedExisting
          ? `ข้าม ${dryBody.skippedExisting} ช่องที่มีกะอยู่แล้ว`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
      confirmLabel: "ตกลง",
      tone: (dryBody?.replaced ?? 0) > 0 ? "danger" : undefined,
    });
    if (!ok) return;

    const response = await fetch(
      `/api/hr/schedule-periods/${props.periodId}/bulk-assign`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, dryRun: false }),
      },
    );
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      created?: number;
      replaced?: number;
      skippedExisting?: number;
    } | null;
    if (!response.ok) {
      props.onError(body?.message ?? "กำหนดกะไม่สำเร็จ");
      return;
    }
    setModal(null);
    props.onClearSelectedCells?.();
    props.onDone(
      [
        "กำหนดกะที่เลือกสำเร็จ",
        body?.created ? `สร้าง ${body.created} รายการ` : null,
        body?.replaced ? `แทนที่ ${body.replaced} รายการ` : null,
        body?.skippedExisting
          ? `ข้าม ${body.skippedExisting} ช่องที่มีกะอยู่แล้ว`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
    );
  }

  async function submitAssign() {
    if (selectedIds.length === 0) {
      props.onError("เลือกพนักงานอย่างน้อย 1 คน");
      return;
    }
    if (!templateId) {
      props.onError("เลือกกะก่อน");
      return;
    }
    if (props.period.status === "PUBLISHED" && !reason.trim()) {
      props.onError("รอบประกาศแล้ว — ต้องระบุเหตุผล");
      return;
    }

    const dry = await fetch(
      `/api/hr/schedule-periods/${props.periodId}/bulk-assign`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeIds: selectedIds,
          shiftTemplateId: templateId,
          mode: mode === "REPLACE_ALL" ? "REPLACE_ALL" : "FILL_EMPTY",
          weekdays,
          dateFrom: rangeFrom,
          dateTo: rangeTo,
          reason: reason || null,
          dryRun: true,
        }),
      },
    );
    const dryBody = (await dry.json().catch(() => null)) as {
      message?: string;
      created?: number;
      replaced?: number;
      skippedExisting?: number;
      shiftName?: string;
    } | null;
    if (!dry.ok) {
      props.onError(dryBody?.message ?? "ตรวจสอบไม่สำเร็จ");
      return;
    }

    if ((dryBody?.replaced ?? 0) > 0) {
      const ok = await confirm({
        title: "แทนที่กะเดิม?",
        description: `รายการเดิมจำนวน ${dryBody?.replaced} รายการจะถูกแทนที่\nต้องการดำเนินการต่อหรือไม่`,
        confirmLabel: "ดำเนินการต่อ",
        tone: "danger",
      });
      if (!ok) return;
    } else {
      const ok = await confirm({
        title: "ยืนยันกำหนดกะทั้งรอบ?",
        description: [
          `พนักงานที่เลือก: ${selectedIds.length} คน`,
          `กะ: ${dryBody?.shiftName ?? "—"}`,
          `ช่วงวันที่: ${rangeFrom} – ${rangeTo}`,
          `วิธีบันทึก: ${mode === "FILL_EMPTY" ? "เติมเฉพาะวันที่ว่าง" : "แทนที่กะเดิมในวันที่เลือก"}`,
          dryBody?.created ? `จะสร้าง ${dryBody.created} รายการ` : null,
          dryBody?.skippedExisting
            ? `ข้าม ${dryBody.skippedExisting} วันที่มีกะอยู่แล้ว`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
        confirmLabel: "ตกลง",
      });
      if (!ok) return;
    }

    const response = await fetch(
      `/api/hr/schedule-periods/${props.periodId}/bulk-assign`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeIds: selectedIds,
          shiftTemplateId: templateId,
          mode: mode === "REPLACE_ALL" ? "REPLACE_ALL" : "FILL_EMPTY",
          weekdays,
          dateFrom: rangeFrom,
          dateTo: rangeTo,
          reason: reason || null,
          dryRun: false,
        }),
      },
    );
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      created?: number;
      replaced?: number;
      skippedExisting?: number;
    } | null;
    if (!response.ok) {
      props.onError(body?.message ?? "กำหนดกะไม่สำเร็จ");
      return;
    }
    setModal(null);
    props.onDone(
      [
        "กำหนดกะสำเร็จ",
        body?.created ? `สร้าง ${body.created} รายการ` : null,
        body?.replaced ? `แทนที่ ${body.replaced} รายการ` : null,
        body?.skippedExisting
          ? `ข้าม ${body.skippedExisting} วันที่มีกะอยู่แล้ว`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
    );
  }

  async function submitClear() {
    if (selectedIds.length === 0) {
      props.onError("เลือกพนักงานอย่างน้อย 1 คน");
      return;
    }
    if (props.period.status === "PUBLISHED" && !reason.trim()) {
      props.onError("รอบประกาศแล้ว — ต้องระบุเหตุผล");
      return;
    }

    const dry = await fetch(
      `/api/hr/schedule-periods/${props.periodId}/clear-row`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeIds: selectedIds,
          dateFrom: rangeFrom,
          dateTo: rangeTo,
          includeOverrides,
          reason: reason || null,
          dryRun: true,
        }),
      },
    );
    const dryBody = (await dry.json().catch(() => null)) as {
      message?: string;
      cancelledCount?: number;
      cancelled?: number;
    } | null;
    if (!dry.ok) {
      props.onError(dryBody?.message ?? "ตรวจสอบไม่สำเร็จ");
      return;
    }
    const count = dryBody?.cancelledCount ?? dryBody?.cancelled ?? 0;
    const ok = await confirm({
      title: "ยืนยันล้างกะ?",
      description: [
        `พนักงานที่เลือก: ${selectedIds.length} คน`,
        `ช่วงวันที่: ${rangeFrom} – ${rangeTo}`,
        `กะที่จะถูกล้าง: ${count} รายการ`,
        "การดำเนินการนี้จะนำกะออกจากตารางของพนักงานที่เลือก",
      ].join("\n"),
      confirmLabel: "ยืนยันล้างกะ",
      tone: "danger",
    });
    if (!ok) return;

    const response = await fetch(
      `/api/hr/schedule-periods/${props.periodId}/clear-row`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeIds: selectedIds,
          dateFrom: rangeFrom,
          dateTo: rangeTo,
          includeOverrides,
          reason: reason || null,
          dryRun: false,
        }),
      },
    );
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      cancelledCount?: number;
      cancelled?: number;
    } | null;
    if (!response.ok) {
      props.onError(body?.message ?? "ล้างกะไม่สำเร็จ");
      return;
    }
    setModal(null);
    props.onDone(
      `ล้างกะสำเร็จ ${body?.cancelledCount ?? body?.cancelled ?? 0} รายการ`,
    );
  }

  async function submitCopy() {
    if (!sourceId) {
      props.onError("เลือกพนักงานต้นฉบับ");
      return;
    }
    if (targetIds.length === 0) {
      props.onError("เลือกพนักงานปลายทางอย่างน้อย 1 คน");
      return;
    }
    if (props.period.status === "PUBLISHED" && !reason.trim()) {
      props.onError("รอบประกาศแล้ว — ต้องระบุเหตุผล");
      return;
    }

    const dry = await fetch(
      `/api/hr/schedule-periods/${props.periodId}/copy-row`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceEmployeeId: sourceId,
          targetEmployeeIds: targetIds,
          dateFrom: rangeFrom,
          dateTo: rangeTo,
          mode,
          reason: reason || null,
          dryRun: true,
        }),
      },
    );
    const dryBody = (await dry.json().catch(() => null)) as {
      message?: string;
      createdCount?: number;
      created?: number;
      skippedExisting?: number;
      skippedReplacement?: number;
    } | null;
    if (!dry.ok) {
      props.onError(dryBody?.message ?? "ตรวจสอบไม่สำเร็จ");
      return;
    }

    const sourceName =
      props.employees.find((item) => item.id === sourceId)?.name ?? "—";
    const ok = await confirm({
      title: "ยืนยันคัดลอกตาราง?",
      description: [
        `ต้นฉบับ: ${sourceName}`,
        `ปลายทาง: ${targetIds.length} คน`,
        `ช่วงวันที่: ${rangeFrom} – ${rangeTo}`,
        `วิธีบันทึก: ${mode === "FILL_EMPTY" ? "เติมเฉพาะวันที่ว่าง" : "แทนที่กะเดิมของปลายทาง"}`,
        `รายการที่จะสร้าง: ${dryBody?.createdCount ?? dryBody?.created ?? 0} รายการ`,
        dryBody?.skippedReplacement
          ? `จะข้าม ${dryBody.skippedReplacement} รายการประเภททำแทน`
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
      confirmLabel: "ตกลง",
    });
    if (!ok) return;

    const response = await fetch(
      `/api/hr/schedule-periods/${props.periodId}/copy-row`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceEmployeeId: sourceId,
          targetEmployeeIds: targetIds,
          dateFrom: rangeFrom,
          dateTo: rangeTo,
          mode,
          reason: reason || null,
          dryRun: false,
        }),
      },
    );
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      createdCount?: number;
      created?: number;
      skippedExisting?: number;
      skippedReplacement?: number;
    } | null;
    if (!response.ok) {
      props.onError(body?.message ?? "คัดลอกไม่สำเร็จ");
      return;
    }
    setModal(null);
    props.onDone(
      [
        "คัดลอกตารางสำเร็จ",
        `สร้าง ${body?.createdCount ?? body?.created ?? 0} รายการ`,
        body?.skippedExisting
          ? `ข้าม ${body.skippedExisting} วันที่มีกะอยู่แล้ว`
          : null,
        body?.skippedReplacement
          ? `ข้าม ${body.skippedReplacement} รายการประเภททำแทน`
          : null,
      ]
        .filter(Boolean)
        .join(" · "),
    );
  }

  return (
    <>
      {confirmDialog}
      <div className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
        <p className="text-sm font-semibold">จัดการพนักงานในตาราง</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          เลือกพนักงานใน Modal ก่อนยืนยัน — ไม่เปลี่ยนข้อมูลจนกว่าจะกดตกลง
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openModal("assign")}
            className="rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground"
          >
            กำหนดกะทั้งรอบ
          </button>
          <button
            type="button"
            disabled={(props.selectedCells?.length ?? 0) === 0}
            onClick={() => openModal("assign-cells")}
            className="rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            กำหนดกะที่เลือก
            {(props.selectedCells?.length ?? 0) > 0
              ? ` (${props.selectedCells?.length})`
              : ""}
          </button>
          <button
            type="button"
            onClick={() => openModal("copy")}
            className="rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            คัดลอกแถว
          </button>
          <button
            type="button"
            onClick={() => openModal("clear")}
            className="rounded-xl border border-border px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
          >
            ล้างกะแถว
          </button>
        </div>
      </div>

      {modal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-3xl border border-border bg-surface p-4 shadow-xl">
            <h3 className="font-semibold">
              {modal === "assign"
                ? "กำหนดกะทั้งรอบ"
                : modal === "assign-cells"
                  ? "กำหนดกะที่เลือกบนตาราง"
                  : modal === "clear"
                    ? "ล้างกะของพนักงาน"
                    : "คัดลอกตารางของพนักงาน"}
            </h3>

            {modal === "assign-cells" ? (
              <p className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm">
                เลือกไว้ {(props.selectedCells ?? []).length} ช่องบนตาราง
              </p>
            ) : (
              <>
                <label className="block text-sm">
                  ค้นหาพนักงาน
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
                    placeholder="ชื่อ หรือรหัส"
                  />
                </label>

                {modal === "copy" ? (
                  <>
                    <div>
                      <p className="mb-1 text-sm font-medium">
                        ขั้นที่ 1: เลือกพนักงานต้นฉบับ
                      </p>
                      <EmployeeChecklist
                        employees={props.employees}
                        selectedIds={[]}
                        onChange={() => undefined}
                        search={search}
                        mode="radio"
                        radioValue={sourceId}
                        onRadioChange={setSourceId}
                      />
                      {sourceSummary ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          มีกะในรอบ: {sourceSummary.days} วัน · วันหยุด/ลา:{" "}
                          {sourceSummary.off} · กะควบ: {sourceSummary.double}
                        </p>
                      ) : null}
                    </div>
                    <div>
                      <p className="mb-1 text-sm font-medium">
                        ขั้นที่ 2: เลือกพนักงานปลายทาง
                      </p>
                      <EmployeeChecklist
                        employees={props.employees}
                        selectedIds={targetIds}
                        onChange={setTargetIds}
                        search={search}
                        excludeIds={sourceId ? [sourceId] : []}
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <p className="mb-1 text-sm font-medium">
                      ขั้นที่ 1: เลือกพนักงาน
                    </p>
                    <EmployeeChecklist
                      employees={props.employees}
                      selectedIds={selectedIds}
                      onChange={setSelectedIds}
                      search={search}
                    />
                  </div>
                )}
              </>
            )}

            {modal === "assign" || modal === "assign-cells" ? (
              <label className="block text-sm">
                {modal === "assign-cells" ? "กะที่ต้องการใช้" : "ขั้นที่ 2: กะที่ต้องการใช้"}
                <select
                  value={templateId}
                  onChange={(event) => setTemplateId(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
                >
                  <option value="">เลือกกะ</option>
                  {props.templates
                    .filter((item) => item.isActive)
                    .map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} ({template.startTime}–
                        {template.endTime})
                      </option>
                    ))}
                </select>
              </label>
            ) : null}

            {modal !== "assign-cells" ? (
              <fieldset className="space-y-2 text-sm">
                <legend className="font-medium">
                  {modal === "assign" ? "ขั้นที่ 3: เลือกวันที่" : "เลือกวันที่"}
                </legend>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={datePreset === "PERIOD"}
                    onChange={() => setDatePreset("PERIOD")}
                  />
                  ทั้งรอบ ({props.period.startDate} – {props.period.endDate})
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={datePreset === "CUSTOM"}
                    onChange={() => setDatePreset("CUSTOM")}
                  />
                  เลือกช่วงวันที่
                </label>
                {datePreset === "CUSTOM" ? (
                  <div className="grid grid-cols-2 gap-2 pl-6">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(event) => setDateFrom(event.target.value)}
                      className="rounded-xl border border-border bg-background px-3 py-2"
                    />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(event) => setDateTo(event.target.value)}
                      className="rounded-xl border border-border bg-background px-3 py-2"
                    />
                  </div>
                ) : null}
              </fieldset>
            ) : null}

            {modal === "assign" ? (
              <fieldset className="space-y-2 text-sm">
                <legend className="font-medium">วันในสัปดาห์</legend>
                {(
                  [
                    ["EVERY_DAY", "ทุกวัน"],
                    ["MON_FRI", "จันทร์–ศุกร์"],
                    ["MON_SAT", "จันทร์–เสาร์"],
                    ["CUSTOM", "เลือกเอง"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={weekdayPreset === value}
                      onChange={() => applyWeekdayPreset(value)}
                    />
                    {label}
                  </label>
                ))}
                {weekdayPreset === "CUSTOM" ? (
                  <div className="flex flex-wrap gap-2 pl-6">
                    {weekdayLabels.map((day) => (
                      <label key={day.value} className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={weekdays.includes(day.value)}
                          onChange={(event) => {
                            setWeekdays((current) =>
                              event.target.checked
                                ? [...current, day.value]
                                : current.filter((item) => item !== day.value),
                            );
                          }}
                        />
                        {day.label}
                      </label>
                    ))}
                  </div>
                ) : null}
              </fieldset>
            ) : null}

            {modal === "clear" ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeOverrides}
                  onChange={(event) =>
                    setIncludeOverrides(event.target.checked)
                  }
                />
                รวมวันที่แก้เฉพาะวันแล้ว (ค่าเริ่มต้น: ล้างเฉพาะกะชุด/ฉบับร่าง)
              </label>
            ) : (
              <fieldset className="space-y-2 text-sm">
                <legend className="font-medium">วิธีจัดการข้อมูลเดิม</legend>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={mode === "FILL_EMPTY"}
                    onChange={() => setMode("FILL_EMPTY")}
                  />
                  {modal === "assign-cells"
                    ? "เติมเฉพาะช่องว่าง"
                    : "เติมเฉพาะวันที่ว่าง"}
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={mode === "REPLACE_ALL"}
                    onChange={() => setMode("REPLACE_ALL")}
                  />
                  {modal === "assign-cells"
                    ? "แทนที่กะเดิมในช่องที่เลือก"
                    : "แทนที่กะเดิมในวันที่เลือก"}
                </label>
              </fieldset>
            )}

            {props.period.status === "PUBLISHED" ? (
              <label className="block text-sm">
                เหตุผล
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
                />
              </label>
            ) : null}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-xl border border-border px-3 py-2 text-sm"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  if (modal === "assign") void submitAssign();
                  else if (modal === "assign-cells") void submitAssignCells();
                  else if (modal === "clear") void submitClear();
                  else void submitCopy();
                }}
                className={`rounded-xl px-3 py-2 text-sm ${
                  modal === "clear"
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-primary text-primary-foreground"
                }`}
              >
                {modal === "clear" ? "ยืนยันล้างกะ" : "ตกลง"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
