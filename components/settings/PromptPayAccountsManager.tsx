"use client";

import { Pencil, Plus, QrCode } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import {
  promptPayIdTypeOptions,
  type PromptPayAccountDetailRecord,
} from "@/lib/settings/promptpay-account-shared";

type FormState = {
  displayName: string;
  idType: string;
  identifier: string;
  accountName: string;
  bankName: string;
  notes: string;
  isPrimary: boolean;
};

const emptyForm: FormState = {
  displayName: "",
  idType: "PHONE",
  identifier: "",
  accountName: "",
  bankName: "",
  notes: "",
  isPrimary: false,
};

type ApiErrorBody = { message?: string };

function typeLabel(value: string) {
  return (
    promptPayIdTypeOptions.find((item) => item.value === value)?.label ?? value
  );
}

export function PromptPayAccountsManager() {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [items, setItems] = useState<PromptPayAccountDetailRecord[]>([]);
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
      const response = await fetch("/api/promptpay-accounts/master", {
        cache: "no-store",
      });
      const body = (await response.json()) as
        | PromptPayAccountDetailRecord[]
        | ApiErrorBody;
      if (!response.ok || !Array.isArray(body)) {
        throw new Error(
          !Array.isArray(body) ? body.message : "โหลดบัญชีพร้อมเพย์ไม่สำเร็จ",
        );
      }
      setItems(body);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "โหลดบัญชีพร้อมเพย์ไม่สำเร็จ",
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

  const openEdit = (item: PromptPayAccountDetailRecord) => {
    setEditingId(item.id);
    setForm({
      displayName: item.displayName,
      idType: item.idType,
      identifier: item.identifier,
      accountName: item.accountName,
      bankName: item.bankName ?? "",
      notes: item.notes ?? "",
      isPrimary: item.isPrimary,
    });
    setFormError("");
    setModalOpen(true);
  };

  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch(
        editingId
          ? `/api/promptpay-accounts/${editingId}`
          : "/api/promptpay-accounts",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: form.displayName,
            idType: form.idType,
            identifier: form.identifier,
            accountName: form.accountName,
            bankName: form.bankName,
            notes: form.notes,
            isPrimary: form.isPrimary,
          }),
        },
      );
      const body = (await response.json()) as ApiErrorBody;
      if (!response.ok) {
        throw new Error(body.message ?? "บันทึกไม่สำเร็จ");
      }
      setModalOpen(false);
      await loadItems();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: PromptPayAccountDetailRecord) => {
    const nextActive = !item.isActive;
    const ok = nextActive
      ? await confirm({
          title: `เปิดใช้งาน "${item.displayName}"?`,
          confirmLabel: "เปิดใช้งาน",
        })
      : await confirm({
          title: `ปิดใช้งาน "${item.displayName}"?`,
          description:
            item.paymentCount > 0
              ? `มีประวัติรับชำระ ${item.paymentCount} รายการ — จะไม่ลบประวัติ`
              : "จะไม่แสดงเป็นตัวเลือกสร้าง QR",
          confirmLabel: "ปิดใช้งาน",
          tone: "danger",
        });
    if (!ok) return;

    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/promptpay-accounts/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: nextActive }),
      });
      const body = (await response.json()) as ApiErrorBody;
      if (!response.ok) throw new Error(body.message ?? "อัปเดตไม่สำเร็จ");
      await loadItems();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "อัปเดตไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const setPrimary = async (item: PromptPayAccountDetailRecord) => {
    if (item.isPrimary) return;
    const ok = await confirm({
      title: `ตั้ง "${item.displayName}" เป็นบัญชีหลัก?`,
      description: "บัญชีหลัก active ได้เพียงหนึ่งบัญชี",
      confirmLabel: "ตั้งเป็นหลัก",
      tone: "warning",
    });
    if (!ok) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/promptpay-accounts/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrimary: true, isActive: true }),
      });
      const body = (await response.json()) as ApiErrorBody;
      if (!response.ok) throw new Error(body.message ?? "ตั้งบัญชีหลักไม่สำเร็จ");
      await loadItems();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "ตั้งบัญชีหลักไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 space-y-4">
      {confirmDialog}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">บัญชีพร้อมเพย์</p>
          <p className="text-xs text-muted-foreground">
            ใช้สร้าง QR รับชำระจากหน้ารายละเอียดการจอง
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          <Plus size={16} />
          เพิ่มบัญชี
        </button>
      </div>

      {error ? (
        <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">กำลังโหลด...</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-border bg-surface p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">
                      {item.displayName}
                    </p>
                    {item.isPrimary ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        บัญชีหลัก
                      </span>
                    ) : null}
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        item.isActive
                          ? "bg-success/10 text-success"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {item.isActive ? "เปิดใช้" : "ปิดใช้"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.accountName} · {typeLabel(item.idType)} ·{" "}
                    {item.identifierMasked}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs"
                  >
                    <Pencil size={14} />
                    แก้ไข
                  </button>
                  {!item.isPrimary && item.isActive ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void setPrimary(item)}
                      className="rounded-lg border border-border px-2.5 py-1.5 text-xs"
                    >
                      ตั้งเป็นหลัก
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void toggleActive(item)}
                    className="rounded-lg border border-border px-2.5 py-1.5 text-xs"
                  >
                    {item.isActive ? "ปิดใช้" : "เปิดใช้"}
                  </button>
                </div>
              </div>
            </article>
          ))}
          {items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              <QrCode className="mx-auto mb-2 text-muted-foreground" />
              ยังไม่มีบัญชีพร้อมเพย์
            </p>
          ) : null}
        </div>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-foreground/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl">
            <h3 className="text-lg font-semibold">
              {editingId ? "แก้ไขบัญชีพร้อมเพย์" : "เพิ่มบัญชีพร้อมเพย์"}
            </h3>
            <form className="mt-4 space-y-3" onSubmit={(e) => void submitForm(e)}>
              <label className="block text-sm">
                ชื่อเรียก
                <input
                  required
                  value={form.displayName}
                  onChange={(e) =>
                    setForm((c) => ({ ...c, displayName: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                ประเภท
                <select
                  value={form.idType}
                  onChange={(e) =>
                    setForm((c) => ({ ...c, idType: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                >
                  {promptPayIdTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                หมายเลขพร้อมเพย์
                <input
                  required
                  value={form.identifier}
                  onChange={(e) =>
                    setForm((c) => ({ ...c, identifier: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                ชื่อบัญชีแสดง
                <input
                  required
                  value={form.accountName}
                  onChange={(e) =>
                    setForm((c) => ({ ...c, accountName: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                ธนาคาร (ไม่บังคับ)
                <input
                  value={form.bankName}
                  onChange={(e) =>
                    setForm((c) => ({ ...c, bankName: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isPrimary}
                  onChange={(e) =>
                    setForm((c) => ({ ...c, isPrimary: e.target.checked }))
                  }
                />
                ตั้งเป็นบัญชีหลัก
              </label>
              {formError ? (
                <p className="text-sm text-destructive">{formError}</p>
              ) : null}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm text-primary-foreground disabled:opacity-50"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
