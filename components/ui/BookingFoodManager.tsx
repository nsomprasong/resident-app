"use client";

import { Minus, Plus, Trash2, Utensils } from "lucide-react";
import { useState } from "react";

import { useConfirmDialog } from "@/hooks/useConfirmDialog";

import PricingToggle from "./PricingToggle";

export type ManagedFoodItem = {
  id: string;
  type: string;
  typeName?: string;
  isMinibar?: boolean;
  title: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  price: number;
  isExtra: boolean;
  editable: boolean;
  orderStatus: string;
  chargeTo?: "room" | "group";
  roomId?: string | null;
  roomNumber?: string | null;
};

export default function BookingFoodManager({
  items,
  canManage,
  mode,
  onChanged,
  onAdd,
}: {
  items: ManagedFoodItem[];
  canManage: boolean;
  mode: "group" | "solo";
  onChanged: () => void;
  onAdd?: () => void;
}) {
  const isGroup = mode === "group";
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const patchItem = async (
    item: ManagedFoodItem,
    patch: { quantity?: number; isExtra?: boolean },
  ) => {
    if (!item.editable || !canManage) return;
    setBusyId(item.id);
    setError("");
    try {
      const response = await fetch(`/api/order-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message);
      onChanged();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "อัปเดตรายการอาหารไม่สำเร็จ",
      );
    } finally {
      setBusyId(null);
    }
  };

  const total = items.reduce((sum, item) => sum + item.price, 0);

  return (
    <section className="rounded-2xl border border-border bg-surface shadow-sm">
      {confirmDialog}
      <div className="flex items-center justify-between gap-3 border-b border-border p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Utensils size={22} />
          </span>
          <div>
            <h3 className="font-medium">ค่าอาหาร</h3>
            <p className="text-xs text-muted-foreground">
              {items.length
                ? `${items.length} รายการ`
                : "ยังไม่มีรายการอาหาร"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-medium">฿{total.toLocaleString()}</span>
          {canManage && onAdd ? (
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex items-center gap-1 rounded-xl border border-secondary/30 px-3 py-1.5 text-sm text-secondary"
            >
              <Plus size={16} />
              เพิ่ม
            </button>
          ) : null}
        </div>
      </div>

      <div className="divide-y divide-border">
        {items.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            {canManage
              ? "กดเพิ่มเพื่อเลือกรายการอาหารทีหลังได้"
              : "ไม่มีรายการอาหาร"}
          </p>
        ) : (
          items.map((item) => {
            const locked = !item.editable || !canManage;
            return (
              <div
                key={item.id}
                className="space-y-2 px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {item.productName}
                      {!item.isExtra ? (
                        <span className="ml-1 text-xs font-normal text-success">
                          · รวมในเหมา
                        </span>
                      ) : isGroup ? (
                        <span className="ml-1 text-xs font-normal text-warning">
                          · คิดเพิ่ม
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ฿{item.unitPrice.toLocaleString()} / ชิ้น
                      {locked && item.orderStatus !== "PENDING"
                        ? ` · ${item.orderStatus === "CANCELLED" ? "ยกเลิกแล้ว" : "ครัวรับแล้ว แก้ไม่ได้"}`
                        : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {locked ? (
                      <span className="text-sm text-muted-foreground">
                        x {item.quantity}
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          aria-label="ลดจำนวน"
                          disabled={busyId === item.id}
                          onClick={() =>
                            void patchItem(item, {
                              quantity: Math.max(0, item.quantity - 1),
                            })
                          }
                          className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-muted disabled:opacity-50"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label="เพิ่มจำนวน"
                          disabled={busyId === item.id}
                          onClick={() =>
                            void patchItem(item, {
                              quantity: item.quantity + 1,
                            })
                          }
                          className="grid h-8 w-8 place-items-center rounded-lg border border-border hover:bg-muted disabled:opacity-50"
                        >
                          <Plus size={14} />
                        </button>
                        <button
                          type="button"
                          aria-label="ลบรายการ"
                          disabled={busyId === item.id}
                          onClick={() => {
                            void (async () => {
                              const ok = await confirm({
                                title: `ลบ ${item.productName}?`,
                                description: "รายการนี้จะถูกลบออกจากการจอง",
                                confirmLabel: "ลบรายการ",
                                tone: "danger",
                              });
                              if (ok) {
                                void patchItem(item, { quantity: 0 });
                              }
                            })();
                          }}
                          className="grid h-8 w-8 place-items-center rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                    <span className="min-w-16 text-right text-sm font-medium">
                      ฿{item.price.toLocaleString()}
                    </span>
                  </div>
                </div>
                {isGroup && !locked ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">การคิดเงิน</p>
                    <PricingToggle
                      value={item.isExtra}
                      disabled={busyId === item.id}
                      onChange={(isExtra) =>
                        void patchItem(item, { isExtra })
                      }
                    />
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
      {error ? (
        <p className="border-t border-border px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
