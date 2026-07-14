"use client";

import {
  BarChart3,
  BedDouble,
  CalendarCheck2,
  ClipboardList,
  CookingPot,
  Eraser,
  House,
  Settings,
  ShoppingCart,
  Utensils,
  UsersRound,
  X,
} from "lucide-react";
import Image from "next/image";
import { useMemo } from "react";

import { useEmployeePermissions } from "@/components/auth/EmployeePermissionsProvider";
import { filterHrNavItems } from "@/lib/hr/nav";
import ListMenu from "../ui/ListMenu";
import UserNav from "../ui/UserNav";

const dailyMenuItems = [
  { text: "ภาพรวมวันนี้", icon: CalendarCheck2, path: "/today" },
  { text: "รายการจอง", icon: BedDouble, path: "/booking" },
  { text: "สั่งอาหาร", icon: Utensils, path: "/foodOrder" },
  { text: "ครัว", icon: CookingPot, path: "/kitchen" },
  { text: "แม่บ้านและตรวจสอบห้องพัก", icon: House, path: "/houseKeeperMinibar" },
  { text: "ซูเปอร์มาร์เก็ต", icon: ShoppingCart, path: "/pos" },
  { text: "บัญชีและแดชบอร์ด", icon: BarChart3, path: "/dashboard" },
  { text: "รายงานรวม", icon: ClipboardList, path: "/report" },
];

const systemMenuItems = [
  { text: "ตั้งค่าข้อมูลหลัก", icon: Settings, path: "/settings" },
  { text: "ล้างข้อมูลเริ่มต้นใหม่", icon: Eraser, path: "/system/data-reset" },
];

export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { employee, loaded, canAccessPath } = useEmployeePermissions();

  const visibleDailyItems = useMemo(
    () =>
      employee
        ? dailyMenuItems.filter((item) => canAccessPath(item.path))
        : [],
    [employee, canAccessPath],
  );

  const visibleSystemItems = useMemo(
    () =>
      employee
        ? systemMenuItems.filter((item) => canAccessPath(item.path))
        : [],
    [employee, canAccessPath],
  );

  const visibleHrItems = useMemo(
    () =>
      employee
        ? filterHrNavItems(employee.permissions).map((item) => ({
            text: item.text,
            icon: item.icon,
            path: item.path,
          }))
        : [],
    [employee],
  );

  return (
    <>
      {open ? (
        <button
          aria-label="ปิดเมนู"
          className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-[1px] md:hidden"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[17.5rem] flex-col border-r border-border/80 bg-surface shadow-[4px_0_24px_rgba(0,0,0,0.04)] transition-transform md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="relative overflow-hidden border-b border-border/80 px-4 py-4">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10" />
          <div className="relative flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <Image
                src="/logo.png"
                alt="Resident"
                width={44}
                height={44}
                className="size-11 shrink-0 rounded-2xl shadow-sm ring-1 ring-border/70"
                priority
              />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold tracking-tight text-foreground">
                  Resident
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  ระบบจัดการที่พัก
                </p>
              </div>
            </div>
            <button
              aria-label="ปิดเมนู"
              onClick={onClose}
              className="rounded-xl p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground md:hidden"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto py-4">
          {!loaded && !employee ? (
            <div className="px-5 text-sm text-muted-foreground">
              <UsersRound size={16} className="mb-2" />
              กำลังโหลดเมนู...
            </div>
          ) : null}

          {visibleDailyItems.length > 0 ? (
            <ListMenu
              menuItems={visibleDailyItems}
              onClose={onClose}
              title="งานประจำวัน"
            />
          ) : null}

          {visibleHrItems.length > 0 ? (
            <ListMenu
              menuItems={visibleHrItems}
              onClose={onClose}
              title="บริหารพนักงาน"
            />
          ) : null}

          {visibleSystemItems.length > 0 ? (
            <ListMenu
              menuItems={visibleSystemItems}
              onClose={onClose}
              title="ระบบ"
            />
          ) : null}
        </div>

        <UserNav
          image="/images/person.svg"
          name={
            employee?.name ?? (loaded ? "ไม่พบข้อมูลพนักงาน" : "กำลังโหลด...")
          }
          role={employee?.roleDisplayName ?? ""}
        />
      </aside>
    </>
  );
}
