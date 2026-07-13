"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";

import BillDetail from "./BillDetail";

interface Item {
  id?: string;
  title: string;
  price: number;
}

export default function BillItem({
  icon,
  title,
  items,
  isEdit,
  footer,
  defaultOpen = false,
  showLinesTotal = true,
  headerAmount,
}: {
  icon?: ReactNode;
  title: string;
  items: Item[];
  isEdit: boolean;
  footer?: ReactNode;
  defaultOpen?: boolean;
  showLinesTotal?: boolean;
  headerAmount?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const linesTotal = items.reduce((sum, item) => sum + item.price, 0);
  const displayTotal = headerAmount ?? linesTotal;

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-4"
      >
        <span className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-muted text-muted-foreground">
            {icon}
          </span>
          <span className="font-medium">{title}</span>
        </span>
        <span className="flex items-center gap-3">
          <span>฿{displayTotal.toLocaleString()}</span>
          <ChevronDown
            size={18}
            className={`transition ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      {open ? (
        <div className="space-y-1 border-t border-border px-4 py-3">
          {items.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">ยังไม่มีรายการ</p>
          ) : (
            items.map((item, index) => (
              <BillDetail
                key={item.id ?? `${item.title}-${index}`}
                title={item.title}
                price={item.price}
                isEdit={isEdit}
              />
            ))
          )}
          {showLinesTotal ? (
            <div className="mt-2 border-t border-border pt-2">
              <BillDetail
                title="รวมราคา"
                price={linesTotal}
                isEdit={isEdit}
                summarize
              />
            </div>
          ) : null}
          {footer ? (
            <div className="mt-3 border-t border-border pt-3">{footer}</div>
          ) : null}
        </div>
      ) : footer ? (
        <div className="border-t border-border px-4 py-3">{footer}</div>
      ) : null}
    </div>
  );
}
