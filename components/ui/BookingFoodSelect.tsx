"use client";
import { Minus, Plus, Utensils } from "lucide-react";
import { useEffect, useState } from "react";

export interface BookingFoodItem { productId: string; quantity: number }
interface Product { id: string; title: string; price: number }
export default function BookingFoodSelect({ items, onChange, included }: { items: BookingFoodItem[]; onChange: (items: BookingFoodItem[]) => void; included: boolean }) {
  const [products, setProducts] = useState<Product[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { const load = async () => { try { const response = await fetch("/api/products?type=FOOD"); if (response.ok) setProducts(await response.json() as Product[]); } finally { setLoading(false); } }; void load(); }, []);
  const quantity = (id: string) => items.find((item) => item.productId === id)?.quantity ?? 0;
  const setQuantity = (id: string, value: number) => onChange(value <= 0 ? items.filter((item) => item.productId !== id) : items.some((item) => item.productId === id) ? items.map((item) => item.productId === id ? { ...item, quantity: value } : item) : [...items, { productId: id, quantity: value }]);
  return <fieldset className="rounded-2xl border border-slate-200 p-4"><legend className="px-2 text-sm font-medium">สั่งอาหารพร้อมการจอง</legend><p className="mb-3 text-xs text-slate-500">{included ? "อาหารที่เลือกตอนนี้รวมในราคาเหมา รายการที่เพิ่มภายหลังจะคิดเพิ่ม" : "อาหารคิดตามราคาจริงและรวมในบิลการจอง"}</p>{loading ? <p className="text-sm text-slate-500">กำลังโหลดอาหาร...</p> : <div className="grid gap-2 sm:grid-cols-2">{products.map((product) => { const count = quantity(product.id); return <div key={product.id} className={`flex items-center justify-between rounded-xl border p-2.5 ${count ? "border-indigo-200 bg-indigo-50" : "border-slate-200"}`}><span className="flex min-w-0 items-center gap-2"><Utensils size={17} className="shrink-0 text-indigo-600" /><span className="truncate text-sm">{product.title}<span className="ml-1 text-xs text-slate-400">฿{product.price}</span></span></span><span className="ml-2 flex items-center gap-2"><button type="button" disabled={!count} onClick={() => setQuantity(product.id, count - 1)} className="rounded-lg p-1 disabled:opacity-25"><Minus size={16} /></button><span className="w-4 text-center text-sm">{count}</span><button type="button" onClick={() => setQuantity(product.id, count + 1)} className="rounded-lg p-1"><Plus size={16} /></button></span></div>; })}</div>}</fieldset>;
}
