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
  ShoppingCart,
  UsersRound,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { canAccessPageWithPermissions } from "@/lib/auth/authorization";
import { getCurrentUser } from "@/lib/auth/current-user";
import { filterHrNavItems } from "@/lib/hr/nav";

type MenuCard = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tone?: "default" | "danger";
};

const dailyCards: MenuCard[] = [
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
    title: "แม่บ้านและตรวจสอบห้องพัก",
    description: "ตรวจห้องและบันทึกมินิบาร์",
    href: "/houseKeeperMinibar",
    icon: House,
  },
  {
    title: "ซูเปอร์มาร์เก็ต",
    description: "ขายหน้าร้าน จัดการสินค้า สต๊อก และกะเงินสด",
    href: "/pos",
    icon: ShoppingCart,
  },
  {
    title: "บัญชีและแดชบอร์ด",
    description: "ภาพรวมรายได้และการเข้าพัก",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "รายงานรวม",
    description: "รายงานสรุปการดำเนินงาน",
    href: "/report",
    icon: ClipboardList,
  },
];

const systemCards: MenuCard[] = [
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
    tone: "danger",
  },
];

function MenuSection({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: MenuCard[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="rounded-2xl bg-muted px-4 py-3">
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map(({ title: itemTitle, description: itemDescription, href, icon: Icon, tone }) => (
          <Link
            key={href}
            href={href}
            className={`group flex items-start gap-4 rounded-2xl border bg-surface p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
              tone === "danger"
                ? "border-destructive/25 hover:border-destructive/40"
                : "border-border/80 hover:border-primary/30"
            }`}
          >
            <span
              className={`grid size-12 shrink-0 place-items-center rounded-2xl transition ${
                tone === "danger"
                  ? "bg-destructive/10 text-destructive group-hover:bg-destructive/15"
                  : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
              }`}
            >
              <Icon size={22} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-start justify-between gap-2">
                <span className="text-base font-semibold leading-snug text-foreground">
                  {itemTitle}
                </span>
                <ArrowRight
                  size={16}
                  className="mt-1 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary"
                />
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
                {itemDescription}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default async function Home() {
  const currentUser = await getCurrentUser();
  const permissions = currentUser?.employee?.role?.permissions ?? [];
  const hrCards: MenuCard[] = filterHrNavItems(permissions)
    .filter((item) => item.path === "/hr")
    .map((item) => ({
      title: "บริหารพนักงาน",
      description: item.description,
      href: item.path,
      icon: UsersRound as LucideIcon,
    }));

  const visibleDaily = dailyCards.filter((card) =>
    canAccessPageWithPermissions(permissions, card.href),
  );
  const visibleSystem = systemCards.filter((card) =>
    canAccessPageWithPermissions(permissions, card.href),
  );
  const hasAny =
    visibleDaily.length > 0 || visibleSystem.length > 0 || hrCards.length > 0;

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-4 sm:p-8">
      <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-primary via-primary to-secondary p-7 text-primary-foreground shadow-lg sm:p-10">
        <div className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full bg-primary-foreground/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 size-52 rounded-full bg-secondary/40 blur-3xl" />
        <div className="relative flex items-start gap-4">
          <Image
            src="/logo.png"
            alt="Resident"
            width={64}
            height={64}
            className="size-16 shrink-0 rounded-2xl bg-surface/10 shadow-sm ring-1 ring-primary-foreground/20"
            priority
          />
          <div className="min-w-0">
            <p className="text-sm text-primary-foreground/80">
              Resident Hotel Management
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              เลือกงานที่ต้องการทำ
            </h1>
            <p className="mt-3 max-w-xl text-primary-foreground/80">
              เมนูถูกจัดกลุ่มตามงานจริง เพื่อเข้าถึงหน้าจอที่ต้องการได้เร็วขึ้น
            </p>
          </div>
        </div>
      </div>

      {!hasAny ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
          <p className="text-lg font-semibold text-foreground">
            ยังไม่มีเมนูที่เปิดให้ใช้งาน
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            บัญชีนี้ยังไม่มีสิทธิ์เข้าหน้างาน กรุณาติดต่อผู้ดูแลระบบ
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <MenuSection
            title="งานประจำวัน"
            description="จอง อาหาร แม่บ้าน ซูเปอร์มาร์เก็ต และรายงาน"
            items={visibleDaily}
          />
          <MenuSection
            title="บริหารพนักงาน"
            description="บุคลากร ตารางงาน และค่าจ้าง"
            items={hrCards}
          />
          <MenuSection
            title="ระบบ"
            description="ตั้งค่าข้อมูลหลักและการล้างข้อมูล"
            items={visibleSystem}
          />
        </div>
      )}
    </div>
  );
}
