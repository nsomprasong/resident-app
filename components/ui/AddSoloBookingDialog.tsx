"use client";

import { useState, type FormEvent } from "react";
import { Save } from "lucide-react";

import BookingFoodSelect, { type BookingFoodItem } from "./BookingFoodSelect";
import DateSelector from "./DateSelector";
import Modal from "./Modal";
import RaftSelect from "./RaftSelect";
import ZoneRoomSelect from "./ZoneRoomSelect";

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

export default function AddSoloBookingDialog({
  open,
  setOpen,
  onCreated,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [checkIn, setCheckIn] = useState(dateText());
  const [checkOut, setCheckOut] = useState(dateText(1));
  const [roomIds, setRoomIds] = useState<string[]>([]);
  const [raftIds, setRaftIds] = useState<string[]>([]);
  const [foodItems, setFoodItems] = useState<BookingFoodItem[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "solo",
          name,
          phone,
          checkIn,
          checkOut,
          roomIds,
          raftIds,
          foodItems,
        }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message);
      setOpen(false);
      setRoomIds([]);
      setRaftIds([]);
      setFoodItems([]);
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
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={fieldClass}
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
        <BookingFoodSelect
          items={foodItems}
          onChange={setFoodItems}
          included={false}
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
