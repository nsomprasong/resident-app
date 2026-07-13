"use client";
import { ChevronRight, ContactRound } from "lucide-react";
import { useRouter } from "next/navigation";

export default function OrderGroupItem({ id, customerName, subtitle }: { id: string | number; customerName: string; subtitle?: string }) {
  const router = useRouter();
  return <button type="button" onClick={() => router.push(`/foodOrder/${id}/food`)} className="flex w-full items-center justify-between rounded-2xl border border-border bg-surface p-3 text-left shadow-sm hover:shadow-md"><span className="flex items-center gap-3"><span className="grid h-14 w-14 place-items-center rounded-xl bg-primary/10 text-primary"><ContactRound size={28} /></span><span><span className="block font-medium">{customerName}</span>{subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}</span></span><ChevronRight size={20} className="text-primary" /></button>;
}
