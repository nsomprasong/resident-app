"use client";

import { Calculator, Save, UsersRound, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

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
import NumberInput from "./NumberInput";
import RaftSelect, { type SelectedRaft } from "./RaftSelect";
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
  optionGroups?: Array<{
    id: string;
    name: string;
    isRequired: boolean;
    options: Array<{ id: string; label: string }>;
  }>;
};

function nightsBetween(checkIn: string, checkOut: string) {
  const start = new Date(`${checkIn}T00:00:00.000Z`).getTime();
  const end = new Date(`${checkOut}T00:00:00.000Z`).getTime();
  return Math.max(1, Math.round((end - start) / 86_400_000));
}

function resolveStayStart(initialCheckIn?: string) {
  if (initialCheckIn && /^\d{4}-\d{2}-\d{2}$/.test(initialCheckIn)) {
    return initialCheckIn;
  }
  return dateText();
}

export default function AddGroupBookingDialog({
  open,
  setOpen,
  onCreated,
  initialCheckIn,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  onCreated?: () => void;
  /** Work date from booking list — dialog opens on this night, not always "today". */
  initialCheckIn?: string;
}) {
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [checkIn, setCheckIn] = useState(() => resolveStayStart(initialCheckIn));
  const [checkOut, setCheckOut] = useState(() =>
    nextDate(resolveStayStart(initialCheckIn)),
  );
  const [guestCount, setGuestCount] = useState(1);
  const [pricePerPerson, setPricePerPerson] = useState(0);
  const [roomIds, setRoomIds] = useState<string[]>([]);
  const [selectedRafts, setSelectedRafts] = useState<SelectedRaft[]>([]);
  const [foodItems, setFoodItems] = useState<BookingFoodItem[]>([]);
  const [extraCharges, setExtraCharges] = useState<BookingExtraChargeDraft[]>(
    [],
  );
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
    const start = resolveStayStart(initialCheckIn);
    setCheckIn(start);
    setCheckOut(nextDate(start));
    setRoomIds([]);
    setSelectedRafts([]);
    setExtraCharges([]);
  }, [open, initialCheckIn]);

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
            optionGroups?: FoodPriceInfo["optionGroups"];
          }>;
          setFoodCatalog(
            foods.map((food) => ({
              id: food.id,
              price: Number(food.price ?? 0),
              optionGroups: food.optionGroups,
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
    return (
      selectedRafts.reduce((sum, item) => {
        if (!item.isExtra) return sum;
        return sum + (map.get(item.id) ?? 0);
      }, 0) * nights
    );
  }, [nights, selectedRafts, raftsCatalog]);
  const raftIncludedCount = selectedRafts.filter((item) => !item.isExtra).length;
  const raftExtraCount = selectedRafts.filter((item) => item.isExtra).length;
  const foodTotal = useMemo(() => {
    const map = new Map(foodCatalog.map((food) => [food.id, food.price]));
    return foodItems.reduce((sum, item) => {
      if (!(item.isExtra ?? false)) return sum;
      return sum + (map.get(item.productId) ?? 0) * item.quantity;
    }, 0);
  }, [foodCatalog, foodItems]);
  const foodCount = foodItems.reduce((sum, item) => sum + item.quantity, 0);
  const extraChargesTotal = extraCharges.reduce(
    (sum, item) => sum + extraChargeLineTotal(item),
    0,
  );
  const grandTotal = packageTotal + raftTotal + foodTotal + extraChargesTotal;

  const resetForm = () => {
    const start = resolveStayStart(initialCheckIn);
    setName("");
    setContactName("");
    setPhone("");
    setCheckIn(start);
    setCheckOut(nextDate(start));
    setGuestCount(1);
    setPricePerPerson(0);
    setRoomIds([]);
    setSelectedRafts([]);
    setFoodItems([]);
    setExtraCharges([]);
    setFoodSetMeta({ name: "", sourceFoodSetId: null });
    setError("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (
        foodItems.length &&
        foodItemsMissingRequiredOptions(foodItems, foodCatalog)
      ) {
        throw new Error(
          "กรุณาเลือกตัวเลือกที่บังคับของเมนูอาหาร (เช่น ไก่/หมู หรือชนิดเส้น)",
        );
      }

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
          rafts: selectedRafts.map((item) => ({
            id: item.id,
            isExtra: item.isExtra,
          })),
          foodItems: foodItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            isExtra: item.isExtra ?? false,
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
    setSelectedRafts([]);
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
              <GuestSuggestInput
                required
                includeTourGroups
                value={name}
                onChange={setName}
                onSelect={(item) => {
                  if (item.kind === "tour_group") {
                    setName(item.name);
                    setContactName(item.contactName ?? item.name);
                    setPhone(item.phone ?? "");
                    return;
                  }
                  setContactName(item.name);
                  setPhone(item.phone ?? "");
                }}
                className={inputClass}
                placeholder="พิมพ์ชื่อกรุ๊ปหรือลูกค้าเก่า"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              ผู้ติดต่อ
              <GuestSuggestInput
                required
                includeTourGroups
                value={contactName}
                onChange={setContactName}
                onSelect={(item) => {
                  if (item.kind === "tour_group") {
                    setName(item.name);
                    setContactName(item.contactName ?? item.name);
                    setPhone(item.phone ?? "");
                    return;
                  }
                  setContactName(item.name);
                  setPhone(item.phone ?? "");
                }}
                className={inputClass}
                placeholder="พิมพ์ชื่อเพื่อค้นหา"
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
              <NumberInput
                required
                min={1}
                emptyValue={1}
                value={guestCount}
                onChange={setGuestCount}
                className={inputClass}
              />
            </label>
            <label className="text-xs text-muted-foreground">
              ราคาต่อหัว
              <NumberInput
                required
                min={0}
                emptyValue={0}
                value={pricePerPerson}
                onChange={setPricePerPerson}
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
                  setSelectedRafts([]);
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
          selectedRafts={selectedRafts}
          onRaftsChange={setSelectedRafts}
          allowPackagePricing
          defaultIsExtra={false}
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

        <BookingExtraChargesPanel
          items={extraCharges}
          onChange={setExtraCharges}
        />

        <section className="rounded-2xl border border-border bg-surface">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary/10 text-secondary">
              <Calculator size={18} />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-foreground">สรุปการจอง</h3>
              <p className="text-xs text-muted-foreground">
                ห้องรวมในเหมา · แพ/อาหารเลือกได้ว่าเหมาหรือคิดเพิ่ม
              </p>
            </div>
          </div>
          <div className="space-y-2 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">จำนวนห้อง</span>
              <span className="font-medium text-foreground">{roomIds.length}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">ราคารวมห้อง (อ้างอิง)</span>
              <span className="font-medium text-foreground">
                ฿{roomTotal.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">จำนวนแพ</span>
              <span className="font-medium text-foreground">
                {selectedRafts.length}
                {selectedRafts.length
                  ? ` (เหมา ${raftIncludedCount} · เพิ่ม ${raftExtraCount})`
                  : ""}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">แพคิดเพิ่ม</span>
              <span className="font-medium text-foreground">
                ฿{raftTotal.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">จำนวนรายการอาหาร</span>
              <span className="font-medium text-foreground">{foodCount}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">อาหารคิดเพิ่ม</span>
              <span className="font-medium text-foreground">
                ฿{foodTotal.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">ค่าใช้จ่ายเพิ่มเติม</span>
              <span className="font-medium text-foreground">
                ฿{extraChargesTotal.toLocaleString()}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-primary/10 px-3 py-3">
              <span className="font-semibold text-foreground">ยอดรวมทั้งหมด</span>
              <span className="text-lg font-semibold text-primary">
                ฿{grandTotal.toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              เหมา {guestCount} คน × ฿{pricePerPerson.toLocaleString()} = ฿
              {packageTotal.toLocaleString()}
              {raftTotal + foodTotal + extraChargesTotal > 0
                ? ` + คิดเพิ่ม ฿${(raftTotal + foodTotal + extraChargesTotal).toLocaleString()}`
                : ""}
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
