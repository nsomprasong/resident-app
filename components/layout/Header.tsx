"use client";

import Image from "next/image";
import { Menu } from "lucide-react";

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-surface px-4 md:hidden">
      <div className="flex items-center gap-3">
        <button type="button" aria-label="เปิดเมนู" onClick={onMenuClick} className="rounded-xl p-2 text-muted-foreground hover:bg-muted">
          <Menu size={22} />
        </button>
        <Image
          src="/logo.png"
          alt="Resident"
          width={32}
          height={32}
          className="size-8 rounded-lg"
          priority
        />
        <span className="font-semibold">Resident</span>
      </div>
      <Image className="rounded-full" src="/images/person.svg" alt="ผู้ใช้งาน" width={34} height={34} />
    </header>
  );
}
