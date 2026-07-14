import Link from "next/link";
import {
  ArrowRight,
  BedDouble,
  CalendarCheck2,
  ClipboardList,
  CookingPot,
  Eraser,
  House,
  LayoutDashboard,
  Settings,
  UsersRound,
  Utensils,
  type LucideIcon,
} from "lucide-react";

import { canAccessPageWithPermissions } from "@/lib/auth/authorization";
import { getCurrentUser } from "@/lib/auth/current-user";
import { filterHrNavItems } from "@/lib/hr/nav";

const cards: Array<{
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}> = [
  {
    title: "ภาพรวมวันนี้",
    description: "ห้อง กรุ๊ป แพ ลูกค้า และอาหารของวันนี้",
    href: "/today",
    icon: CalendarCheck2,
  },
  {
    title: "รายการจอง",
    description: "ดูและจัดการการจองห้องพัก",
    href: "/booking",
    icon: BedDouble,
  },
  {
    title: "สั่งอาหาร",
    description: "รับออเดอร์อาหารและมินิบาร์",
    href: "/foodOrder",
    icon: Utensils,
  },
  {
    title: "ครัว",
    description: "ติดตามคิวอาหารของห้องครัว",
    href: "/kitchen",
    icon: CookingPot,
  },
  {
    title: "แม่บ้านและมินิบาร์",
    description: "ตรวจห้องและบันทึกมินิบาร์",
    href: "/houseKeeperMinibar",
    icon: House,
  },
  {
    title: "บัญชีและแดชบอร์ด",
    description: "ภาพรวมรายได้และการเข้าพัก",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "ตั้งค่าข้อมูลหลัก",
    description: "จัดการข้อมูลหลักและสิทธิ์",
    href: "/settings",
    icon: Settings,
  },
  {
    title: "ล้างข้อมูลเริ่มต้นใหม่",
    description: "ลบข้อมูลบริการและข้อมูลหลักเพื่อเริ่มใหม่",
    href: "/system/data-reset",
    icon: Eraser,
  },
  {
    title: "รายงานรวม",
    description: "รายงานสรุปการดำเนินงาน",
    href: "/report",
    icon: ClipboardList,
  },
];

export default async function Home() {
  const currentUser = await getCurrentUser();
  const permissions = currentUser?.employee?.role?.permissions ?? [];
  const hrCards = filterHrNavItems(permissions)
    .filter((item) => item.path === "/hr")
    .map((item) => ({
      title: "บริหารพนักงาน",
      description: item.description,
      href: item.path,
      icon: UsersRound as LucideIcon,
    }));
  const visibleCards = [
    ...cards.filter((card) =>
      canAccessPageWithPermissions(permissions, card.href),
    ),
    ...hrCards,
  ];

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-8">
      <div className="mb-8 rounded-3xl bg-gradient-to-br from-primary to-secondary p-7 text-primary-foreground shadow-lg sm:p-10">
        <p className="text-sm text-primary-foreground/80">
          RESIDENT HOTEL MANAGEMENT
        </p>
        <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
          จัดการงานโรงแรมในที่เดียว
        </h1>
        <p className="mt-3 max-w-xl text-primary-foreground/80">
          ติดตามห้องพัก การจอง อาหาร มินิบาร์ และค่าใช้จ่ายประจำวัน
        </p>
      </div>
      {visibleCards.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-foreground">
            ยังไม่มีเมนูที่เปิดให้ใช้งาน
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            บัญชีนี้ยังไม่มีสิทธิ์เข้าหน้างาน กรุณาติดต่อผู้ดูแลระบบ
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visibleCards.map(({ title, description, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon size={24} />
              </span>
              <h2 className="mt-4 text-lg font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-secondary">
                เปิดเมนู{" "}
                <ArrowRight
                  size={16}
                  className="transition group-hover:translate-x-1"
                />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
