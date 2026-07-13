"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

import { formatThaiDate } from "@/lib/format/date";

function todayKey() {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function parseKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
}

function toKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function startWeekday(year: number, month: number) {
  // 0 = Sunday
  return new Date(year, month - 1, 1).getDay();
}

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function isBefore(a: string, b: string) {
  return a < b;
}

function isAfter(a: string, b: string) {
  return a > b;
}

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

export default function DateSelector({
  date,
  setDate,
  className = "",
  min,
  max,
  required = false,
  id,
  name,
  disabled = false,
}: {
  date: string;
  setDate: (date: string) => void;
  className?: string;
  min?: string;
  max?: string;
  required?: boolean;
  id?: string;
  name?: string;
  disabled?: boolean;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});

  const selected = date || todayKey();
  const parsed = parseKey(selected);
  const [viewYear, setViewYear] = useState(parsed.year);
  const [viewMonth, setViewMonth] = useState(parsed.month);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const next = parseKey(date || todayKey());
    setViewYear(next.year);
    setViewMonth(next.month);
  }, [open, date]);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.max(rect.width, 280);
      const left = Math.min(
        Math.max(8, rect.left),
        window.innerWidth - width - 8,
      );
      const below = rect.bottom + 8;
      const panelHeight = 320;
      const top =
        below + panelHeight > window.innerHeight
          ? Math.max(8, rect.top - panelHeight - 8)
          : below;
      setPanelStyle({
        position: "fixed",
        top,
        left,
        width,
        zIndex: 120,
      });
    };

    updatePosition();
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      const panel = document.getElementById(`${inputId}-panel`);
      if (panel?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, inputId]);

  const cells = useMemo(() => {
    const total = daysInMonth(viewYear, viewMonth);
    const offset = startWeekday(viewYear, viewMonth);
    const items: Array<{ key: string; day: number; inMonth: boolean } | null> =
      [];
    for (let index = 0; index < offset; index += 1) items.push(null);
    for (let day = 1; day <= total; day += 1) {
      items.push({
        key: toKey(viewYear, viewMonth, day),
        day,
        inMonth: true,
      });
    }
    return items;
  }, [viewMonth, viewYear]);

  const shiftMonth = (delta: number) => {
    const base = new Date(viewYear, viewMonth - 1 + delta, 1);
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth() + 1);
  };

  const pick = (key: string) => {
    if (min && isBefore(key, min)) return;
    if (max && isAfter(key, max)) return;
    setDate(key);
    setOpen(false);
  };

  const panel =
    mounted && open
      ? createPortal(
          <div
            id={`${inputId}-panel`}
            role="dialog"
            aria-label="เลือกวันที่"
            style={panelStyle}
            className="rounded-2xl border border-border bg-surface p-3 shadow-2xl"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="เดือนก่อนหน้า"
                onClick={() => shiftMonth(-1)}
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted"
              >
                <ChevronLeft size={18} />
              </button>
              <p className="text-sm font-medium text-foreground">
                {monthLabel(viewYear, viewMonth)}
              </p>
              <button
                type="button"
                aria-label="เดือนถัดไป"
                onClick={() => shiftMonth(1)}
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-1">
              {WEEKDAYS.map((label) => (
                <div
                  key={label}
                  className="py-1 text-center text-[11px] font-medium text-muted-foreground"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {cells.map((cell, index) => {
                if (!cell) {
                  return <div key={`empty-${index}`} className="h-9" />;
                }
                const tooEarly = Boolean(min && isBefore(cell.key, min));
                const tooLate = Boolean(max && isAfter(cell.key, max));
                const blocked = tooEarly || tooLate;
                const isSelected = cell.key === selected;
                const isToday = cell.key === todayKey();
                return (
                  <button
                    key={cell.key}
                    type="button"
                    disabled={blocked}
                    onClick={() => pick(cell.key)}
                    className={`h-9 rounded-lg text-sm transition ${
                      isSelected
                        ? "bg-primary font-semibold text-primary-foreground"
                        : isToday
                          ? "bg-muted font-medium text-foreground"
                          : "text-foreground hover:bg-muted"
                    } disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent`}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        id={inputId}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!disabled) setOpen((value) => !value);
        }}
        className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-sm text-foreground shadow-sm transition hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <CalendarDays size={18} aria-hidden className="shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate">{formatThaiDate(date)}</span>
      </button>

      {/* Keep a real value in the form for required / submit semantics */}
      <input
        type="text"
        name={name}
        value={date}
        required={required}
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute h-px w-px opacity-0"
        onChange={() => undefined}
      />

      {panel}
    </div>
  );
}

export {
  formatThaiDate,
  formatThaiDateRange,
  formatThaiDateTime,
} from "@/lib/format/date";
