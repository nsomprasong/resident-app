"use client";

import { Menu, UserRound } from "lucide-react";

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-surface px-4 md:hidden">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="เปิดเมนู"
          data-tooltip="เปิดเมนูนำทางของระบบ"
          onClick={onMenuClick}
          className="rounded-xl p-2 text-muted-foreground hover:bg-muted"
        >
          <Menu size={22} />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Resident"
          width={32}
          height={32}
          className="size-8 rounded-lg"
        />
        <span className="font-semibold">Resident</span>
      </div>
      <span
        aria-hidden
        className="grid size-[34px] place-items-center rounded-full bg-muted text-muted-foreground"
      >
        <UserRound size={18} />
      </span>
    </header>
  );
}
