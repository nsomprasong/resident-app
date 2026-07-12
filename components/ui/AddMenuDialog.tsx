"use client";
import Image from "next/image";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useBasketList } from "@/hooks/useBasketList";
import Modal from "./Modal";

interface MenuDetail { id?: string; image: string; alt: string; title: string; price: number }
export default function AddMenuDialog({ open, setOpen, menu }: { open: boolean; setOpen: (open: boolean) => void; menu: MenuDetail }) {
  const [amount, setAmount] = useState(1); const [reason, setReason] = useState(""); const { addToBasket } = useBasketList();
  const add = () => { for (let index = 0; index < amount; index += 1) addToBasket({ id: uuidv4(), productId: menu.id, image: menu.image, alt: menu.alt, title: menu.title, price: menu.price, reason }); setOpen(false); setAmount(1); setReason(""); };
  return <Modal open={open} onClose={() => setOpen(false)} title="เพิ่มรายการ"><div className="space-y-4"><div className="relative aspect-[16/8] overflow-hidden rounded-2xl"><Image fill src={menu.image} alt={menu.alt} className="object-cover" /></div><div className="flex justify-between"><h3 className="font-medium">{menu.title}</h3><span className="font-medium text-indigo-600">฿{menu.price}</span></div><label className="block text-sm text-slate-600">รายละเอียดเพิ่มเติม<textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-20 w-full resize-none rounded-xl border border-slate-200 p-3 outline-none focus:border-indigo-500" placeholder="เช่น ไม่ใส่ผัก หรือข้อมูลการแพ้อาหาร" /></label><div className="flex gap-3"><div className="flex items-center gap-3 rounded-xl border border-slate-200 p-1"><button type="button" disabled={amount <= 1} onClick={() => setAmount(amount - 1)} className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-30"><Minus size={18} /></button><span className="w-5 text-center">{amount}</span><button type="button" onClick={() => setAmount(amount + 1)} className="rounded-lg p-2 hover:bg-slate-100"><Plus size={18} /></button></div><button type="button" onClick={add} className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700">ใส่ตะกร้า · ฿{menu.price * amount}</button></div></div></Modal>;
}
