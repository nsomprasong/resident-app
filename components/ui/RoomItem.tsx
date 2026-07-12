"use client";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useBookingDetail } from "@/hooks/useBookingDetail";
import Status from "./Status";

interface Props { id: string | number; name: string; status: string; image: string; showStatus?: boolean }
export default function RoomItem(props: Props) {
  const router = useRouter();
  const { setBookingDetail } = useBookingDetail();
  const open = () => { setBookingDetail(props); router.push(`/booking/${props.id}`); };
  return <button type="button" onClick={open} className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><span className="flex items-center gap-3"><Image src={props.image} alt={props.name} width={64} height={64} className="h-16 w-16 rounded-xl object-cover" /><span><span className="block font-medium">{props.name}</span>{props.showStatus && <span className="mt-1 block"><Status status={props.status} /></span>}</span></span><ChevronRight className="text-slate-400" size={20} /></button>;
}
