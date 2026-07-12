"use client";
import { ChevronRight, ContactRound } from "lucide-react";
import { useRouter } from "next/navigation";

export default function OrderGroupItem({ id, customerName, subtitle }: { id: string | number; customerName: string; subtitle?: string }) {
  const router = useRouter();
  return <button type="button" onClick={() => router.push(`/foodOrder/${id}/food`)} className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:shadow-md"><span className="flex items-center gap-3"><span className="grid h-14 w-14 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><ContactRound size={28} /></span><span><span className="block font-medium">{customerName}</span>{subtitle && <span className="text-xs text-slate-500">{subtitle}</span>}</span></span><ChevronRight size={20} className="text-indigo-600" /></button>;
}
