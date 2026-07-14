"use client";

import { AlertTriangle, Info } from "lucide-react";

export type ConfirmTone = "default" | "danger" | "warning";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  onConfirm: () => void;
  onCancel: () => void;
};

const toneStyles: Record<
  ConfirmTone,
  {
    iconWrap: string;
    icon: string;
    confirmButton: string;
  }
> = {
  default: {
    iconWrap: "bg-primary/10 text-primary",
    icon: "text-primary",
    confirmButton:
      "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50",
  },
  warning: {
    iconWrap: "bg-amber-500/15 text-amber-700",
    icon: "text-amber-700",
    confirmButton:
      "bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50",
  },
  danger: {
    iconWrap: "bg-destructive/10 text-destructive",
    icon: "text-destructive",
    confirmButton:
      "bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50",
  },
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "ยืนยัน",
  cancelLabel = "ยกเลิก",
  tone = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const styles = toneStyles[tone];
  const Icon = tone === "default" ? Info : AlertTriangle;

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-foreground/50 p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby={description ? "confirm-dialog-description" : undefined}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl bg-surface text-foreground shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-5 pt-5 sm:px-6 sm:pt-6">
          <div className="flex gap-4">
            <div
              className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${styles.iconWrap}`}
            >
              <Icon className={styles.icon} size={22} strokeWidth={2.25} />
            </div>
            <div className="min-w-0 pt-0.5">
              <h2
                id="confirm-dialog-title"
                className="text-lg font-semibold leading-snug text-foreground"
              >
                {title}
              </h2>
              {description ? (
                <p
                  id="confirm-dialog-description"
                  className="mt-2 text-sm leading-relaxed text-muted-foreground"
                >
                  {description}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium ${styles.confirmButton}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
