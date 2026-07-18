"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Save } from "lucide-react";

import BookingExtraChargesPanel, {
  type BookingExtraChargeDraft,
} from "./BookingExtraChargesPanel";
import BookingFoodSetPanel from "./BookingFoodSetPanel";
import {
  foodItemsMissingRequiredOptions,
  type BookingFoodItem,
} from "./BookingFoodSelect";
import DateSelector from "./DateSelector";
import GuestSuggestInput from "./GuestSuggestInput";
import Modal from "./Modal";
import RaftSelect from "./RaftSelect";
import ZoneRoomSelect from "./ZoneRoomSelect";
import { extraChargeLineTotal } from "@/lib/bookings/extra-charges";

const dateText = (offset = 0) => {
  const value = new Date();
  value.setDate(value.getDate() + offset);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
};

const nextDate = (date: string) => {
  if (!date) return "";
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
};

const fieldClass =
  "mt-1 w-full rounded-xl border border-border px-3 py-2.5 text-sm";

function resolveStayStart(initialCheckIn?: string) {
  if (initialCheckIn && /^\d{4}-\d{2}-\d{2}$/.test(initialCheckIn)) {
    return initialCheckIn;
  }
  return dateText();
}

export default function AddSoloBookingDialog({
  open,
  setOpen,
  onCreated,
  initialCheckIn,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  onCreated?: () => void;
  initialCheckIn?: string;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [guestId, setGuestId] = useState<string | null>(null);
  const [checkIn, setCheckIn] = useState(() => resolveStayStart(initialCheckIn));
  const [checkOut, setCheckOut] = useState(() =>
    nextDate(resolveStayStart(initialCheckIn)),
  );
  const [roomIds, setRoomIds] = useState<string[]>([]);
  const [raftIds, setRaftIds] = useState<string[]>([]);
  const [foodItems, setFoodItems] = useState<BookingFoodItem[]>([]);
  const [extraCharges, setExtraCharges] = useState<BookingExtraChargeDraft[]>(
    [],
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const start = resolveStayStart(initialCheckIn);
    setCheckIn(start);
    setCheckOut(nextDate(start));
    setRoomIds([]);
    setRaftIds([]);
    setExtraCharges([]);
  }, [open, initialCheckIn]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (foodItems.length) {
        const productsRes = await fetch("/api/products?minibar=false", {
          cache: "no-store",
        });
        if (productsRes.ok) {
          const products = (await productsRes.json()) as Array<{
            id: string;
            optionGroups?: Array<{
              id: string;
              name: string;
              isRequired: boolean;
              options: Array<{ id: string; label: string }>;
            }>;
          }>;
          if (foodItemsMissingRequiredOptions(foodItems, products)) {
            throw new Error(
              "กรุณาเลือกตัวเลือกที่บังคับของเมนูอาหาร (เช่น ไก่/หมู หรือชนิดเส้น)",
            );
          }
        }
      }

      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "solo",
          name,
          phone,
          ...(guestId ? { guestId } : {}),
          checkIn,
          checkOut,
          roomIds,
          raftIds,
          foodItems: foodItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            isExtra: item.isExtra ?? true,
            ...(item.note?.trim() ? { note: item.note.trim() } : {}),
          })),
          extraCharges: extraCharges
            .filter((item) => extraChargeLineTotal(item) > 0)
            .map((item) => ({
              description: item.description.trim(),
              amount: item.amount,
              quantity: item.quantity,
              type: item.type,
            })),
        }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message);
      setOpen(false);
      setName("");
      setPhone("");
      setGuestId(null);
      setRoomIds([]);
      setRaftIds([]);
      setFoodItems([]);
      setExtraCharges([]);
      onCreated?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={() => setOpen(false)} title="เพิ่มการจองแบบเดี่ยว">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-muted-foreground">
            ชื่อผู้เข้าพัก
            <GuestSuggestInput
              required
              value={name}
              onChange={(next) => {
                setName(next);
                setGuestId(null);
              }}
              onSelect={(item) => {
                setName(item.name);
                setPhone(item.phone ?? "");
                setGuestId(item.kind === "guest" ? item.id : null);
              }}
              className={fieldClass}
              placeholder="พิมพ์ชื่อเพื่อค้นหาลูกค้าเก่า"
            />
          </label>
          <label className="text-sm text-muted-foreground">
            เบอร์โทร
            <input
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className={fieldClass}
            />
          </label>
          <div className="text-sm text-muted-foreground">
            <span className="mb-1 block">วันเช็กอิน</span>
            <DateSelector
              required
              date={checkIn}
              min={dateText()}
              setDate={(value) => {
                setCheckIn(value);
                setCheckOut(nextDate(value));
                setRoomIds([]);
                setRaftIds([]);
              }}
              className="w-full"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="mb-1 block">วันเช็กเอาต์</span>
            <DateSelector
              required
              date={checkOut}
              min={nextDate(checkIn)}
              setDate={(value) => {
                setCheckOut(value);
                setRoomIds([]);
                setRaftIds([]);
              }}
              className="w-full"
            />
          </div>
        </div>
        <ZoneRoomSelect
          selectedRoomIds={roomIds}
          onChange={setRoomIds}
          checkIn={checkIn}
          checkOut={checkOut}
        />
        <RaftSelect
          selectedRaftIds={raftIds}
          onChange={setRaftIds}
          checkIn={checkIn}
          checkOut={checkOut}
        />
        <BookingFoodSetPanel
          items={foodItems}
          onChange={setFoodItems}
          included={false}
          defaultIsExtra
          resetToken={open}
        />
        <BookingExtraChargesPanel
          items={extraCharges}
          onChange={setExtraCharges}
        />
        {error ? (
          <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <button
          disabled={saving}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground disabled:opacity-50"
        >
          <Save size={18} />
          {saving ? "กำลังบันทึก..." : "บันทึกการจอง"}
        </button>
      </form>
    </Modal>
  );
}
