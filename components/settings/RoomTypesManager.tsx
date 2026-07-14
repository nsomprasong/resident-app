"use client";

import { Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import type { RoomTypeRecord } from "@/lib/settings/room-types";

type FormState = {
  name: string;
  description: string;
  basePrice: string;
  capacity: string;
  bedType: string;
};

const emptyForm: FormState = {
  name: "",
  description: "",
  basePrice: "",
  capacity: "2",
  bedType: "",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(value);
}

type ApiErrorBody = {
  message?: string;
  issues?: Array<{ path: string; message: string }>;
};

export function RoomTypesManager() {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [items, setItems] = useState<RoomTypeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/room-types", { cache: "no-store" });
      const body = (await response.json()) as RoomTypeRecord[] | ApiErrorBody;
      if (!response.ok || !Array.isArray(body)) {
        throw new Error(
          !Array.isArray(body) && body.message
            ? body.message
            : "โหลดประเภทห้องไม่สำเร็จ",
        );
      }
      setItems(body);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "โหลดประเภทห้องไม่สำเร็จ",
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
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (item: RoomTypeRecord) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description ?? "",
      basePrice: String(item.basePrice),
      capacity: String(item.capacity),
      bedType: item.bedType ?? "",
    });
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
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        basePrice: Number(form.basePrice),
        capacity: Number.parseInt(form.capacity, 10),
        bedType: form.bedType.trim() || null,
      };

      const response = await fetch(
        editingId ? `/api/room-types/${editingId}` : "/api/room-types",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const body = (await response.json()) as RoomTypeRecord | ApiErrorBody;
      if (!response.ok) {
        const message =
          !("id" in body) && body.message
            ? body.message
            : "บันทึกไม่สำเร็จ";
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

  const toggleActive = async (item: RoomTypeRecord) => {
    const nextActive = !item.isActive;
    const confirmed = nextActive
      ? await confirm({
          title: `เปิดใช้งานประเภทห้อง "${item.name}"?`,
          confirmLabel: "เปิดใช้งาน",
          tone: "default",
        })
      : await confirm({
          title: `ปิดใช้งานประเภทห้อง "${item.name}"?`,
          description: "ห้องเดิมที่ผูกอยู่ยังคงข้อมูลเดิม",
          confirmLabel: "ปิดใช้งาน",
          tone: "danger",
        });
    if (!confirmed) return;

    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/room-types/${item.id}`, {
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
    <div className="mt-4">
      {confirmDialog}
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">ประเภทห้อง</p>
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
        <p className="text-sm text-muted-foreground">กำลังโหลดประเภทห้อง...</p>
      ) : null}
      {error ? (
        <p className="mb-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีประเภทห้อง</p>
      ) : null}

      <div className="space-y-2">
        {items.map((type) => (
          <div
            key={type.id}
            className={`rounded-2xl border p-3 ${
              type.isActive
                ? "border-border"
                : "border-border bg-background opacity-80"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground">{type.name}</p>
                  {!type.isActive ? (
                    <span className="rounded-full bg-border px-2 py-0.5 text-xs text-muted-foreground">
                      ปิดใช้งาน
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  ความจุ {type.capacity} คน
                  {type.bedType ? ` · ${type.bedType}` : ""}
                  {type.description ? ` · ${type.description}` : ""}
                </p>
              </div>
              <p className="text-sm font-medium text-primary">
                {formatCurrency(type.basePrice)}
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openEdit(type)}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
              >
                <Pencil size={14} />
                แก้ไข
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void toggleActive(type)}
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
              >
                {type.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
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
          aria-labelledby="room-type-form-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl">
            <h3
              id="room-type-form-title"
              className="text-lg font-semibold text-foreground"
            >
              {editingId ? "แก้ไขประเภทห้อง" : "เพิ่มประเภทห้อง"}
            </h3>
            <form className="mt-4 space-y-3" onSubmit={(e) => void submitForm(e)}>
              <label className="block text-sm">
                ชื่อ
                <input
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, name: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                รายละเอียด
                <input
                  value={form.description}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      description: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  ราคา (บาท)
                  <input
                    required
                    type="number"
                    min={0}
                    step={1}
                    value={form.basePrice}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        basePrice: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  จำนวนผู้เข้าพัก
                  <input
                    required
                    type="number"
                    min={1}
                    step={1}
                    value={form.capacity}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        capacity: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                  />
                </label>
              </div>
              <label className="block text-sm">
                ประเภทเตียง
                <input
                  value={form.bedType}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      bedType: e.target.value,
                    }))
                  }
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
