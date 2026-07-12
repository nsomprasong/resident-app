"use client";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

export default function OrderItem({ id, name, image, subtitle }: { id: string | number; name: string; image: string; subtitle?: string }) {
  const router = useRouter();
  return <button type="button" onClick={() => router.push(`/foodOrder/${id}/food`)} className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:shadow-md"><span className="flex items-center gap-3"><Image src={image} alt={name} width={60} height={60} className="h-15 w-15 rounded-xl object-cover" /><span><span className="block font-medium">{name}</span>{subtitle && <span className="text-xs text-slate-500">{subtitle}</span>}</span></span><ChevronRight size={20} className="text-indigo-600" /></button>;
}
