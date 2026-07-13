"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface MenuItem { text: string; icon: LucideIcon; path: string }

export default function ListMenu({ menuItems, title, onClose }: { menuItems: MenuItem[]; title: string; onClose: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="px-3">
      <p className="px-3 pb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">{title}</p>
      <ul className="space-y-1">
        {menuItems.map(({ text, icon: Icon, path }) => {
          const active = pathname === path || pathname.startsWith(`${path}/`);
          return <li key={path}><Link onClick={onClose} href={path} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-surface-muted hover:text-foreground"}`}><Icon size={19} />{text}</Link></li>;
        })}
      </ul>
    </nav>
  );
}
