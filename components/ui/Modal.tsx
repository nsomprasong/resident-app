"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

const sizeClass = {
  md: "max-w-lg",
  lg: "max-w-[720px]",
  xl: "max-w-3xl",
} as const;

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  fullScreenOnMobile = false,
  nested = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof sizeClass;
  fullScreenOnMobile?: boolean;
  nested?: boolean;
}) {
  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 grid place-items-center bg-foreground/50 p-0 sm:p-4 ${
        nested ? "z-[80]" : "z-[70]"
      } ${fullScreenOnMobile ? "" : "p-4"}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`flex w-full flex-col overflow-hidden bg-surface text-foreground shadow-2xl ${sizeClass[size]} ${
          fullScreenOnMobile
            ? "h-[100dvh] max-h-[100dvh] rounded-none sm:h-auto sm:max-h-[90vh] sm:rounded-3xl"
            : "max-h-[90vh] rounded-3xl"
        }`}
      >
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-border bg-surface px-4 py-3 sm:px-5">
          <h2 className="truncate text-lg font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            aria-label="ปิด"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-muted text-foreground hover:bg-border"
          >
            <X size={22} strokeWidth={2.5} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 sm:px-5">
          {children}
        </div>
        {footer ? (
          <div className="sticky bottom-0 z-10 shrink-0 border-t border-border bg-surface px-4 py-3 sm:px-5">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
