"use client";
import { CircleCheck, Plus } from "lucide-react";
import { useEffect, useState } from "react";
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
  const refund = mode === "refund";
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
  return (
    <>
      <button
        type="button"
        disabled={amount <= 0}
        onClick={() => {
          setPaidAmount(amount);
          setError("");
          setOpen(true);
          void loadChannels();
        }}
        className={`rounded-xl px-5 py-3 font-medium text-white disabled:bg-slate-400 ${refund ? "bg-rose-600 hover:bg-rose-700" : "bg-indigo-600 hover:bg-indigo-700"}`}
      >
        {refund ? "คืนเงิน" : amount > 0 ? "รับชำระเงิน" : "ชำระครบแล้ว"}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={refund ? "บันทึกคืนเงิน" : "บันทึกรับชำระเงิน"}
      >
        <div className="space-y-4 text-slate-900">
          <label className="block text-sm font-medium">
            {refund ? "จำนวนเงินที่คืน" : "จำนวนเงินที่ได้รับ"}
            <input
              type="number"
              min={0.01}
              max={amount}
              step="0.01"
              value={paidAmount}
              onChange={(e) => setPaidAmount(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-lg font-semibold text-slate-900 outline-none focus:border-indigo-500"
            />
          </label>
          <p className="text-xs text-slate-500">
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
                className="inline-flex items-center gap-1 text-xs text-indigo-700"
              >
                <Plus size={14} />
                เพิ่มช่องทาง
              </button>
            </div>
            <select
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-indigo-500"
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
            <div className="space-y-2 rounded-xl border border-indigo-100 bg-indigo-50 p-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="ชื่อช่องทาง เช่น ธนาคารกสิกร"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
              />
              <select
                value={newMethod}
                onChange={(e) => setNewMethod(e.target.value as Method)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
              >
                <option value="TRANSFER">เงินโอน</option>
                <option value="CASH">เงินสด</option>
                <option value="PROMPTPAY">พร้อมเพย์</option>
                <option value="CARD">บัตร</option>
              </select>
              <button
                type="button"
                onClick={addChannel}
                className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white"
              >
                บันทึกช่องทาง
              </button>
            </div>
          )}
          <p className="rounded-xl bg-indigo-50 p-3 text-sm text-indigo-700">
            {refund
              ? "ระบบจะบันทึกยอดคืนเงินไว้ในประวัติการรับเงิน"
              : "ยอดรับครั้งแรกจะบันทึกเป็น “เงินมัดจำ” อัตโนมัติ"}
          </p>
          {error && (
            <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={saving}
            onClick={confirm}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium text-white disabled:opacity-50 ${refund ? "bg-rose-600" : "bg-emerald-600"}`}
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
