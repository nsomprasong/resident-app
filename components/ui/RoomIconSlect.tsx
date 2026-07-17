"use client";

import { BedDouble, BedSingle, CircleCheck } from "lucide-react";

import {
  bedLayoutLabel,
  resolveBedLayout,
} from "@/lib/settings/bed-types";

export default function RoomIconSelect({
  roomNo,
  booked,
  selected: controlledSelected,
  onToggle,
  roomType,
  bedType,
  capacity,
  price,
}: {
  roomNo: string | number;
  booked: boolean;
  selected?: boolean;
  onToggle?: () => void;
  roomType?: string;
  bedType?: string | null;
  capacity?: number | null;
  price?: number;
}) {
  const label = String(roomNo);
  const layout = resolveBedLayout(bedType, capacity);
  const bedCount = layout?.capacity ?? capacity ?? null;
  const BedIcon =
    bedCount === 1 ||
    bedType?.includes("เดี่ยว") ||
    roomType?.toLowerCase().includes("single")
      ? BedSingle
      : BedDouble;
  const layoutText = bedLayoutLabel(bedType, capacity);
  const description = [roomType, layoutText].filter(Boolean).join(" · ");
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
          ? `ห้อง ${label} ไม่ว่าง`
          : `เลือกห้อง ${label}${priceLabel ? ` ${priceLabel}` : ""} ${description}`
      }
      title={`ห้อง ${label}${priceLabel ? ` · ${priceLabel}` : ""} · ${description || "ไม่ระบุประเภท"}${booked ? " · ไม่ว่าง" : ""}`}
      onClick={() => onToggle?.()}
      className={`relative flex min-w-16 max-w-[5.5rem] flex-col items-center gap-0.5 rounded-xl border p-2 transition ${
        booked
          ? "cursor-not-allowed border-destructive/30 bg-destructive/10 text-destructive"
          : controlledSelected
            ? "border-success/40 bg-success/10 text-success"
            : "border-border bg-surface text-primary hover:border-primary/40"
      }`}
    >
      {controlledSelected ? <CircleCheck size={22} /> : <BedIcon size={22} />}
      {bedCount && bedCount >= 2 ? (
        <span className="absolute right-1 top-1 rounded bg-background/90 px-1 text-[9px] font-semibold leading-none text-foreground ring-1 ring-border">
          ×{bedCount}
        </span>
      ) : null}
      <span className="max-w-full truncate text-xs font-medium leading-none">
        {label}
      </span>
      <span className="max-w-full truncate text-[9px] leading-none opacity-80">
        {layoutText}
      </span>
      {priceLabel ? (
        <span className="text-[10px] leading-none opacity-80">{priceLabel}</span>
      ) : null}
    </button>
  );
}
