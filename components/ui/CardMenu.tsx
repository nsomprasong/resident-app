"use client";
import Image from "next/image";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useBasketList } from "@/hooks/useBasketList";
import AddMenuDialog from "./AddMenuDialog";

interface Props { id?: string; image: string; alt: string; title: string; price: number }
export default function CardMenu(props: Props) {
  const [open, setOpen] = useState(false); const { basketList } = useBasketList();
  const count = basketList.filter((item) => item.title === props.title).length;
  return <><article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="relative aspect-[4/3] overflow-hidden"><Image fill src={props.image} alt={props.alt} className="object-cover transition duration-300 group-hover:scale-105" />{count > 0 && <span className="absolute right-2 top-2 rounded-full bg-white px-2 py-1 text-xs font-semibold shadow">{count}</span>}</div><div className="p-3"><h3 className="font-medium">{props.title}</h3><div className="mt-2 flex items-center justify-between"><span className="text-sm text-slate-600">฿{props.price.toLocaleString()}</span><button type="button" aria-label={`เพิ่ม ${props.title}`} onClick={() => setOpen(true)} className="grid h-9 w-9 place-items-center rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white"><Plus size={20} /></button></div></div></article><AddMenuDialog open={open} setOpen={setOpen} menu={props} /></>;
}
