"use client";

import { BarChart3, Boxes, Calculator, PackageSearch, Settings, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/ui/PageHeader";

const tabs = [
  { href: "/pos", label: "ขาย", icon: ShoppingCart },
  { href: "/pos/products", label: "สินค้า", icon: PackageSearch },
  { href: "/pos/stock", label: "สต๊อก", icon: Boxes },
  { href: "/pos/shifts", label: "กะ", icon: Calculator },
  { href: "/pos/reports", label: "รายงาน", icon: BarChart3 },
  { href: "/pos/settings", label: "ตั้งค่า", icon: Settings },
] as const;

type PosShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function PosShell({ title, description, children }: PosShellProps) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-8">
      <PageHeader
        icon={<ShoppingCart size={24} />}
        eyebrow="ซูเปอร์มาร์เก็ต"
        title={title}
        description={description}
        toolbar={
          <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="เมนูซูเปอร์มาร์เก็ต">
            {tabs.map(({ href, label, icon: Icon }) => {
              const active = href === "/pos" ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    active ? "bg-primary text-primary-foreground" : "border border-border bg-background hover:bg-muted"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </nav>
        }
      />
      {children}
    </div>
  );
}
