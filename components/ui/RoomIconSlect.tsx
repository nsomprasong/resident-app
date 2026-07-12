"use client";
import { BedDouble, BedSingle, CircleCheck } from "lucide-react";
import { useState } from "react";

export default function RoomIconSelect({ roomNo, booked, selected: controlledSelected, onToggle, roomType, bedType }: { roomNo: number; booked: boolean; selected?: boolean; onToggle?: () => void; roomType?: string; bedType?: string | null }) {
  const [internalSelected, setInternalSelected] = useState(false); const selected = controlledSelected ?? internalSelected; const toggle = () => onToggle ? onToggle() : setInternalSelected(!internalSelected); const isSingle = bedType?.includes("เดี่ยว") || roomType?.toLowerCase().includes("single"); const BedIcon = isSingle ? BedSingle : BedDouble; const description = [roomType, bedType].filter(Boolean).join(" · ");
  return <button type="button" disabled={booked} aria-label={booked ? `ห้อง ${roomNo} ไม่ว่าง` : `เลือกห้อง ${roomNo} ${description}`} title={`ห้อง ${roomNo} · ${description || "ไม่ระบุประเภท"}${booked ? " · ไม่ว่าง" : ""}`} onClick={toggle} className={`flex min-w-16 flex-col items-center gap-0.5 rounded-xl border p-2 text-xs transition ${booked ? "cursor-not-allowed border-red-200 bg-red-50 text-red-500" : selected ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-indigo-600 hover:border-indigo-300"}`}>{selected ? <CircleCheck size={22} /> : <BedIcon size={22} />}<span>{roomNo}</span></button>;
}
