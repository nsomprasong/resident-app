"use client";

import { Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import type { ZoneRecord } from "@/lib/settings/zones";

type FormState = {
  name: string;
};

type ApiErrorBody = {
  message?: string;
  issues?: Array<{ path: string; message: string }>;
};

export function ZonesManager() {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [items, setItems] = useState<ZoneRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({ name: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/zones", { cache: "no-store" });
      const body = (await response.json()) as ZoneRecord[] | ApiErrorBody;
      if (!response.ok || !Array.isArray(body)) {
        throw new Error(
          !Array.isArray(body) && body.message
            ? body.message
            : "โหลดโซนไม่สำเร็จ",
        );
      }
      setItems(body);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "โหลดโซนไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ name: "" });
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (item: ZoneRecord) => {
    setEditingId(item.id);
    setForm({ name: item.name });
    setFormError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const payload = { name: form.name.trim() };
      const response = await fetch(
        editingId ? `/api/zones/${editingId}` : "/api/zones",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const body = (await response.json()) as ZoneRecord | ApiErrorBody;
      if (!response.ok) {
        const message =
          !("id" in body) && body.message ? body.message : "บันทึกไม่สำเร็จ";
        setFormError(message);
        return;
      }

      setModalOpen(false);
      await loadItems();
    } catch {
      setFormError("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: ZoneRecord) => {
    const nextActive = !item.isActive;
    const confirmed = nextActive
      ? await confirm({
          title: `เปิดใช้งานโซน "${item.name}"?`,
          confirmLabel: "เปิดใช้งาน",
          tone: "default",
        })
      : await confirm({
          title: `ปิดใช้งานโซน "${item.name}"?`,
          description:
            item.roomCount > 0
              ? `ยังมีห้อง ${item.roomCount} ห้องอยู่ การปิดใช้งานจะไม่ลบห้อง แต่ควรย้ายหรือปิดห้องก่อนใช้งานจองใหม่`
              : undefined,
          confirmLabel: "ปิดใช้งาน",
          tone: "danger",
        });

    if (!confirmed) return;

    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/zones/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });
      if (!response.ok) {
        const body = (await response.json()) as ApiErrorBody;
        throw new Error(body.message ?? "อัปเดตสถานะไม่สำเร็จ");
      }
      await loadItems();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "อัปเดตสถานะไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 border-t border-border pt-4">
      {confirmDialog}
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">โซน / อาคาร</p>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus size={16} />
          เพิ่ม
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">กำลังโหลดโซน...</p>
      ) : null}
      {error ? (
        <p className="mb-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีโซน</p>
      ) : null}

      <div className="space-y-2">
        {items.map((zone) => (
          <div
            key={zone.id}
            className={`rounded-2xl border p-3 text-sm ${
              zone.isActive
                ? "border-border bg-background"
                : "border-border bg-muted opacity-80"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-medium text-foreground">{zone.name}</span>
                <span className="ml-2 text-muted-foreground">
                  {zone.roomCount} ห้อง
                </span>
                {!zone.isActive ? (
                  <span className="ml-2 rounded-full bg-border px-2 py-0.5 text-xs text-muted-foreground">
                    ปิดใช้งาน
                  </span>
                ) : null}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openEdit(zone)}
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
              >
                <Pencil size={14} />
                แก้ไข
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void toggleActive(zone)}
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
              >
                {zone.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="zone-form-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl">
            <h3
              id="zone-form-title"
              className="text-lg font-semibold text-foreground"
            >
              {editingId ? "แก้ไขโซน / อาคาร" : "เพิ่มโซน / อาคาร"}
            </h3>
            <form className="mt-4 space-y-3" onSubmit={(e) => void submitForm(e)}>
              <label className="block text-sm">
                ชื่อโซนหรืออาคาร
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ name: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                />
              </label>
              {formError ? (
                <p className="text-sm text-destructive" role="alert">
                  {formError}
                </p>
              ) : null}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeModal}
                  className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {saving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
