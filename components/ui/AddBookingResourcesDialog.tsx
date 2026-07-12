"use client";
import { useState } from "react";
import Modal from "./Modal";
import RaftSelect from "./RaftSelect";
import ZoneRoomSelect from "./ZoneRoomSelect";

export default function AddBookingResourcesDialog({ open, setOpen, bookingId, checkIn, checkOut, onAdded }: { open: boolean; setOpen: (open: boolean) => void; bookingId: string; checkIn: string; checkOut: string; onAdded: () => void }) {
  const [roomIds, setRoomIds] = useState<string[]>([]); const [raftIds, setRaftIds] = useState<string[]>([]); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const submit = async () => { setSaving(true); setError(""); try { const response = await fetch(`/api/bookings/${bookingId}/resources`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomIds, raftIds }) }); const data = await response.json() as { message?: string }; if (!response.ok) throw new Error(data.message); setRoomIds([]); setRaftIds([]); setOpen(false); onAdded(); } catch (reason) { setError(reason instanceof Error ? reason.message : "เพิ่มรายการไม่สำเร็จ"); } finally { setSaving(false); } };
  return <Modal open={open} onClose={() => setOpen(false)} title="เพิ่มห้องหรือแพ"><div className="space-y-4"><p className="text-sm text-slate-500">เลือกเฉพาะรายการที่ต้องการเพิ่ม สามารถเลือกห้อง แพ หรือทั้งสองอย่างได้</p><ZoneRoomSelect selectedRoomIds={roomIds} onChange={setRoomIds} checkIn={checkIn} checkOut={checkOut} /><RaftSelect selectedRaftIds={raftIds} onChange={setRaftIds} checkIn={checkIn} checkOut={checkOut} />{error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button onClick={submit} disabled={saving || (!roomIds.length && !raftIds.length)} className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white disabled:bg-slate-300">{saving ? "กำลังเพิ่ม..." : "เพิ่มในรายการจอง"}</button></div></Modal>;
}
