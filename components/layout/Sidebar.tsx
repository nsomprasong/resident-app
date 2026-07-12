"use client";

import { BarChart3, BedDouble, CalendarDays, ClipboardList, CookingPot, HandCoins, House, Utensils, X } from "lucide-react";
import { useEffect, useState } from "react";
import { canAccessPageWithPermissions } from "@/lib/auth/authorization";
import ListMenu from "../ui/ListMenu";
import UserNav from "../ui/UserNav";

type CurrentEmployee = {
  name: string;
  role: string;
  roleDisplayName: string;
  permissions: string[];
};

const menuItems = [
  { text: "รายการจอง", icon: BedDouble, path: "/booking" },
  { text: "สั่งอาหาร", icon: Utensils, path: "/foodOrder" },
  { text: "ครัว", icon: CookingPot, path: "/kitchen" },
  { text: "ตารางพนักงาน", icon: CalendarDays, path: "/employeeSchedule" },
  { text: "แม่บ้านและมินิบาร์", icon: House, path: "/houseKeeperMinibar" },
  { text: "บัญชีและแดชบอร์ด", icon: BarChart3, path: "/dashboard" },
  { text: "ค่าแรง", icon: HandCoins, path: "/wage" },
  { text: "รายงานรวม", icon: ClipboardList, path: "/report" },
];

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [employee, setEmployee] = useState<CurrentEmployee | null>(null);
  const [identityLoaded, setIdentityLoaded] = useState(false);
  const visibleMenuItems = employee
    ? menuItems.filter((item) =>
        canAccessPageWithPermissions(employee.permissions, item.path),
      )
    : [];

  useEffect(() => {
    const controller = new AbortController();

    async function loadCurrentEmployee() {
      try {
        const response = await fetch("/api/auth/me", {
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { employee: CurrentEmployee };
        setEmployee(data.employee);
      } catch {
        // Keep a neutral fallback when identity cannot be loaded.
      } finally {
        if (!controller.signal.aborted) {
          setIdentityLoaded(true);
        }
      }
    }

    void loadCurrentEmployee();

    return () => controller.abort();
  }, []);

  return (
    <>
      {open && <button aria-label="ปิดเมนู" className="fixed inset-0 z-40 bg-slate-950/40 md:hidden" onClick={onClose} />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
          <div><p className="text-lg font-semibold text-indigo-600">Resident</p><p className="text-xs text-slate-400">Hotel management</p></div>
          <button aria-label="ปิดเมนู" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100 md:hidden"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto py-5"><ListMenu menuItems={visibleMenuItems} onClose={onClose} title="งานประจำวัน" /></div>
        <UserNav
          image="/images/person.svg"
          name={employee?.name ?? (identityLoaded ? "ไม่พบข้อมูลพนักงาน" : "กำลังโหลด...")}
          role={employee?.roleDisplayName ?? ""}
        />
      </aside>
    </>
  );
}
