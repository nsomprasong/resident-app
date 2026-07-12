import Link from "next/link";
import { ArrowRight, BedDouble, CookingPot, LayoutDashboard, Utensils } from "lucide-react";

const cards = [
  { title: "รายการจอง", description: "ดูและจัดการการจองห้องพัก", href: "/booking", icon: BedDouble },
  { title: "สั่งอาหาร", description: "รับออเดอร์อาหารและมินิบาร์", href: "/foodOrder", icon: Utensils },
  { title: "ครัว", description: "ติดตามคิวอาหารของห้องครัว", href: "/kitchen", icon: CookingPot },
  { title: "แดชบอร์ด", description: "ภาพรวมรายได้และการเข้าพัก", href: "/dashboard", icon: LayoutDashboard },
];
export default function Home() {
  return <div className="mx-auto max-w-6xl p-4 sm:p-8"><div className="mb-8 rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 p-7 text-white shadow-lg sm:p-10"><p className="text-sm text-indigo-100">RESIDENT HOTEL MANAGEMENT</p><h1 className="mt-2 text-3xl font-semibold sm:text-4xl">จัดการงานโรงแรมในที่เดียว</h1><p className="mt-3 max-w-xl text-indigo-100">ติดตามห้องพัก การจอง อาหาร มินิบาร์ และค่าใช้จ่ายประจำวัน</p></div><div className="grid gap-4 sm:grid-cols-2">{cards.map(({ title, description, href, icon: Icon }) => <Link key={href} href={href} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><span className="grid h-12 w-12 place-items-center rounded-xl bg-indigo-50 text-indigo-600"><Icon size={24} /></span><h2 className="mt-4 text-lg font-semibold">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600">เปิดเมนู <ArrowRight size={16} className="transition group-hover:translate-x-1" /></span></Link>)}</div></div>;
}
