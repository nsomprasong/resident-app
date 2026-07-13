"use client";
import { ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useBasketList } from "@/hooks/useBasketList";

export default function Basket({ id }: { id: string }) {
  const router = useRouter(); const { basketList } = useBasketList();
  return <button type="button" aria-label="ตะกร้า" onClick={() => router.push(`/foodOrder/${id}/basket`)} className="relative rounded-xl p-2 text-primary-foreground hover:bg-surface/10"><ShoppingBag size={22} />{basketList.length > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-warning px-1 text-xs font-semibold text-foreground">{basketList.length}</span>}</button>;
}
