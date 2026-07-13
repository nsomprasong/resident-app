"use client";

import {
  BedDouble,
  CalendarDays,
  ChevronRight,
  ShipWheel,
  UsersRound,
  UtensilsCrossed,
  Wine,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

export type TodayOpsDetailRow = {
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
};

export type TodayOpsCardKey =
  | "rooms"
  | "groups"
  | "rafts"
  | "guests"
  | "food"
  | "minibar";

export type TodayOpsCardData = {
  key: TodayOpsCardKey;
  title: string;
  value: string;
  helper: string;
  accent: "primary" | "secondary";
  rows: TodayOpsDetailRow[];
};

const icons: Record<TodayOpsCardKey, ReactNode> = {
  rooms: <BedDouble size={22} />,
  groups: <UsersRound size={22} />,
  rafts: <ShipWheel size={22} />,
  guests: <CalendarDays size={22} />,
  food: <UtensilsCrossed size={22} />,
  minibar: <Wine size={22} />,
};

function accentClass(accent: "primary" | "secondary") {
  return accent === "primary" ? "bg-primary" : "bg-secondary";
}

export default function TodayOpsBoard({ cards }: { cards: TodayOpsCardData[] }) {
  const [activeKey, setActiveKey] = useState<TodayOpsCardKey | null>(null);
  const active = useMemo(
    () => cards.find((card) => card.key === activeKey) ?? null,
    [activeKey, cards],
  );

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => setActiveKey(card.key)}
            className="group relative overflow-hidden rounded-3xl border border-border bg-surface p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <div
              className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 ${accentClass(card.accent)}`}
            />
            <div className="relative flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </p>
                <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
                  {card.value}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{card.helper}</p>
                <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
                  ดูรายละเอียด
                  <ChevronRight
                    size={14}
                    className="transition group-hover:translate-x-0.5"
                  />
                </p>
              </div>
              <span
                className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-primary-foreground ${accentClass(card.accent)}`}
              >
                {icons[card.key]}
              </span>
            </div>
          </button>
        ))}
      </div>

      {active ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="ปิดรายละเอียด"
            className="absolute inset-0 cursor-default"
            onClick={() => setActiveKey(null)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="today-ops-detail-title"
            className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-surface shadow-xl sm:rounded-3xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  รายละเอียดวันนี้
                </p>
                <h2
                  id="today-ops-detail-title"
                  className="mt-1 text-lg font-semibold text-foreground"
                >
                  {active.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  รวม {active.value} · {active.helper}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveKey(null)}
                className="rounded-xl p-2 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                aria-label="ปิด"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4">
              {active.rows.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                  ยังไม่มีรายละเอียดในหมวดนี้วันนี้
                </p>
              ) : (
                <ul className="space-y-2">
                  {active.rows.map((row) => (
                    <li
                      key={row.id}
                      className="rounded-2xl border border-border bg-background px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">
                            {row.title}
                          </p>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {row.subtitle}
                          </p>
                        </div>
                        {row.meta ? (
                          <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                            {row.meta}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
