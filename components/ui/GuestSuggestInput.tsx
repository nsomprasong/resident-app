"use client";

import { useEffect, useId, useRef, useState } from "react";

export type GuestSuggestSelection = {
  id: string;
  kind: "guest" | "tour_group";
  name: string;
  contactName: string | null;
  phone: string | null;
  bookingCount: number;
};

type GuestSuggestInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (item: GuestSuggestSelection) => void;
  className?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  /** Include past tour groups in suggestions (group booking) */
  includeTourGroups?: boolean;
  "aria-label"?: string;
};

export default function GuestSuggestInput({
  value,
  onChange,
  onSelect,
  className,
  required,
  placeholder,
  disabled,
  includeTourGroups = false,
  "aria-label": ariaLabel,
}: GuestSuggestInputProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<GuestSuggestSelection[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 1) {
      setItems([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ q: query, limit: "12" });
      if (includeTourGroups) params.set("includeTourGroups", "1");
      void fetch(`/api/guests?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            setItems([]);
            return;
          }
          const data = (await response.json()) as {
            items?: GuestSuggestSelection[];
          };
          setItems(Array.isArray(data.items) ? data.items : []);
          setActiveIndex(-1);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          setItems([]);
        })
        .finally(() => setLoading(false));
    }, 220);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [includeTourGroups, value]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const showList = open && value.trim().length > 0 && (loading || items.length > 0);

  const pick = (item: GuestSuggestSelection) => {
    onSelect(item);
    setOpen(false);
    setItems([]);
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        required={required}
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={showList}
        autoComplete="off"
        role="combobox"
        className={className}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (!showList || items.length === 0) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) =>
              current < items.length - 1 ? current + 1 : 0,
            );
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) =>
              current > 0 ? current - 1 : items.length - 1,
            );
          } else if (event.key === "Enter" && activeIndex >= 0) {
            event.preventDefault();
            const item = items[activeIndex];
            if (item) pick(item);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-surface py-1 shadow-lg"
        >
          {loading && items.length === 0 ? (
            <li className="px-3 py-2 text-xs text-muted-foreground">
              กำลังค้นหา...
            </li>
          ) : null}
          {items.map((item, index) => {
            const subtitle = [
              item.kind === "tour_group" ? "กรุ๊ปทัวร์" : "ลูกค้า",
              item.phone || null,
              item.bookingCount > 0 ? `${item.bookingCount} การจอง` : null,
            ]
              .filter(Boolean)
              .join(" · ");
            const title =
              item.kind === "tour_group"
                ? item.name
                : item.name || "ลูกค้า";
            const detail =
              item.kind === "tour_group" && item.contactName
                ? `ผู้ติดต่อ: ${item.contactName}`
                : null;
            return (
              <li key={`${item.kind}:${item.id}`} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted ${
                    index === activeIndex ? "bg-muted" : ""
                  }`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(item)}
                >
                  <span className="font-medium text-foreground">{title}</span>
                  {detail ? (
                    <span className="text-xs text-muted-foreground">{detail}</span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">{subtitle}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
