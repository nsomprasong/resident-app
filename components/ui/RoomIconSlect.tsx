"use client";

import { BedDouble, BedSingle, CircleCheck } from "lucide-react";
import { useState } from "react";

export default function RoomIconSelect({
  roomNo,
  booked,
  selected: controlledSelected,
  onToggle,
  roomType,
  bedType,
  price,
}: {
  roomNo: number;
  booked: boolean;
  selected?: boolean;
  onToggle?: () => void;
  roomType?: string;
  bedType?: string | null;
  price?: number;
}) {
  const [internalSelected, setInternalSelected] = useState(false);
  const selected = controlledSelected ?? internalSelected;
  const toggle = () =>
    onToggle ? onToggle() : setInternalSelected(!internalSelected);
  const isSingle =
    bedType?.includes("เดี่ยว") ||
    roomType?.toLowerCase().includes("single");
  const BedIcon = isSingle ? BedSingle : BedDouble;
  const description = [roomType, bedType].filter(Boolean).join(" · ");
  const priceLabel =
    typeof price === "number" && Number.isFinite(price)
      ? `฿${price.toLocaleString("th-TH")}`
      : null;

  return (
    <button
      type="button"
      disabled={booked}
      aria-label={
        booked
          ? `ห้อง ${roomNo} ไม่ว่าง`
          : `เลือกห้อง ${roomNo}${priceLabel ? ` ${priceLabel}` : ""} ${description}`
      }
      title={`ห้อง ${roomNo}${priceLabel ? ` · ${priceLabel}` : ""} · ${description || "ไม่ระบุประเภท"}${booked ? " · ไม่ว่าง" : ""}`}
      onClick={toggle}
      className={`flex min-w-16 flex-col items-center gap-0.5 rounded-xl border p-2 transition ${
        booked
          ? "cursor-not-allowed border-destructive/30 bg-destructive/10 text-destructive"
          : selected
            ? "border-success/40 bg-success/10 text-success"
            : "border-border bg-surface text-primary hover:border-primary/40"
      }`}
    >
      {selected ? <CircleCheck size={22} /> : <BedIcon size={22} />}
      <span className="text-xs font-medium leading-none">{roomNo}</span>
      {priceLabel ? (
        <span className="text-[10px] leading-none opacity-80">{priceLabel}</span>
      ) : null}
    </button>
  );
}
