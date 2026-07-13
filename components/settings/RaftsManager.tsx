"use client";

import { Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  raftStatusOptions,
  type RaftMasterRecord,
} from "@/lib/settings/raft-master-shared";

type FormState = {
  number: string;
  name: string;
  capacity: string;
  basePrice: string;
  status: string;
};

const emptyForm: FormState = {
  number: "",
  name: "",
  capacity: "10",
  basePrice: "",
  status: "AVAILABLE",
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

function statusLabel(status: string) {
  return raftStatusOptions.find((item) => item.value === status)?.label ?? status;
}

export function RaftsManager() {
  const [items, setItems] = useState<RaftMasterRecord[]>([]);
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
      const response = await fetch("/api/rafts/master", { cache: "no-store" });
      const body = (await response.json()) as RaftMasterRecord[] | ApiErrorBody;
      if (!response.ok || !Array.isArray(body)) {
        throw new Error(
          !Array.isArray(body) && body.message
            ? body.message
            : "โหลดรายการแพไม่สำเร็จ",
        );
      }
      setItems(body);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "โหลดรายการแพไม่สำเร็จ",
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

  const openEdit = (item: RaftMasterRecord) => {
    setEditingId(item.id);
    setForm({
      number: item.number,
      name: item.name,
      capacity: String(item.capacity),
      basePrice: String(item.basePrice),
      status: item.status,
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
        number: form.number.trim(),
        name: form.name.trim(),
        capacity: Number.parseInt(form.capacity, 10),
        basePrice: Number(form.basePrice),
        status: form.status,
      };

      const response = await fetch(
        editingId ? `/api/rafts/${editingId}` : "/api/rafts",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      const body = (await response.json()) as RaftMasterRecord | ApiErrorBody;
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

  const setMaintenance = async (item: RaftMasterRecord) => {
    if (
      !window.confirm(
        `ตั้งแพ ${item.name} (${item.number}) เป็นปิดซ่อม (ไม่เปิดให้จองใหม่)?`,
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/rafts/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "MAINTENANCE" }),
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
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">แพ</p>
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
        <p className="text-sm text-muted-foreground">กำลังโหลดแพ...</p>
      ) : null}
      {error ? (
        <p className="mb-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {!loading && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีแพ</p>
      ) : null}

      <div className="max-h-64 space-y-2 overflow-y-auto">
        {items.map((raft) => (
          <div
            key={raft.id}
            className="rounded-2xl border border-border p-3 text-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <span className="font-medium text-foreground">{raft.name}</span>
                <span className="ml-2 text-muted-foreground">#{raft.number}</span>
                <span className="ml-2 text-muted-foreground">
                  ความจุ {raft.capacity}
                </span>
                <span className="ml-2 text-muted-foreground">
                  {statusLabel(raft.status)}
                </span>
              </div>
              <span className="font-medium text-primary">
                {formatCurrency(raft.basePrice)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openEdit(raft)}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
              >
                <Pencil size={14} />
                แก้ไข
              </button>
              {raft.status !== "MAINTENANCE" ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void setMaintenance(raft)}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
                >
                  ปิดจากการจอง
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="raft-form-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl">
            <h3
              id="raft-form-title"
              className="text-lg font-semibold text-foreground"
            >
              {editingId ? "แก้ไขแพ" : "เพิ่มแพ"}
            </h3>
            <form className="mt-4 space-y-3" onSubmit={(e) => void submitForm(e)}>
              <label className="block text-sm">
                หมายเลขแพ
                <input
                  required
                  value={form.number}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, number: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                ชื่อแพ
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
                  ความจุ
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
              </div>
              <label className="block text-sm">
                สถานะ
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((current) => ({ ...current, status: e.target.value }))
                  }
                  className="mt-1 w-full rounded-xl border border-border px-3 py-2"
                >
                  {raftStatusOptions.map((option) => (
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
