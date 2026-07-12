"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import BackButton from "@/components/ui/BackButton";
import Basket from "@/components/ui/Basket";
import CardMenu from "@/components/ui/CardMenu";
import type { MenuShowModel } from "@/interface/MenuShowModel";

const fallbackFood: MenuShowModel[] = [
  { image: "/images/food/frychicken.jpg", alt: "ไก่ทอด", title: "ไก่ทอด", price: 80 }, { image: "/images/food/fryfish.jpg", alt: "ปลาทอด", title: "ปลาทอด", price: 120 }, { image: "/images/food/mootod.jpg", alt: "หมูทอด", title: "หมูทอด", price: 90 }, { image: "/images/food/roti.jpg", alt: "โรตี", title: "โรตี", price: 40 }, { image: "/images/food/somtum.jpg", alt: "ส้มตำ", title: "ส้มตำ", price: 70 }, { image: "/images/food/toomyum.jpg", alt: "ต้มยำกุ้ง", title: "ต้มยำกุ้ง", price: 150 },
];
const fallbackMinibar: MenuShowModel[] = [
  { image: "/images/minibar/beer.jpg", alt: "เบียร์", title: "เบียร์ช้าง", price: 70 }, { image: "/images/minibar/chocolate.jpg", alt: "ช็อกโกแลต", title: "ช็อกโกแลต", price: 35 }, { image: "/images/minibar/lay.jpg", alt: "มันฝรั่ง", title: "เลย์", price: 25 }, { image: "/images/minibar/icecream.jpg", alt: "ไอศกรีม", title: "ไอศกรีม", price: 45 }, { image: "/images/minibar/milk.jpg", alt: "นม", title: "นม", price: 25 },
];

export default function FoodMenuPage() {
  const { roomId: bookingId } = useParams<{ roomId: string }>(); const [tab, setTab] = useState<"food" | "minibar">("food"); const [items, setItems] = useState({ food: fallbackFood, minibar: fallbackMinibar }); const [loading, setLoading] = useState(false); const [customer, setCustomer] = useState("กำลังโหลดลูกค้า..."); const [roomNames, setRoomNames] = useState("");
  useEffect(() => { const load = async () => { try { const response = await fetch(`/api/bookings/${bookingId}`, { cache: "no-store" }); if (!response.ok) return; const data = await response.json() as { customerName: string; rooms: Array<{ number: string }> }; setCustomer(data.customerName); setRoomNames(data.rooms.map((room) => `ห้อง ${room.number}`).join(", ")); } catch { /* ใช้ข้อความสำรอง */ } }; void load(); }, [bookingId]);
  useEffect(() => { const load = async () => { setLoading(true); try { const type = tab === "food" ? "FOOD" : "MINIBAR"; const response = await fetch(`/api/products?type=${type}`); if (!response.ok) throw new Error(); const data = await response.json() as MenuShowModel[]; if (data.length) setItems((current) => ({ ...current, [tab]: data })); } catch { /* ใช้เมนูสำรอง */ } finally { setLoading(false); } }; void load(); }, [tab]);
  return <div><header className="sticky top-0 z-20 flex h-16 items-center justify-between bg-indigo-600 px-4 text-white shadow"><div className="flex items-center gap-3"><BackButton route="/foodOrder" /><div><p className="text-xs text-indigo-200">{roomNames || "รายการจอง"}</p><h1 className="font-semibold">{customer}</h1></div></div><Basket id={bookingId} /></header><main className="mx-auto max-w-6xl p-4 sm:p-6"><div className="mb-5 flex items-center justify-between"><div className="inline-flex rounded-xl bg-slate-200/70 p-1"><button onClick={() => setTab("food")} className={`rounded-lg px-5 py-2 text-sm ${tab === "food" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}>อาหาร</button><button onClick={() => setTab("minibar")} className={`rounded-lg px-5 py-2 text-sm ${tab === "minibar" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}>มินิบาร์</button></div>{loading && <span className="text-sm text-slate-500">กำลังโหลด...</span>}</div><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{items[tab].map((item) => <CardMenu key={item.id ?? item.title} {...item} />)}</div></main></div>;
}
