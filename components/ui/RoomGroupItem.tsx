"use client";
import { ChevronDown, ChevronRight, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BookingDetail } from "@/interface/BookingDetailModel";
import RoomItem from "./RoomItem";
import Status from "./Status";

interface Props { id: string | number; customerName: string; status: string; roomInGroupList: BookingDetail[]; showStatus?: boolean }
export default function RoomGroupItem({ id, customerName, status, roomInGroupList, showStatus }: Props) {
  const [open, setOpen] = useState(false); const router = useRouter();
  return <div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center gap-2 p-4"><button type="button" onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-center justify-between text-left"><span className="flex min-w-0 items-center gap-3"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Users size={24} /></span><span className="min-w-0"><span className="block truncate font-medium">{customerName}</span>{showStatus && <span className="mt-1 block"><Status status={status} /></span>}</span></span><ChevronDown size={20} className={`shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} /></button><button type="button" onClick={() => router.push(`/booking/${id}`)} className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-100">รายละเอียด<ChevronRight size={16} /></button></div>{open && <div className="space-y-2 border-t border-slate-100 p-3">{roomInGroupList.length ? roomInGroupList.map((room, index) => <RoomItem key={`${room.id}-${index}`} {...room} showStatus={showStatus} />) : <p className="p-3 text-center text-sm text-slate-500">การจองนี้มีเฉพาะแพ กด “รายละเอียด” เพื่อดำเนินการต่อ</p>}</div>}</div>;
}
