"use client";

import { Receipt, Save } from "lucide-react";
import { useEffect, useState } from "react";

import BookingExtraChargesPanel, {
  type BookingExtraChargeDraft,
} from "./BookingExtraChargesPanel";
import Modal from "./Modal";
import { extraChargeLineTotal } from "@/lib/bookings/extra-charges";

export default function AddBookingChargesDialog({
  open,
  setOpen,
  bookingId,
  onAdded,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  bookingId: string;
  onAdded: () => void;
}) {
  const [items, setItems] = useState<BookingExtraChargeDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setItems([]);
    setError("");
  }, [open]);

  const submit = async () => {
    const charges = items
      .filter((item) => extraChargeLineTotal(item) > 0)
      .map((item) => ({
        description: item.description.trim(),
        amount: item.amount,
        quantity: item.quantity,
        type: item.type,
      }));
    if (!charges.length) {
      setError("กรุณาเพิ่มรายการพร้อมราคาและจำนวนที่ถูกต้อง");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/bookings/${bookingId}/charges`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ charges }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message);
      setOpen(false);
      setItems([]);
      onAdded();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "เพิ่มค่าใช้จ่ายไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="เพิ่มค่าใช้จ่าย"
      size="lg"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Save size={17} />
            {saving ? "กำลังบันทึก..." : "บันทึกค่าใช้จ่าย"}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Receipt size={16} className="mt-0.5 shrink-0" />
          เพิ่มรายการเช่น ค่าทำความสะอาด ค่าแก๊ส ค่าน้ำแข็ง หรือรายการกำหนดเอง
        </p>
        <BookingExtraChargesPanel items={items} onChange={setItems} />
        {error ? (
          <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
