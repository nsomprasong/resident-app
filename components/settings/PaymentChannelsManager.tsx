"use client";

import { Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import {
  paymentMethodOptions,
  type PaymentChannelMasterRecord,
} from "@/lib/settings/payment-channel-shared";

type FormState = {
  name: string;
  method: string;
};

const emptyForm: FormState = {
  name: "",
  method: "CASH",
};

type ApiErrorBody = {
  message?: string;
};

function methodLabel(method: string) {
  return (
    paymentMethodOptions.find((item) => item.value === method)?.label ?? method
  );
}

export function PaymentChannelsManager() {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [items, setItems] = useState<PaymentChannelMasterRecord[]>([]);
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
      const response = await fetch("/api/payment-channels/master", {
        cache: "no-store",
      });
      const body = (await response.json()) as
        | PaymentChannelMasterRecord[]
        | ApiErrorBody;
      if (!response.ok || !Array.isArray(body)) {
        throw new Error(
          !Array.isArray(body) && body.message
            ? body.message
            : "โหลดช่องทางรับชำระไม่สำเร็จ",
        );
      }
      setItems(body);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "โหลดช่องทางรับชำระไม่สำเร็จ",
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

  const openEdit = (item: PaymentChannelMasterRecord) => {
    setEditingId(item.id);
    setForm({ name: item.name, method: item.method });
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
        method: form.method,
      };

      const response = await fetch(
        editingId
          ? `/api/payment-channels/${editingId}`
          : "/api/payment-channels",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const body = (await response.json()) as
        | PaymentChannelMasterRecord
        | { id: string; name: string; method: string }
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

  const toggleActive = async (item: PaymentChannelMasterRecord) => {
    const nextActive = !item.isActive;
    const confirmed = nextActive
      ? await confirm({
          title: `เปิดใช้งานช่องทาง "${item.name}"?`,
          confirmLabel: "เปิดใช้งาน",
          tone: "default",
        })
      : await confirm({
          title: `ปิดใช้งานช่องทาง "${item.name}"?`,
          description:
            item.paymentCount > 0
              ? `มีประวัติรับชำระ ${item.paymentCount} รายการ การปิดใช้งานจะไม่ลบประวัติ แต่จะไม่ให้เลือกช่องทางนี้ใหม่`
              : "จะไม่แสดงในหน้ารับชำระเงิน",
          confirmLabel: "ปิดใช้งาน",
          tone: "danger",
        });

    if (!confirmed) return;

    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/payment-channels/${item.id}`, {
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
        <p className="text-sm font-medium text-foreground">ช่องทางรับชำระ</p>
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
        <p className="text-sm text-muted-foreground">กำลังโหลดช่องทาง...</p>
      ) : null}
      {error ? (
        <p className="mb-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีช่องทางรับชำระ</p>
      ) : null}

      <div className="space-y-2">
        {items.map((channel) => (
          <div
            key={channel.id}
            className={`rounded-2xl border p-3 text-sm ${
              channel.isActive
                ? "border-border"
                : "border-border bg-background opacity-80"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-medium text-foreground">
                  {channel.name}
                </span>
                <span className="ml-2 text-muted-foreground">
                  {methodLabel(channel.method)}
                </span>
                <span className="ml-2 text-muted-foreground">
                  {channel.paymentCount} รายการ
                </span>
                {!channel.isActive ? (
                  <span className="ml-2 rounded-full bg-border px-2 py-0.5 text-xs text-muted-foreground">
                    ปิดใช้
                  </span>
                ) : null}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openEdit(channel)}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
              >
                <Pencil size={14} />
                แก้ไข
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void toggleActive(channel)}
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
              >
                {channel.isActive ? "ปิดใช้" : "เปิดใช้"}
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
          aria-labelledby="payment-channel-form-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl">
            <h3
              id="payment-channel-form-title"
              className="text-lg font-semibold text-foreground"
            >
              {editingId ? "แก้ไขช่องทางรับชำระ" : "เพิ่มช่องทางรับชำระ"}
            </h3>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => void submitForm(e)}
            >
              <label className="block text-sm">
                ชื่อช่องทาง
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
                ประเภท
                <select
                  value={form.method}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      method: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                >
                  {paymentMethodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
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
