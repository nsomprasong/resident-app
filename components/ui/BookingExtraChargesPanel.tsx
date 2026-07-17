"use client";

import {
  Check,
  Minus,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { BookingChargeTemplateRecord } from "@/lib/bookings/charge-templates";
import {
  createExtraChargeDraft,
  extraChargeLineTotal,
  type BookingExtraChargeDraft,
} from "@/lib/bookings/extra-charges";

import NumberInput from "./NumberInput";

export type { BookingExtraChargeDraft };

type CatalogDraft = {
  id: string | null;
  name: string;
  defaultAmount: number;
  type: BookingChargeTemplateRecord["type"];
};

function emptyCatalogDraft(): CatalogDraft {
  return { id: null, name: "", defaultAmount: 0, type: "OTHER" };
}

function formatBaht(value: number) {
  return `฿${value.toLocaleString()}`;
}

export default function BookingExtraChargesPanel({
  items,
  onChange,
}: {
  items: BookingExtraChargeDraft[];
  onChange: (items: BookingExtraChargeDraft[]) => void;
}) {
  const [templates, setTemplates] = useState<BookingChargeTemplateRecord[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [managing, setManaging] = useState(false);
  const [catalogDraft, setCatalogDraft] = useState<CatalogDraft | null>(null);
  const [savingCatalog, setSavingCatalog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    setLoadError("");
    try {
      const response = await fetch("/api/booking-charge-templates", {
        cache: "no-store",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setTemplates([]);
        setLoadError(
          data?.message ??
            "โหลดรายการจากระบบไม่สำเร็จ — ลองรีเฟรชหน้า หรือรีสตาร์ทเซิร์ฟเวอร์",
        );
        return;
      }
      setTemplates((await response.json()) as BookingChargeTemplateRecord[]);
    } catch {
      setTemplates([]);
      setLoadError("เชื่อมต่อระบบไม่ได้ — ลองรีเฟรชหน้า");
    } finally {
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const total = items.reduce(
    (sum, item) => sum + extraChargeLineTotal(item),
    0,
  );

  const selectedQty = (templateId: string) =>
    items.find((item) => item.templateId === templateId)?.quantity ?? 0;

  const toggleTemplate = (template: BookingChargeTemplateRecord) => {
    const existing = items.find((item) => item.templateId === template.id);
    if (existing) {
      onChange(items.filter((item) => item.key !== existing.key));
      return;
    }
    onChange([
      ...items,
      createExtraChargeDraft({
        description: template.name,
        type: template.type,
        amount: template.defaultAmount,
        quantity: 1,
        templateId: template.id,
      }),
    ]);
  };

  const setQuantity = (key: string, quantity: number) => {
    const next = Math.max(1, Math.floor(quantity) || 1);
    onChange(
      items.map((item) =>
        item.key === key ? { ...item, quantity: next } : item,
      ),
    );
  };

  const bumpQuantity = (key: string, delta: number) => {
    const item = items.find((row) => row.key === key);
    if (!item) return;
    const next = item.quantity + delta;
    if (next < 1) {
      onChange(items.filter((row) => row.key !== key));
      return;
    }
    setQuantity(key, next);
  };

  const removeBookingLine = (key: string) => {
    onChange(items.filter((item) => item.key !== key));
  };

  const startCreate = () => {
    setManaging(true);
    setMessage("");
    setCatalogDraft(emptyCatalogDraft());
  };

  const startEdit = (template: BookingChargeTemplateRecord) => {
    setManaging(true);
    setMessage("");
    setCatalogDraft({
      id: template.id,
      name: template.name,
      defaultAmount: template.defaultAmount,
      type: template.type,
    });
  };

  const cancelCatalogEdit = () => {
    setCatalogDraft(null);
  };

  const saveCatalog = async () => {
    if (!catalogDraft) return;
    const name = catalogDraft.name.trim();
    if (!name) {
      setMessage("กรุณาระบุชื่อรายการ");
      return;
    }
    if (
      !Number.isFinite(catalogDraft.defaultAmount) ||
      catalogDraft.defaultAmount < 0
    ) {
      setMessage("กรุณาระบุราคาต่อหน่วยที่ถูกต้อง");
      return;
    }

    setSavingCatalog(true);
    setMessage("");
    try {
      const isUpdate = Boolean(catalogDraft.id);
      const response = await fetch(
        isUpdate
          ? `/api/booking-charge-templates/${catalogDraft.id}`
          : "/api/booking-charge-templates",
        {
          method: isUpdate ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            type: catalogDraft.type,
            defaultAmount: catalogDraft.defaultAmount,
            isActive: true,
          }),
        },
      );
      const data = (await response.json()) as
        | BookingChargeTemplateRecord
        | { message?: string };
      if (!response.ok) {
        throw new Error(
          "message" in data ? data.message : "บันทึกรายการไม่สำเร็จ",
        );
      }
      setMessage(isUpdate ? `แก้ไข「${name}」แล้ว` : `เพิ่ม「${name}」แล้ว`);
      if (isUpdate && catalogDraft.id) {
        onChange(
          items.map((item) =>
            item.templateId === catalogDraft.id
              ? {
                  ...item,
                  description: name,
                  amount: catalogDraft.defaultAmount,
                  type: catalogDraft.type,
                }
              : item,
          ),
        );
      }
      setCatalogDraft(null);
      await loadTemplates();
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : "บันทึกรายการไม่สำเร็จ",
      );
    } finally {
      setSavingCatalog(false);
    }
  };

  const deleteCatalog = async (template: BookingChargeTemplateRecord) => {
    if (!window.confirm(`ลบ「${template.name}」ออกจากระบบ?`)) return;
    setDeletingId(template.id);
    setMessage("");
    try {
      const response = await fetch(
        `/api/booking-charge-templates/${template.id}`,
        { method: "DELETE" },
      );
      const data = (await response.json()) as { message?: string };
      if (!response.ok) {
        throw new Error(data.message ?? "ลบรายการไม่สำเร็จ");
      }
      onChange(items.filter((item) => item.templateId !== template.id));
      setMessage(`ลบ「${template.name}」แล้ว`);
      if (catalogDraft?.id === template.id) setCatalogDraft(null);
      await loadTemplates();
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : "ลบรายการไม่สำเร็จ",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            ค่าใช้จ่ายเพิ่มเติม
          </h3>
          <p className="text-xs text-muted-foreground">
            {items.length
              ? `${items.length} รายการ · รวม ${formatBaht(total)}`
              : "เลือกจากรายการด้านล่าง"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setManaging((value) => !value);
            setCatalogDraft(null);
            setMessage("");
          }}
          className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors ${
            managing
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-background hover:text-foreground"
          }`}
          aria-pressed={managing}
        >
          <Settings2 size={14} />
          จัดการ
        </button>
      </div>

      <div className="space-y-3 p-4">
        {loadingTemplates ? (
          <p className="text-xs text-muted-foreground">กำลังโหลด...</p>
        ) : loadError ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2">
            <p className="text-xs text-destructive">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadTemplates()}
              className="text-xs font-medium text-primary hover:underline"
            >
              ลองใหม่
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {templates.map((template) => {
              const qty = selectedQty(template.id);
              const selected = qty > 0;
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => toggleTemplate(template)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:border-primary/40"
                  }`}
                >
                  {selected ? <Check size={12} strokeWidth={2.5} /> : null}
                  <span>{template.name}</span>
                  <span
                    className={
                      selected
                        ? "opacity-80"
                        : "font-normal text-muted-foreground"
                    }
                  >
                    {formatBaht(template.defaultAmount)}
                    {selected && qty > 1 ? ` ×${qty}` : ""}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground"
            >
              <Plus size={12} />
              เพิ่ม
            </button>
          </div>
        )}

        {managing || catalogDraft ? (
          <div className="space-y-2 rounded-xl border border-border/80 bg-background/80 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                รายการในระบบ
              </p>
              {!catalogDraft ? (
                <button
                  type="button"
                  onClick={startCreate}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Plus size={12} />
                  เพิ่มรายการ
                </button>
              ) : null}
            </div>

            {catalogDraft && !catalogDraft.id ? (
              <div className="flex flex-wrap items-end gap-2 rounded-lg border border-primary/25 bg-primary/5 p-2.5">
                <label className="min-w-[10rem] flex-1 text-[11px] text-muted-foreground">
                  ชื่อรายการใหม่
                  <input
                    autoFocus
                    value={catalogDraft.name}
                    onChange={(event) =>
                      setCatalogDraft({
                        ...catalogDraft,
                        name: event.target.value,
                      })
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void saveCatalog();
                      }
                    }}
                    placeholder="เช่น ค่าแก๊ส"
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                  />
                </label>
                <label className="w-24 text-[11px] text-muted-foreground">
                  ราคา
                  <NumberInput
                    min={0}
                    emptyValue={0}
                    value={catalogDraft.defaultAmount}
                    onChange={(defaultAmount) =>
                      setCatalogDraft({ ...catalogDraft, defaultAmount })
                    }
                    className="mt-1 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                  />
                </label>
                <button
                  type="button"
                  disabled={savingCatalog}
                  onClick={() => void saveCatalog()}
                  className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  {savingCatalog ? "..." : "บันทึก"}
                </button>
                <button
                  type="button"
                  disabled={savingCatalog}
                  onClick={cancelCatalogEdit}
                  className="inline-flex h-8 items-center rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  ยกเลิก
                </button>
              </div>
            ) : null}

            {templates.length === 0 && !catalogDraft ? (
              <p className="text-xs text-muted-foreground">
                ยังไม่มีรายการ — กด「เพิ่มรายการ」เพื่อสร้างในระบบ
              </p>
            ) : (
              <ul className="divide-y divide-border/70">
                {templates.map((template) => {
                  const editing =
                    catalogDraft?.id === template.id ? catalogDraft : null;
                  if (editing) {
                    return (
                      <li key={template.id} className="py-2">
                        <div className="flex flex-wrap items-end gap-2">
                          <label className="min-w-[10rem] flex-1 text-[11px] text-muted-foreground">
                            ชื่อ
                            <input
                              autoFocus
                              value={editing.name}
                              onChange={(event) =>
                                setCatalogDraft({
                                  ...editing,
                                  name: event.target.value,
                                })
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  void saveCatalog();
                                }
                              }}
                              className="mt-1 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                            />
                          </label>
                          <label className="w-24 text-[11px] text-muted-foreground">
                            ราคา
                            <NumberInput
                              min={0}
                              emptyValue={0}
                              value={editing.defaultAmount}
                              onChange={(defaultAmount) =>
                                setCatalogDraft({ ...editing, defaultAmount })
                              }
                              className="mt-1 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-primary"
                            />
                          </label>
                          <button
                            type="button"
                            disabled={savingCatalog}
                            onClick={() => void saveCatalog()}
                            className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50"
                          >
                            {savingCatalog ? "..." : "บันทึก"}
                          </button>
                          <button
                            type="button"
                            disabled={savingCatalog}
                            onClick={cancelCatalogEdit}
                            className="inline-flex h-8 items-center rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      </li>
                    );
                  }

                  return (
                    <li
                      key={template.id}
                      className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">
                          {template.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatBaht(template.defaultAmount)}/หน่วย
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => startEdit(template)}
                        className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-surface hover:text-primary"
                      >
                        <Pencil size={13} />
                        แก้ไข
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === template.id}
                        onClick={() => void deleteCatalog(template)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-surface hover:text-destructive disabled:opacity-50"
                        aria-label={`ลบ ${template.name}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-border">
            <ul className="divide-y divide-border">
              {items.map((item) => {
                const lineTotal = extraChargeLineTotal(item);
                return (
                  <li
                    key={item.key}
                    className="flex items-center gap-2 bg-background px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.description || "รายการ"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatBaht(item.amount)}
                        {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                      </p>
                    </div>

                    <div className="inline-flex items-center rounded-lg border border-border">
                      <button
                        type="button"
                        onClick={() => bumpQuantity(item.key, -1)}
                        className="inline-flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground"
                        aria-label="ลดจำนวน"
                      >
                        <Minus size={12} />
                      </button>
                      <NumberInput
                        min={1}
                        emptyValue={1}
                        step={1}
                        value={item.quantity}
                        onChange={(quantity) =>
                          setQuantity(item.key, quantity)
                        }
                        className="h-7 w-10 border-0 bg-transparent px-0 text-center text-sm font-medium text-foreground outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => bumpQuantity(item.key, 1)}
                        className="inline-flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground"
                        aria-label="เพิ่มจำนวน"
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    <p className="w-16 text-right text-sm font-medium tabular-nums text-foreground">
                      {formatBaht(lineTotal)}
                    </p>

                    <button
                      type="button"
                      onClick={() => removeBookingLine(item.key)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-surface hover:text-destructive"
                      aria-label={`เอา ${item.description || "รายการ"} ออก`}
                    >
                      <X size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center justify-between bg-surface px-3 py-2 text-xs">
              <span className="text-muted-foreground">รวมค่าใช้จ่ายเพิ่ม</span>
              <span className="font-semibold tabular-nums text-foreground">
                {formatBaht(total)}
              </span>
            </div>
          </div>
        ) : null}

        {message ? (
          <p className="text-[11px] text-muted-foreground">{message}</p>
        ) : null}
      </div>
    </section>
  );
}
