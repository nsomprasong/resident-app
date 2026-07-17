"use client";

import { BedDouble, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import {
  BED_LAYOUTS,
  resolveBedLayout,
  type BedLayout,
} from "@/lib/settings/bed-types";
import type { RoomTypeRecord } from "@/lib/settings/room-types";

type FormState = {
  name: string;
  description: string;
  basePrice: string;
  capacity: string;
  bedType: string;
};

const DEFAULT_PRICES: Record<BedLayout["code"], number> = {
  SINGLE: 900,
  DOUBLE: 1200,
  TRIPLE: 1600,
  QUAD: 2000,
  DORM: 4800,
};

function emptyFormFor(layout: BedLayout): FormState {
  return {
    name: layout.label,
    description: `ห้อง${layout.label} สำหรับ ${layout.capacity} ท่าน`,
    basePrice: String(DEFAULT_PRICES[layout.code]),
    capacity: String(layout.capacity),
    bedType: layout.label,
  };
}

const emptyForm: FormState = emptyFormFor(BED_LAYOUTS[1]!);

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
  const [message, setMessage] = useState("");
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

  const existingByBed = useMemo(() => {
    const map = new Map<string, RoomTypeRecord>();
    for (const item of items) {
      const layout = resolveBedLayout(item.bedType, item.capacity);
      if (!layout) continue;
      if (!map.has(layout.code)) map.set(layout.code, item);
    }
    return map;
  }, [items]);

  const openCreate = (layout?: BedLayout) => {
    setEditingId(null);
    setForm(layout ? emptyFormFor(layout) : emptyForm);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (item: RoomTypeRecord) => {
    const layout = resolveBedLayout(item.bedType, item.capacity);
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description ?? "",
      basePrice: String(item.basePrice),
      capacity: String(item.capacity),
      bedType: layout?.label ?? "เตียงคู่",
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
    setMessage("");
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
        const messageText =
          !("id" in body) && body.message ? body.message : "บันทึกไม่สำเร็จ";
        setFormError(messageText);
        return;
      }

      setModalOpen(false);
      setMessage(editingId ? "แก้ไขประเภทห้องแล้ว" : "เพิ่มประเภทห้องแล้ว");
      await loadItems();
    } catch {
      setFormError("บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const quickAdd = async (layout: BedLayout) => {
    const existing = existingByBed.get(layout.code);
    if (existing) {
      openEdit(existing);
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const draft = emptyFormFor(layout);
      const response = await fetch("/api/room-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          description: draft.description,
          basePrice: Number(draft.basePrice),
          capacity: layout.capacity,
          bedType: layout.label,
        }),
      });
      const body = (await response.json()) as RoomTypeRecord | ApiErrorBody;
      if (!response.ok) {
        throw new Error(
          !("id" in body) && body.message
            ? body.message
            : `เพิ่ม${layout.label}ไม่สำเร็จ`,
        );
      }
      setMessage(`เพิ่มประเภท “${layout.label}” แล้ว`);
      await loadItems();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "เพิ่มไม่สำเร็จ");
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

  const deleteItem = async (item: RoomTypeRecord) => {
    const confirmed = await confirm({
      title: `ลบประเภทห้อง “${item.name}”?`,
      description: "ลบได้เฉพาะเมื่อยังไม่มีห้องใช้ประเภทนี้",
      confirmLabel: "ลบ",
      tone: "danger",
    });
    if (!confirmed) return;

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/room-types/${item.id}`, {
        method: "DELETE",
      });
      const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
      if (!response.ok) {
        throw new Error(body?.message ?? "ลบไม่สำเร็จ");
      }
      setMessage(`ลบประเภท “${item.name}” แล้ว`);
      await loadItems();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ลบไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {confirmDialog}

      <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/8 via-surface to-secondary/10 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-primary">ประเภทห้อง / เตียง</p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">
              จัดการเตียงเดี่ยว · คู่ · 3 เตียง · 4 เตียง · บ้านรวมพัก 12 คน
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              เพิ่มหรือลบประเภทห้องตรงนี้ แล้วไปเมนูห้องพักเพื่อผูกกับเลขห้อง
            </p>
          </div>
          <button
            type="button"
            onClick={() => openCreate()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus size={16} />
            เพิ่มประเภทอื่น
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {BED_LAYOUTS.map((layout) => {
            const existing = existingByBed.get(layout.code);
            return (
              <button
                key={layout.code}
                type="button"
                disabled={saving}
                onClick={() => void quickAdd(layout)}
                className={`rounded-2xl border px-3 py-3 text-left transition hover:border-primary/40 hover:bg-background disabled:opacity-50 ${
                  existing
                    ? "border-success/40 bg-success/10"
                    : "border-border bg-surface"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                    <BedDouble size={16} />
                  </span>
                  <div>
                    <p className="font-medium text-foreground">{layout.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {existing
                        ? `มีแล้ว · ${formatCurrency(existing.basePrice)}`
                        : `เพิ่มด่วน · ${layout.capacity} คน`}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">กำลังโหลดประเภทห้อง...</p>
      ) : null}
      {error ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-2xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          {message}
        </p>
      ) : null}
      {!loading && items.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
          ยังไม่มีประเภทห้อง — กดปุ่มเตียงด้านบนเพื่อเพิ่ม 4 แบบหลัก
        </p>
      ) : null}

      <div className="space-y-2">
        {items.map((type) => {
          const layout = resolveBedLayout(type.bedType, type.capacity);
          return (
            <div
              key={type.id}
              className={`rounded-2xl border p-3 ${
                type.isActive
                  ? "border-border bg-surface"
                  : "border-border bg-background opacity-80"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{type.name}</p>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {layout?.label ?? type.bedType ?? "ไม่ระบุเตียง"}
                    </span>
                    {!type.isActive ? (
                      <span className="rounded-full bg-border px-2 py-0.5 text-xs text-muted-foreground">
                        ปิดใช้งาน
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    ความจุ {type.capacity} คน
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
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                >
                  <Pencil size={14} />
                  แก้ไข
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void toggleActive(type)}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  {type.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void deleteItem(type)}
                  className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  ลบ
                </button>
              </div>
            </div>
          );
        })}
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
                <select
                  required
                  value={form.bedType}
                  onChange={(e) => {
                    const bedType = e.target.value;
                    const layout = resolveBedLayout(bedType);
                    setForm((current) => ({
                      ...current,
                      bedType,
                      // Suggest default capacity for the bed type; user can still edit
                      capacity: layout
                        ? String(layout.capacity)
                        : current.capacity,
                      name:
                        !editingId &&
                        BED_LAYOUTS.some((item) => item.label === current.name)
                          ? bedType
                          : current.name,
                    }));
                  }}
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                >
                  {BED_LAYOUTS.map((layout) => (
                    <option key={layout.code} value={layout.label}>
                      {layout.label} (แนะนำ {layout.capacity} คน)
                    </option>
                  ))}
                </select>
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
