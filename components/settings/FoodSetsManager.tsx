"use client";

import { Pencil, Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import BookingFoodSelect, {
  type BookingFoodItem,
} from "@/components/ui/BookingFoodSelect";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import type { FoodSetRecord } from "@/lib/settings/food-sets";

type FormState = {
  name: string;
  description: string;
  isActive: boolean;
  items: BookingFoodItem[];
};

const emptyForm: FormState = {
  name: "",
  description: "",
  isActive: true,
  items: [],
};

type ApiErrorBody = {
  message?: string;
};

export function FoodSetsManager() {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [items, setItems] = useState<FoodSetRecord[]>([]);
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
      const response = await fetch("/api/food-sets?active=false", {
        cache: "no-store",
      });
      const body = (await response.json()) as FoodSetRecord[] | ApiErrorBody;
      if (!response.ok || !Array.isArray(body)) {
        throw new Error(
          !Array.isArray(body) && body.message
            ? body.message
            : "โหลดชุดอาหารไม่สำเร็จ",
        );
      }
      setItems(body);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "โหลดชุดอาหารไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const activeCount = useMemo(
    () => items.filter((item) => item.isActive).length,
    [items],
  );

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (item: FoodSetRecord) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      description: item.description ?? "",
      isActive: item.isActive,
      items: item.items.map((row) => ({
        productId: row.productId,
        quantity: row.quantity,
      })),
    });
    setFormError("");
    setModalOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) {
      setFormError("กรุณาระบุชื่อชุดอาหาร");
      return;
    }
    if (!form.items.length) {
      setFormError("ต้องเลือกอาหารอย่างน้อย 1 รายการ");
      return;
    }

    setSaving(true);
    setFormError("");
    setMessage("");
    try {
      const response = await fetch(
        editingId ? `/api/food-sets/${editingId}` : "/api/food-sets",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            description: form.description.trim() || null,
            isActive: form.isActive,
            items: form.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
            })),
          }),
        },
      );
      const body = (await response.json()) as ApiErrorBody;
      if (!response.ok) {
        throw new Error(body.message ?? "บันทึกชุดอาหารไม่สำเร็จ");
      }
      setModalOpen(false);
      setMessage(editingId ? "อัปเดตชุดอาหารแล้ว" : "สร้างชุดอาหารแล้ว");
      await loadItems();
    } catch (reason) {
      setFormError(
        reason instanceof Error ? reason.message : "บันทึกชุดอาหารไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: FoodSetRecord) => {
    const ok = await confirm({
      title: "ลบชุดอาหาร?",
      description: `ลบ “${item.name}” — การปรับของกรุ๊ปที่อ้างอิงชุดนี้จะคงอยู่ แต่จะไม่ผูกต้นทาง`,
      confirmLabel: "ลบ",
      tone: "danger",
    });
    if (!ok) return;

    setMessage("");
    try {
      const response = await fetch(`/api/food-sets/${item.id}`, {
        method: "DELETE",
      });
      const body = (await response.json()) as ApiErrorBody;
      if (!response.ok) {
        throw new Error(body.message ?? "ลบชุดอาหารไม่สำเร็จ");
      }
      setMessage(`ลบ “${item.name}” แล้ว`);
      await loadItems();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "ลบชุดอาหารไม่สำเร็จ",
      );
    }
  };

  return (
    <div className="space-y-4">
      {confirmDialog}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">ชุดอาหาร</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            จัดชุดเมนูมาตรฐานสำหรับกรุ๊ปทัวร์ — เมื่อสั่งจะขยายเป็นรายการให้แม่ครัว
            การปรับเปลี่ยนเก็บเฉพาะกรุ๊ปนั้น
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {activeCount}/{items.length} เปิดใช้
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
        >
          <Plus size={16} />
          เพิ่มชุดอาหาร
        </button>
      </div>

      {error ? (
        <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-xl bg-success/10 p-3 text-sm text-success">
          {message}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
          <UtensilsCrossed
            className="mx-auto text-muted-foreground"
            size={28}
          />
          <p className="mt-3 text-sm text-muted-foreground">
            ยังไม่มีชุดอาหาร — สร้างเช่น Set 1, Set 2 สำหรับกรุ๊ปทัวร์
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {item.name}
                  {!item.isActive ? (
                    <span className="ml-2 text-xs text-muted-foreground">
                      (ปิดใช้)
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.itemCount} รายการ
                  {item.description ? ` · ${item.description}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-muted"
                >
                  <Pencil size={14} />
                  แก้ไข
                </button>
                <button
                  type="button"
                  onClick={() => void remove(item)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                >
                  <Trash2 size={14} />
                  ลบ
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-background p-5 shadow-xl">
            <h3 className="text-base font-semibold text-foreground">
              {editingId ? "แก้ไขชุดอาหาร" : "เพิ่มชุดอาหาร"}
            </h3>
            <div className="mt-4 space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">ชื่อชุด</span>
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="เช่น Set 1"
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">คำอธิบาย</span>
                <input
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  placeholder="ไม่บังคับ"
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      isActive: event.target.checked,
                    }))
                  }
                />
                เปิดใช้
              </label>
              <div>
                <p className="mb-2 text-sm font-medium">รายการในชุด</p>
                <BookingFoodSelect
                  items={form.items}
                  onChange={(next) =>
                    setForm((prev) => ({ ...prev, items: next }))
                  }
                  included={false}
                />
              </div>
              {formError ? (
                <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                  {formError}
                </p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {saving ? "กำลังบันทึก..." : "บันทึก"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
