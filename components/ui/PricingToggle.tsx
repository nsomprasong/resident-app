"use client";

import { Package, PlusCircle } from "lucide-react";

export default function PricingToggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (isExtra: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-xl bg-muted p-1 text-xs">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(false)}
        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 transition disabled:opacity-50 ${
          !value
            ? "bg-surface font-medium text-foreground shadow-sm"
            : "text-muted-foreground"
        }`}
      >
        <Package size={14} />
        รวมในเหมา
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(true)}
        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 transition disabled:opacity-50 ${
          value
            ? "bg-surface font-medium text-foreground shadow-sm"
            : "text-muted-foreground"
        }`}
      >
        <PlusCircle size={14} />
        คิดเพิ่ม
      </button>
    </div>
  );
}
