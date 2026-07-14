"use client";

import {
  BarChart3,
  Boxes,
  Calculator,
  PackageSearch,
  Settings,
  ShoppingCart,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, type ReactNode } from "react";

import { useEmployeePermissions } from "@/components/auth/EmployeePermissionsProvider";
import { PageHeader } from "@/components/ui/PageHeader";

const tabs = [
  {
    href: "/pos",
    label: "ขาย",
    icon: ShoppingCart,
    tooltip: "หน้าขายหน้าร้าน สแกนสินค้าและรับชำระ",
  },
  {
    href: "/pos/products",
    label: "สินค้า",
    icon: PackageSearch,
    tooltip: "จัดการสินค้า หมวดหมู่ ราคา และรูปภาพ",
  },
  {
    href: "/pos/stock",
    label: "สต๊อก",
    icon: Boxes,
    tooltip: "รับเข้า ปรับยอด และตรวจนับสต๊อก",
  },
  {
    href: "/pos/shifts",
    label: "กะ",
    icon: Calculator,
    tooltip: "เปิด/ปิดกะ ปรับเงินลิ้นชัก และอนุมัติ",
  },
  {
    href: "/pos/reports",
    label: "รายงาน",
    icon: BarChart3,
    tooltip: "ดูยอดขาย กำไร และเงินขาด/เกิน",
  },
  {
    href: "/pos/settings",
    label: "ตั้งค่า",
    icon: Settings,
    tooltip: "ตั้งค่าชื่อร้าน ใบเสร็จ และกฎสต๊อก",
  },
] as const;

type PosShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function PosShell({ title, description, children }: PosShellProps) {
  const pathname = usePathname();
  const { loaded, canAccessPath } = useEmployeePermissions();

  const visibleTabs = useMemo(
    () => (loaded ? tabs.filter((tab) => canAccessPath(tab.href)) : []),
    [loaded, canAccessPath],
  );

  return (
    <div className="relative min-h-full">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,_rgba(212,163,115,0.18),_transparent_55%),radial-gradient(ellipse_at_80%_0%,_rgba(8,145,178,0.10),_transparent_45%)]"
      />
      <div className="relative mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
        <PageHeader
          icon={<ShoppingCart size={24} />}
          eyebrow="ซูเปอร์มาร์เก็ต"
          title={title}
          description={description}
          toolbar={
            visibleTabs.length > 0 ? (
              <nav
                className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                aria-label="เมนูซูเปอร์มาร์เก็ต"
              >
              {visibleTabs.map(({ href, label, icon: Icon, tooltip }) => {
                const active =
                  href === "/pos"
                    ? pathname === href
                    : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    data-tooltip={tooltip}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition duration-200 ${
                      active
                        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                        : "bg-background/80 text-muted-foreground ring-1 ring-border hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon size={16} className={active ? "opacity-100" : "opacity-70"} />
                    {label}
                  </Link>
                );
              })}
              </nav>
            ) : null
          }
        />
        {children}
      </div>
    </div>
  );
}
