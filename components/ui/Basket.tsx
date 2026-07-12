"use client";
import { ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useBasketList } from "@/hooks/useBasketList";

export default function Basket({ id }: { id: string }) {
  const router = useRouter(); const { basketList } = useBasketList();
  return <button type="button" aria-label="ตะกร้า" onClick={() => router.push(`/foodOrder/${id}/basket`)} className="relative rounded-xl p-2 text-white hover:bg-white/10"><ShoppingBag size={22} />{basketList.length > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1 text-xs font-semibold text-slate-900">{basketList.length}</span>}</button>;
}
