"use client";

import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import type { ShiftTemplateRecord } from "@/lib/hr/shift-templates";

export function HrSchedulesBoard() {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [templates, setTemplates] = useState<ShiftTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null,
  );
  const [templateForm, setTemplateForm] = useState({
    name: "",
    startTime: "08:00",
    endTime: "17:00",
    breakMinutes: "60",
    requiredHeadcount: "1",
    lateGraceMinutes: "0",
    effectiveFrom: "",
  });

  const emptyForm = {
    name: "",
    startTime: "08:00",
    endTime: "17:00",
    breakMinutes: "60",
    requiredHeadcount: "1",
    lateGraceMinutes: "0",
    effectiveFrom: "",
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/hr/shift-templates", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("โหลดแม่แบบกะไม่สำเร็จ");
      setTemplates((await response.json()) as ShiftTemplateRecord[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(template: ShiftTemplateRecord) {
    setEditingTemplateId(template.id);
    setTemplateForm({
      name: template.name,
      startTime: template.startTime,
      endTime: template.endTime,
      breakMinutes: String(template.breakMinutes),
      requiredHeadcount: String(template.requiredHeadcount),
      lateGraceMinutes: String(template.lateGraceMinutes),
      effectiveFrom: "",
    });
    setError("");
    setMessage("");
  }

  function cancelEdit() {
    setEditingTemplateId(null);
    setTemplateForm(emptyForm);
  }

  async function saveTemplate() {
    setMessage("");
    setError("");
    const payload: Record<string, unknown> = {
      name: templateForm.name,
      startTime: templateForm.startTime,
      endTime: templateForm.endTime,
      breakMinutes: Number(templateForm.breakMinutes),
      requiredHeadcount: Number(templateForm.requiredHeadcount),
      lateGraceMinutes: Number(templateForm.lateGraceMinutes),
    };

    if (editingTemplateId) {
      const current = templates.find((item) => item.id === editingTemplateId);
      const timesFieldsChanged =
        !current ||
        current.startTime !== templateForm.startTime ||
        current.endTime !== templateForm.endTime ||
        String(current.breakMinutes) !== templateForm.breakMinutes ||
        String(current.lateGraceMinutes) !== templateForm.lateGraceMinutes;
      if (timesFieldsChanged) {
        payload.effectiveFrom =
          templateForm.effectiveFrom ||
          new Date().toISOString().slice(0, 10);
      } else {
        delete payload.startTime;
        delete payload.endTime;
        delete payload.breakMinutes;
        delete payload.lateGraceMinutes;
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
      setTemplateForm(emptyForm);
      setMessage(
        timesFieldsChanged
          ? "อัปเดตแม่แบบกะแล้ว — ตารางจริงที่สร้างไว้แล้วไม่ถูกแก้ทับ"
          : "อัปเดตแม่แบบกะแล้ว",
      );
      await load();
      return;
    }

    const response = await fetch("/api/hr/shift-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    if (!response.ok) {
      setError(body?.message ?? "สร้างกะไม่สำเร็จ");
      return;
    }
    setTemplateForm(emptyForm);
    setMessage("สร้างแม่แบบกะแล้ว — ใช้เป็นต้นแบบเวลาเมื่อสร้างตารางงาน");
    await load();
  }

  async function toggleActive(template: ShiftTemplateRecord) {
    const response = await fetch(`/api/hr/shift-templates/${template.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !template.isActive }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      setError(body?.message ?? "เปลี่ยนสถานะไม่สำเร็จ");
      return;
    }
    setMessage(template.isActive ? "ปิดใช้งานกะแล้ว" : "เปิดใช้งานกะแล้ว");
    await load();
  }

  async function deleteTemplate(template: ShiftTemplateRecord) {
    if (
      !(await confirm({
        title: `ลบกะ “${template.name}”?`,
        description:
          "ลบได้เฉพาะกะที่ไม่มีพนักงานใช้เป็นกะประจำและไม่มีสมาชิกในระบบเก่า",
        confirmLabel: "ลบกะ",
        tone: "danger",
      }))
    ) {
      return;
    }
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
    if (editingTemplateId === template.id) cancelEdit();
    setMessage(`ลบกะ “${template.name}” แล้ว`);
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
        <section className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold text-foreground">แม่แบบกะ</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                กำหนดเวลาและเงื่อนไขของกะ เพื่อใช้สร้างตารางงาน
              </p>
            </div>
            {editingTemplateId ? (
              <button
                type="button"
                onClick={cancelEdit}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
              >
                <X size={14} />
                ยกเลิก
              </button>
            ) : null}
          </div>

          <div className="mt-3 space-y-3">
            <label className="block text-sm">
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
              <label className="block text-sm">
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
              <label className="block text-sm">
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
              <label className="block text-sm">
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
              <label className="block text-sm">
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
            <label className="block text-sm">
              ผ่อนผันสาย (นาที)
              <input
                value={templateForm.lateGraceMinutes}
                onChange={(event) =>
                  setTemplateForm((current) => ({
                    ...current,
                    lateGraceMinutes: event.target.value,
                  }))
                }
                inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            {editingTemplateId ? (
              <label className="block text-sm">
                ถ้าแก้เวลา มีผลตั้งแต่วันที่ (ไม่บังคับ)
                <input
                  type="date"
                  value={templateForm.effectiveFrom}
                  onChange={(event) =>
                    setTemplateForm((current) => ({
                      ...current,
                      effectiveFrom: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  ตารางทำงานจริงที่สร้างไว้แล้วไม่ถูกแก้ทับอัตโนมัติ
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
        </section>

        <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">กำลังโหลด...</p>
          ) : templates.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">ยังไม่มีแม่แบบกะ</p>
          ) : (
            <ul className="divide-y divide-border">
              {templates.map((template) => (
                <li key={template.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {template.name}
                        {!template.isActive ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            (ปิดใช้งาน)
                          </span>
                        ) : null}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {template.startTime}–{template.endTime} · พัก{" "}
                        {template.breakMinutes} นาที · ต้องการ{" "}
                        {template.requiredHeadcount} คน · ผ่อนผันสาย{" "}
                        {template.lateGraceMinutes} นาที
                      </p>
                      {template.pendingChange ? (
                        <p className="mt-1 text-xs text-primary">
                          จาก {template.pendingChange.effectiveFrom}:{" "}
                          {template.pendingChange.startTime}–
                          {template.pendingChange.endTime}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(template)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
                      >
                        <Pencil size={14} />
                        แก้ไข
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleActive(template)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted"
                      >
                        {template.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteTemplate(template)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 size={14} />
                        ลบ
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
            การจัดพนักงานลงกะจริงทำที่เมนูตารางงาน · กะประจำของพนักงานตั้งค่าในหน้าพนักงาน
          </p>
        </section>
      </div>
    </div>
  );
}
