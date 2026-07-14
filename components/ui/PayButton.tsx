"use client";
import { Banknote, CircleCheck, Plus, Save, Undo2 } from "lucide-react";
import { useEffect, useState } from "react";

import { useEmployeePermissions } from "@/components/auth/EmployeePermissionsProvider";
import Modal from "./Modal";
type Method = "CASH" | "TRANSFER" | "PROMPTPAY" | "CARD";
interface Channel {
  id: string;
  name: string;
  method: Method;
}
export default function PayButton({
  amount,
  onConfirm,
  mode = "payment",
}: {
  amount: number;
  onConfirm?: (
    paidAmount: number,
    method: Method,
    channelId: string,
  ) => Promise<void>;
  mode?: "payment" | "refund";
}) {
  const { loaded, can } = useEmployeePermissions();
  const refund = mode === "refund";
  const allowed = refund ? can("payment.refund") : can("payment.collect");
  const [open, setOpen] = useState(false);
  const [paidAmount, setPaidAmount] = useState(amount);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelId, setChannelId] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMethod, setNewMethod] = useState<Method>("TRANSFER");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const loadChannels = async () => {
    const response = await fetch("/api/payment-channels", {
      cache: "no-store",
    });
    const data = (await response.json()) as Channel[];
    if (response.ok) {
      setChannels(data);
      setChannelId((current) => current || data[0]?.id || "");
    }
  };
  useEffect(() => {
    setPaidAmount(amount);
  }, [amount]);
  const addChannel = async () => {
    if (!newName.trim()) return;
    setError("");
    const response = await fetch("/api/payment-channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, method: newMethod }),
    });
    const data = (await response.json()) as Channel & { message?: string };
    if (!response.ok) return setError(data.message ?? "เพิ่มช่องทางไม่สำเร็จ");
    setChannels([...channels, data]);
    setChannelId(data.id);
    setNewName("");
    setAdding(false);
  };
  const confirm = async () => {
    if (!Number.isFinite(paidAmount) || paidAmount <= 0)
      return setError("กรุณาใส่จำนวนเงินมากกว่า 0 บาท");
    if (paidAmount > amount) return setError("จำนวนเงินต้องไม่เกินยอดคงเหลือ");
    const channel = channels.find((item) => item.id === channelId);
    if (!channel) return setError("กรุณาเลือกช่องทางรับชำระ");
    setSaving(true);
    setError("");
    try {
      await onConfirm?.(paidAmount, channel.method, channel.id);
      setOpen(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };
  if (!loaded || !allowed) return null;

  return (
    <>
      <button
        type="button"
        disabled={amount <= 0}
        data-tooltip={
          refund
            ? "บันทึกการคืนเงินให้ลูกค้า"
            : "เปิดหน้าต่างรับชำระเงินของรายการจอง"
        }
        onClick={() => {
          setPaidAmount(amount);
          setError("");
          setOpen(true);
          void loadChannels();
        }}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 font-medium disabled:bg-muted-foreground ${refund ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
      >
        {refund ? <Undo2 size={18} /> : <Banknote size={18} />}
        {refund ? "คืนเงิน" : amount > 0 ? "รับชำระเงิน" : "ชำระครบแล้ว"}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={refund ? "บันทึกคืนเงิน" : "บันทึกรับชำระเงิน"}
      >
        <div className="space-y-4 text-foreground">
          <label className="block text-sm font-medium">
            {refund ? "จำนวนเงินที่คืน" : "จำนวนเงินที่ได้รับ"}
            <input
              type="number"
              min={0.01}
              max={amount}
              step="0.01"
              value={paidAmount}
              onChange={(e) => setPaidAmount(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-border bg-surface px-4 py-3 text-lg font-semibold text-foreground outline-none focus:border-primary"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            {refund ? "ยอดที่คืนได้" : "ยอดคงเหลือ"} ฿{amount.toLocaleString()}
          </p>
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm font-medium">
                {refund ? "ช่องทางคืนเงิน" : "ช่องทางรับชำระ"}
              </label>
              <button
                type="button"
                onClick={() => setAdding(!adding)}
                className="inline-flex items-center gap-1 text-xs text-secondary"
              >
                <Plus size={14} />
                เพิ่มช่องทาง
              </button>
            </div>
            <select
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground outline-none focus:border-primary"
            >
              <option value="">เลือกช่องทาง</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  {channel.name}
                </option>
              ))}
            </select>
          </div>
          {adding && (
            <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/10 p-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="ชื่อช่องทาง เช่น ธนาคารกสิกร"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
              />
              <select
                value={newMethod}
                onChange={(e) => setNewMethod(e.target.value as Method)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-foreground"
              >
                <option value="TRANSFER">เงินโอน</option>
                <option value="CASH">เงินสด</option>
                <option value="PROMPTPAY">พร้อมเพย์</option>
                <option value="CARD">บัตร</option>
              </select>
              <button
                type="button"
                onClick={addChannel}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground"
              >
                <Save size={16} />
                บันทึกช่องทาง
              </button>
            </div>
          )}
          <p className="rounded-xl bg-primary/10 p-3 text-sm text-primary">
            {refund
              ? "ระบบจะบันทึกยอดคืนเงินไว้ในประวัติการรับเงิน"
              : "ยอดรับครั้งแรกจะบันทึกเป็น “เงินมัดจำ” อัตโนมัติ"}
          </p>
          {error && (
            <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={confirm}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium disabled:opacity-50 ${refund ? "bg-destructive text-destructive-foreground" : "bg-success text-success-foreground"}`}
          >
            <CircleCheck size={19} />
            {saving
              ? "กำลังบันทึก..."
              : refund
                ? "ยืนยันคืนเงิน"
                : "ยืนยันรับเงิน"}
          </button>
        </div>
      </Modal>
    </>
  );
}
