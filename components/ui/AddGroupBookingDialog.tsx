"use client";

import { Calculator, Save, UsersRound, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import BookingFoodSetPanel from "./BookingFoodSetPanel";
import type { BookingFoodItem } from "./BookingFoodSelect";
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

const inputClass =
  "mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";

type RoomPriceInfo = {
  id: string;
  basePrice: number;
};

type RaftPriceInfo = {
  id: string;
  basePrice: number;
};

type FoodPriceInfo = {
  id: string;
  price: number;
};

function nightsBetween(checkIn: string, checkOut: string) {
  const start = new Date(`${checkIn}T00:00:00.000Z`).getTime();
  const end = new Date(`${checkOut}T00:00:00.000Z`).getTime();
  return Math.max(1, Math.round((end - start) / 86_400_000));
}

export default function AddGroupBookingDialog({
  open,
  setOpen,
  onCreated,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [checkIn, setCheckIn] = useState(dateText());
  const [checkOut, setCheckOut] = useState(dateText(1));
  const [guestCount, setGuestCount] = useState(1);
  const [pricePerPerson, setPricePerPerson] = useState(0);
  const [roomIds, setRoomIds] = useState<string[]>([]);
  const [raftIds, setRaftIds] = useState<string[]>([]);
  const [foodItems, setFoodItems] = useState<BookingFoodItem[]>([]);
  const [foodSetMeta, setFoodSetMeta] = useState<{
    name: string;
    sourceFoodSetId: string | null;
  }>({ name: "", sourceFoodSetId: null });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [roomsCatalog, setRoomsCatalog] = useState<RoomPriceInfo[]>([]);
  const [raftsCatalog, setRaftsCatalog] = useState<RaftPriceInfo[]>([]);
  const [foodCatalog, setFoodCatalog] = useState<FoodPriceInfo[]>([]);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      try {
        const [roomsRes, raftsRes, foodRes] = await Promise.all([
          fetch(
            `/api/rooms?checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}`,
            { cache: "no-store" },
          ),
          fetch(
            `/api/rafts?checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}`,
            { cache: "no-store" },
          ),
          fetch("/api/products?minibar=false", { cache: "no-store" }),
        ]);
        if (roomsRes.ok) {
          const rooms = (await roomsRes.json()) as Array<{
            id: string;
            roomType?: { basePrice?: number };
          }>;
          setRoomsCatalog(
            rooms.map((room) => ({
              id: String(room.id),
              basePrice: Number(room.roomType?.basePrice ?? 0),
            })),
          );
        }
        if (raftsRes.ok) {
          const rafts = (await raftsRes.json()) as Array<{
            id: string;
            basePrice: number;
          }>;
          setRaftsCatalog(
            rafts.map((raft) => ({
              id: raft.id,
              basePrice: Number(raft.basePrice ?? 0),
            })),
          );
        }
        if (foodRes.ok) {
          const foods = (await foodRes.json()) as Array<{
            id: string;
            price: number;
          }>;
          setFoodCatalog(
            foods.map((food) => ({
              id: food.id,
              price: Number(food.price ?? 0),
            })),
          );
        }
      } catch {
        /* summary falls back to 0 */
      }
    };
    void load();
  }, [checkIn, checkOut, open]);

  const nights = nightsBetween(checkIn, checkOut);
  const packageTotal = guestCount * pricePerPerson;
  const roomTotal = useMemo(() => {
    const map = new Map(roomsCatalog.map((room) => [room.id, room.basePrice]));
    return (
      roomIds.reduce((sum, id) => sum + (map.get(id) ?? 0), 0) * nights
    );
  }, [nights, roomIds, roomsCatalog]);
  const raftTotal = useMemo(() => {
    const map = new Map(raftsCatalog.map((raft) => [raft.id, raft.basePrice]));
    return raftIds.reduce((sum, id) => sum + (map.get(id) ?? 0), 0) * nights;
  }, [nights, raftIds, raftsCatalog]);
  const foodTotal = useMemo(() => {
    const map = new Map(foodCatalog.map((food) => [food.id, food.price]));
    return foodItems.reduce((sum, item) => {
      if (!(item.isExtra ?? false)) return sum;
      return sum + (map.get(item.productId) ?? 0) * item.quantity;
    }, 0);
  }, [foodCatalog, foodItems]);
  const foodCount = foodItems.reduce((sum, item) => sum + item.quantity, 0);

  const resetForm = () => {
    setName("");
    setContactName("");
    setPhone("");
    setCheckIn(dateText());
    setCheckOut(dateText(1));
    setGuestCount(1);
    setPricePerPerson(0);
    setRoomIds([]);
    setRaftIds([]);
    setFoodItems([]);
    setFoodSetMeta({ name: "", sourceFoodSetId: null });
    setError("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "group",
          name,
          contactName,
          phone,
          checkIn,
          checkOut,
          guestCount,
          pricePerPerson,
          roomIds,
          raftIds,
          foodItems: foodItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            isExtra: item.isExtra ?? false,
          })),
          foodSet: foodItems.length
            ? {
                name: foodSetMeta.name || "ชุดของกรุ๊ป",
                sourceFoodSetId: foodSetMeta.sourceFoodSetId,
              }
            : undefined,
        }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message);
      setOpen(false);
      resetForm();
      onCreated?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const changeDates = (value: string) => {
    setCheckIn(value);
    setCheckOut(nextDate(value));
    setRoomIds([]);
    setRaftIds([]);
  };

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="เพิ่มการจองแบบกลุ่ม"
      size="lg"
      fullScreenOnMobile
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            ยอดรวม{" "}
            <span className="text-base font-semibold text-foreground">
              ฿{packageTotal.toLocaleString()}
            </span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-muted sm:flex-none"
            >
              <X size={17} />
              ยกเลิก
            </button>
            <button
              type="submit"
              form="add-group-booking-form"
              disabled={saving}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:min-w-40"
            >
              <Save size={17} />
              {saving ? "กำลังบันทึก..." : "บันทึกการจอง"}
            </button>
          </div>
        </div>
      }
    >
      <form id="add-group-booking-form" onSubmit={submit} className="space-y-4">
        <section className="rounded-2xl border border-border bg-surface">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <UsersRound size={18} />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                รายละเอียดผู้จอง
              </h3>
              <p className="text-xs text-muted-foreground">
                ข้อมูลกรุ๊ป วันเข้าพัก และราคาเหมา
              </p>
            </div>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <label className="text-xs text-muted-foreground sm:col-span-2">
              ชื่อกรุ๊ปทัวร์
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              ผู้ติดต่อ
              <input
                required
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              เบอร์โทร
              <input
                required
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              จำนวนคน
              <input
                required
                min={1}
                type="number"
                value={guestCount}
                onChange={(event) => setGuestCount(Number(event.target.value))}
                className={inputClass}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              ราคาต่อหัว
              <input
                required
                min={0}
                type="number"
                value={pricePerPerson}
                onChange={(event) =>
                  setPricePerPerson(Number(event.target.value))
                }
                className={inputClass}
              />
            </label>
            <div className="text-xs text-muted-foreground">
              <span className="mb-1 block">วันเช็กอิน</span>
              <DateSelector
                required
                date={checkIn}
                min={dateText()}
                setDate={changeDates}
                className="w-full"
              />
            </div>
            <div className="text-xs text-muted-foreground">
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
        </section>

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
          included
          allowPackagePricing
          defaultIsExtra={false}
          resetToken={open}
          groupScoped
          onMetaChange={setFoodSetMeta}
        />

        <section className="rounded-2xl border border-border bg-surface">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary/10 text-secondary">
              <Calculator size={18} />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">สรุปการจอง</h3>
              <p className="text-xs text-muted-foreground">
                ห้อง แพ และอาหารรวมในราคาเหมา
              </p>
            </div>
          </div>
          <div className="space-y-2 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">จำนวนห้อง</span>
              <span className="font-medium text-foreground">{roomIds.length}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">ราคารวมห้อง</span>
              <span className="font-medium text-foreground">
                ฿{roomTotal.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">จำนวนแพ</span>
              <span className="font-medium text-foreground">{raftIds.length}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">ราคารวมแพ</span>
              <span className="font-medium text-foreground">
                ฿{raftTotal.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">จำนวนรายการอาหาร</span>
              <span className="font-medium text-foreground">{foodCount}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">ราคารวมอาหาร</span>
              <span className="font-medium text-foreground">
                ฿{foodTotal.toLocaleString()}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-primary/10 px-3 py-3">
              <span className="font-semibold text-foreground">ยอดรวมทั้งหมด</span>
              <span className="text-lg font-semibold text-primary">
                ฿{packageTotal.toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              คิดจาก {guestCount} คน × ฿{pricePerPerson.toLocaleString()} ต่อหัว
            </p>
          </div>
        </section>

        {error ? (
          <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
