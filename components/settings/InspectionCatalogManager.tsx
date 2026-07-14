"use client";

import { Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import {
  inspectionItemTypeOptions,
  type InspectionCatalogMasterRecord,
} from "@/lib/settings/inspection-catalog-shared";

type FormState = {
  name: string;
  type: string;
  unitPrice: string;
};

const emptyForm: FormState = {
  name: "",
  type: "MINIBAR",
  unitPrice: "",
};

type ApiErrorBody = {
  message?: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(value);
}

function typeLabel(type: string) {
  return (
    inspectionItemTypeOptions.find((item) => item.value === type)?.label ?? type
  );
}

export function InspectionCatalogManager() {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [items, setItems] = useState<InspectionCatalogMasterRecord[]>([]);
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
      const response = await fetch("/api/inspection-catalog/master", {
        cache: "no-store",
      });
      const body = (await response.json()) as
        | InspectionCatalogMasterRecord[]
        | ApiErrorBody;
      if (!response.ok || !Array.isArray(body)) {
        throw new Error(
          !Array.isArray(body) && body.message
            ? body.message
            : "โหลดราคากลางไม่สำเร็จ",
        );
      }
      setItems(body);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "โหลดราคากลางไม่สำเร็จ",
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

  const openEdit = (item: InspectionCatalogMasterRecord) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      type: item.type,
      unitPrice: String(item.unitPrice),
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
        type: form.type,
        unitPrice: Number(form.unitPrice),
      };

      const response = await fetch(
        editingId
          ? `/api/inspection-catalog/${editingId}`
          : "/api/inspection-catalog",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const body = (await response.json()) as
        | InspectionCatalogMasterRecord
        | ApiErrorBody;
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

  const toggleActive = async (item: InspectionCatalogMasterRecord) => {
    const nextActive = !item.isActive;
    const confirmed = nextActive
      ? await confirm({
          title: `เปิดใช้งานรายการ "${item.name}"?`,
          confirmLabel: "เปิดใช้งาน",
          tone: "default",
        })
      : await confirm({
          title: `ปิดใช้งานรายการ "${item.name}"?`,
          description: "จะไม่แสดงในขั้นตอนตรวจห้อง",
          confirmLabel: "ปิดใช้งาน",
          tone: "danger",
        });
    if (!confirmed) return;

    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/inspection-catalog/${item.id}`, {
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
        <p className="text-sm font-medium text-foreground">ราคากลางตรวจห้อง</p>
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
        <p className="text-sm text-muted-foreground">กำลังโหลดราคากลาง...</p>
      ) : null}
      {error ? (
        <p className="mb-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีราคากลาง</p>
      ) : null}

      <div className="max-h-64 space-y-2 overflow-y-auto">
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-3 text-sm ${
              item.isActive
                ? "border-border"
                : "border-border bg-background opacity-80"
            }`}
          >
            <div>
              <span className="font-medium text-foreground">{item.name}</span>
              <span className="ml-2 text-muted-foreground">{typeLabel(item.type)}</span>
              {!item.isActive ? (
                <span className="ml-2 rounded-full bg-border px-2 py-0.5 text-xs text-muted-foreground">
                  ปิดใช้
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-primary">
                {formatCurrency(item.unitPrice)}
              </span>
              <button
                type="button"
                onClick={() => openEdit(item)}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface"
              >
                <Pencil size={14} />
                แก้ไข
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void toggleActive(item)}
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface disabled:opacity-50"
              >
                {item.isActive ? "ปิดใช้" : "เปิดใช้"}
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
          aria-labelledby="inspection-catalog-form-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl">
            <h3
              id="inspection-catalog-form-title"
              className="text-lg font-semibold text-foreground"
            >
              {editingId ? "แก้ไขราคากลาง" : "เพิ่มราคากลาง"}
            </h3>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => void submitForm(e)}
            >
              <label className="block text-sm">
                ชื่อรายการ
                <input
                  required
                  value={form.name}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, name: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  ประเภท
                  <select
                    value={form.type}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        type: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                  >
                    {inspectionItemTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  ราคากลาง (บาท)
                  <input
                    required
                    type="number"
                    min={0}
                    step={1}
                    value={form.unitPrice}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        unitPrice: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                  />
                </label>
              </div>
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
