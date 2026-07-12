"use client";
import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import BillDetail from "./BillDetail";

interface Item { title: string; price: number }
export default function BillItem({ icon, title, items, isEdit }: { icon?: ReactNode; title: string; items: Item[]; isEdit: boolean }) {
  const [open, setOpen] = useState(false); const total = items.reduce((sum, item) => sum + item.price, 0);
  return <div className="rounded-2xl border border-slate-200 bg-white shadow-sm"><button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between p-4"><span className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-slate-600">{icon}</span><span className="font-medium">{title}</span></span><span className="flex items-center gap-3"><span>฿{total.toLocaleString()}</span><ChevronDown size={18} className={`transition ${open ? "rotate-180" : ""}`} /></span></button>{open && <div className="space-y-1 border-t border-slate-100 px-4 py-3">{items.map((item) => <BillDetail key={item.title} {...item} isEdit={isEdit} />)}<div className="mt-2 border-t border-slate-100 pt-2"><BillDetail title="รวมราคา" price={total} isEdit={isEdit} summarize /></div></div>}</div>;
}
