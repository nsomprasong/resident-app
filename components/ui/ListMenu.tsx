"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface MenuItem {
  text: string;
  icon: LucideIcon;
  path: string;
}

export default function ListMenu({
  menuItems,
  title,
  onClose,
}: {
  menuItems: MenuItem[];
  title: string;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="px-3">
      <p className="mb-2 rounded-xl bg-muted px-3 py-2 text-sm font-semibold tracking-tight text-foreground">
        {title}
      </p>
      <ul className="space-y-1">
        {menuItems.map(({ text, icon: Icon, path }) => {
          const active =
            pathname === path ||
            (path !== "/hr" && pathname.startsWith(`${path}/`));
          return (
            <li key={path}>
              <Link
                onClick={onClose}
                href={path}
                className={`group flex items-center gap-3 rounded-2xl px-2.5 py-2 text-sm transition ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground/80 hover:bg-muted hover:text-foreground"
                }`}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-xl transition ${
                    active
                      ? "bg-primary-foreground/15 text-primary-foreground"
                      : "bg-muted text-muted-foreground group-hover:bg-background group-hover:text-primary"
                  }`}
                >
                  <Icon size={18} strokeWidth={active ? 2.25 : 2} />
                </span>
                <span className="min-w-0 flex-1 leading-snug">{text}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
