"use client";

import { DoorOpen, Save, UsersRound, X } from "lucide-react";
import { useEffect, useState } from "react";

import BookingFoodSelect, { type BookingFoodItem } from "./BookingFoodSelect";
import Modal from "./Modal";

type BookingRoom = {
  id: string;
  number: string;
};

export default function AddBookingFoodDialog({
  open,
  setOpen,
  bookingId,
  mode,
  rooms = [],
  onAdded,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  bookingId: string;
  mode: "group" | "solo";
  rooms?: BookingRoom[];
  onAdded: () => void;
}) {
  const isGroup = mode === "group";
  const [items, setItems] = useState<BookingFoodItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  /** null = group bill; room id = charge to that room */
  const [chargeRoomId, setChargeRoomId] = useState<string | null>(null);

  const soloRoomId = rooms[0]?.id ?? null;

  useEffect(() => {
    if (!open) return;
    setItems([]);
    setError("");
    setChargeRoomId(isGroup ? null : soloRoomId);
  }, [open, isGroup, soloRoomId]);

  const submit = async () => {
    if (!items.length) return;
    if (
      isGroup &&
      chargeRoomId &&
      !rooms.some((room) => room.id === chargeRoomId)
    ) {
      setError("ห้องที่เลือกไม่ถูกต้อง");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          roomId: isGroup ? chargeRoomId : chargeRoomId,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            isExtra: isGroup ? (item.isExtra ?? true) : true,
          })),
        }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message);
      setItems([]);
      setOpen(false);
      onAdded();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "เพิ่มรายการอาหารไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title={isGroup ? "จัดการรายการอาหาร" : "เพิ่มรายการอาหาร"}
      size="lg"
      fullScreenOnMobile
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            <X size={17} />
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving || !items.length}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={17} />
            {saving ? "กำลังเพิ่ม..." : "เพิ่มในรายการจอง"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {isGroup
            ? "เลือกอาหาร กำหนดเหมา/คิดเพิ่ม และเลือกว่าลงบิลกรุ๊ปหรือแยกห้อง"
            : "เลือกอาหารที่ต้องการเพิ่ม โดยคิดตามราคาจริง"}
        </p>

        {isGroup ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              สั่งให้ใคร / ลงบิลไหน
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setChargeRoomId(null)}
                className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                  chargeRoomId === null
                    ? "border-success/40 bg-success/10 text-success"
                    : "border-border bg-background text-foreground hover:border-primary/40"
                }`}
              >
                <UsersRound size={18} className="shrink-0" />
                <span>
                  <span className="block text-sm font-medium">ลงบิลกรุ๊ป</span>
                  <span className="block text-xs opacity-80">
                    รวมในบิลกลุ่มทัวร์
                  </span>
                </span>
              </button>
              {rooms.map((room) => (
                <button
                  type="button"
                  key={room.id}
                  onClick={() => setChargeRoomId(room.id)}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                    chargeRoomId === room.id
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-border bg-background text-foreground hover:border-primary/40"
                  }`}
                >
                  <DoorOpen size={18} className="shrink-0" />
                  <span>
                    <span className="block text-sm font-medium">
                      ห้อง {room.number}
                    </span>
                    <span className="block text-xs opacity-80">
                      สั่งแยกห้องนี้
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <BookingFoodSelect
          items={items}
          onChange={setItems}
          included={false}
          allowPackagePricing={isGroup}
          defaultIsExtra
        />
        {error ? (
          <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
