"use client";

import { Pencil, Plus, Trash2, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import DateSelector from "@/components/ui/DateSelector";
import { displayEmployeeName } from "@/lib/hr/employees";
import type { ShiftTemplateRecord } from "@/lib/hr/shift-templates";

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

function addDaysKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function HrSchedulesBoard() {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [templates, setTemplates] = useState<ShiftTemplateRecord[]>([]);
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
    effectiveFrom: addDaysKey(todayKey(), 1),
  });
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null,
  );
  const [assignForm, setAssignForm] = useState({
    employeeId: "",
    shiftTemplateId: "",
  });

  const emptyTemplateForm = {
    name: "",
    startTime: "08:00",
    endTime: "17:00",
    breakMinutes: "60",
    requiredHeadcount: "1",
    effectiveFrom: addDaysKey(todayKey(), 1),
  };

  const assignedEmployeeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const template of templates) {
      for (const member of template.members ?? []) {
        ids.add(member.employeeId);
      }
    }
    return ids;
  }, [templates]);

  const availableEmployees = useMemo(
    () => employees.filter((employee) => !assignedEmployeeIds.has(employee.id)),
    [assignedEmployeeIds, employees],
  );

  const understaffed = useMemo(
    () =>
      templates.filter(
        (template) =>
          template.isActive && template.memberCount < template.requiredHeadcount,
      ),
    [templates],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [templateRes, employeeRes] = await Promise.all([
        fetch("/api/hr/shift-templates", { cache: "no-store" }),
        fetch("/api/hr/employees?pageSize=200", { cache: "no-store" }),
      ]);
      if (!templateRes.ok) {
        throw new Error("โหลดกะไม่สำเร็จ");
      }
      const templateData = (await templateRes.json()) as ShiftTemplateRecord[];
      setTemplates(templateData);
      if (employeeRes.ok) {
        const employeeData = (await employeeRes.json()) as {
          items: Array<{
            id: string;
            name: string;
            firstName?: string | null;
            lastName?: string | null;
            nickname?: string | null;
            email?: string | null;
            employeeCode: string | null;
            hrStatus: string;
          }>;
        };
        setEmployees(
          employeeData.items
            .filter(
              (item) =>
                item.hrStatus === "ACTIVE" || item.hrStatus === "PROBATION",
            )
            .map((item) => ({
              id: item.id,
              name: displayEmployeeName(item),
              employeeCode: item.employeeCode,
            })),
        );
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

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
    setTemplateForm(emptyTemplateForm);
    setEditingTemplateId(null);
    setMessage("สร้างกะแล้ว — ใช้ตลอดจนกว่าจะเปลี่ยน");
    await load();
  }

  function startEditTemplate(template: ShiftTemplateRecord) {
    setEditingTemplateId(template.id);
    setTemplateForm({
      name: template.name,
      startTime: template.startTime,
      endTime: template.endTime,
      breakMinutes: String(template.breakMinutes),
      requiredHeadcount: String(template.requiredHeadcount),
      effectiveFrom: addDaysKey(todayKey(), 1),
    });
    setError("");
    setMessage("");
  }

  function cancelEditTemplate() {
    setEditingTemplateId(null);
    setTemplateForm(emptyTemplateForm);
    setError("");
  }

  async function saveTemplate() {
    if (!editingTemplateId) {
      await createTemplate();
      return;
    }
    setMessage("");
    setError("");

    const current = templates.find((item) => item.id === editingTemplateId);
    const timesChanged =
      !current ||
      current.startTime !== templateForm.startTime ||
      current.endTime !== templateForm.endTime ||
      String(current.breakMinutes) !== templateForm.breakMinutes;

    const payload: Record<string, unknown> = {
      name: templateForm.name,
      requiredHeadcount: Number(templateForm.requiredHeadcount),
    };
    if (timesChanged) {
      payload.startTime = templateForm.startTime;
      payload.endTime = templateForm.endTime;
      payload.breakMinutes = Number(templateForm.breakMinutes);
      payload.effectiveFrom = templateForm.effectiveFrom;
    }

    const response = await fetch(
      `/api/hr/shift-templates/${editingTemplateId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    if (!response.ok) {
      setError(body?.message ?? "บันทึกกะไม่สำเร็จ");
      return;
    }
    setEditingTemplateId(null);
    setTemplateForm(emptyTemplateForm);
    setMessage(
      timesChanged
        ? `อัปเดตกะแล้ว — เวลามีผลตั้งแต่วันที่ ${templateForm.effectiveFrom} (อดีตไม่เปลี่ยน)`
        : "อัปเดตกะแล้ว",
    );
    await load();
  }

  async function deleteTemplate(template: ShiftTemplateRecord) {
    if (template.memberCount > 0) {
      setError(
        `ลบกะ “${template.name}” ไม่ได้ — มีสมาชิก ${template.memberCount} คน ถอดสมาชิกออกก่อน`,
      );
      return;
    }
    if (
      !(await confirm({
        title: `ลบกะ “${template.name}”?`,
        description: "กะที่ไม่มีสมาชิกแล้วจะถูกลบถาวร",
        confirmLabel: "ลบกะ",
        tone: "danger",
      }))
    ) {
      return;
    }

    setMessage("");
    setError("");
    const response = await fetch(`/api/hr/shift-templates/${template.id}`, {
      method: "DELETE",
    });
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    if (!response.ok) {
      setError(body?.message ?? "ลบกะไม่สำเร็จ");
      return;
    }
    if (editingTemplateId === template.id) {
      cancelEditTemplate();
    }
    setMessage(`ลบกะ “${template.name}” แล้ว`);
    await load();
  }

  async function assignMember() {
    setMessage("");
    setError("");
    if (!assignForm.employeeId || !assignForm.shiftTemplateId) {
      setError("เลือกพนักงานและกะก่อน");
      return;
    }
    const response = await fetch(
      `/api/hr/shift-templates/${assignForm.shiftTemplateId}/members`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: assignForm.employeeId }),
      },
    );
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    if (!response.ok) {
      setError(body?.message ?? "จัดพนักงานลงกะไม่สำเร็จ");
      return;
    }
    setAssignForm({
      employeeId: "",
      shiftTemplateId: assignForm.shiftTemplateId,
    });
    setMessage("จัดพนักงานลงกะแล้ว — ใช้ตลอดจนกว่าจะเปลี่ยน");
    await load();
  }

  async function removeMember(
    templateId: string,
    employeeId: string,
    name: string,
  ) {
    if (
      !(await confirm({
        title: `ถอด “${name}” ออกจากกะ?`,
        description: "พนักงานคนนี้จะไม่ได้อยู่ในกะนี้อีก จนกว่าจะจัดใหม่",
        confirmLabel: "ถอดออก",
        tone: "warning",
      }))
    ) {
      return;
    }
    setMessage("");
    setError("");
    const response = await fetch(
      `/api/hr/shift-templates/${templateId}/members/${employeeId}`,
      { method: "DELETE" },
    );
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    if (!response.ok) {
      setError(body?.message ?? "ถอดสมาชิกไม่สำเร็จ");
      return;
    }
    setMessage(`ถอด “${name}” ออกจากกะแล้ว`);
    await load();
  }

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

      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="space-y-4">
          <div className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold text-foreground">ตั้งค่ากะ</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {editingTemplateId
                    ? "แก้เวลาต้องระบุวันที่มีผล — อดีตไม่เปลี่ยน และตั้งล่วงหน้าได้"
                    : "สร้างกะแล้วจัดพนักงานลงกะถาวร ไม่มีวันหมดอายุ"}
                </p>
              </div>
              {editingTemplateId ? (
                <button
                  type="button"
                  onClick={cancelEditTemplate}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                >
                  <X size={14} />
                  ยกเลิก
                </button>
              ) : null}
            </div>
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
              {editingTemplateId ? (
                <label className="block text-sm text-foreground">
                  เวลามีผลตั้งแต่วันที่
                  <div className="mt-1">
                    <DateSelector
                      date={templateForm.effectiveFrom}
                      setDate={(effectiveFrom) =>
                        setTemplateForm((current) => ({
                          ...current,
                          effectiveFrom,
                        }))
                      }
                      className="w-full"
                    />
                  </div>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    ค่าเริ่มต้น = พรุ่งนี้ · วันก่อนหน้านี้ไม่ถูกแก้ตาม
                  </span>
                </label>
              ) : null}
              <button
                type="button"
                onClick={() => void saveTemplate()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground"
              >
                {editingTemplateId ? (
                  <>
                    <Pencil size={16} />
                    บันทึกการแก้ไข
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    เพิ่มกะ
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="font-semibold text-foreground">จัดพนักงานลงกะ</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              ไม่ระบุวัน — อยู่กะทุกวันจนกว่าจะถอดออก
            </p>
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
                {availableEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.employeeCode ? `${employee.employeeCode} · ` : ""}
                    {employee.name}
                  </option>
                ))}
              </select>
              {availableEmployees.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  พนักงาน Active ถูกจัดลงกะครบแล้ว หรือยังไม่มีพนักงานว่าง
                </p>
              ) : null}
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
                      {template.name} ({template.startTime}–{template.endTime})
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={() => void assignMember()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm hover:bg-muted"
              >
                <UserPlus size={16} />
                จัดลงกะ
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {understaffed.length > 0 ? (
            <div className="rounded-3xl border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
              <p className="font-semibold">
                กะที่ขาดคน ({understaffed.length})
              </p>
              <ul className="mt-2 space-y-1">
                {understaffed.map((item) => (
                  <li key={item.id}>
                    {item.name} ขาด {item.requiredHeadcount - item.memberCount}{" "}
                    คน (มี {item.memberCount}/{item.requiredHeadcount})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
            {loading ? (
              <p className="p-6 text-sm text-muted-foreground">กำลังโหลดกะ...</p>
            ) : templates.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">ยังไม่มีกะ</p>
            ) : (
              <ul className="divide-y divide-border">
                {templates.map((template) => {
                  const shortage =
                    template.requiredHeadcount - template.memberCount;
                  return (
                    <li key={template.id} className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-foreground">
                            {template.name}
                            {!template.isActive ? (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                (ปิดใช้งาน)
                              </span>
                            ) : null}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {template.startTime}–{template.endTime} · ต้องการ{" "}
                            {template.requiredHeadcount} คน
                          </p>
                          {template.pendingChange ? (
                            <p className="mt-1 text-xs text-primary">
                              จาก {template.pendingChange.effectiveFrom}:{" "}
                              {template.pendingChange.startTime}–
                              {template.pendingChange.endTime}
                            </p>
                          ) : null}
                          {shortage > 0 ? (
                            <p className="mt-1 text-xs text-warning">
                              ขาดอีก {shortage} คน
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => startEditTemplate(template)}
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
                          >
                            <Pencil size={14} />
                            แก้ไข
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteTemplate(template)}
                            disabled={template.memberCount > 0}
                            title={
                              template.memberCount > 0
                                ? "มีสมาชิกอยู่ — ถอดสมาชิกก่อนจึงลบได้"
                                : undefined
                            }
                            className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 size={14} />
                            ลบ
                          </button>
                        </div>
                      </div>
                      <ul className="mt-3 space-y-1.5">
                        {(template.members ?? []).length === 0 ? (
                          <li className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                            ยังไม่มีสมาชิกในกะนี้
                          </li>
                        ) : (
                          (template.members ?? []).map((member) => (
                            <li
                              key={member.id}
                              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm"
                            >
                              <span>
                                {member.employeeCode
                                  ? `${member.employeeCode} · `
                                  : ""}
                                {member.employeeName}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  void removeMember(
                                    template.id,
                                    member.employeeId,
                                    member.employeeName,
                                  )
                                }
                                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                                aria-label={`ถอด ${member.employeeName}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </li>
                          ))
                        )}
                      </ul>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
