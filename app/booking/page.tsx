"use client";

import { History, Plus, UserRound, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import AddGroupBookingDialog from "@/components/ui/AddGroupBookingDialog";
import AddSoloBookingDialog from "@/components/ui/AddSoloBookingDialog";
import DateSelector from "@/components/ui/DateSelector";
import RoomGroupItem from "@/components/ui/RoomGroupItem";
import RoomItem from "@/components/ui/RoomItem";
import type { BookingDetail } from "@/interface/BookingDetailModel";

interface BookingResult {
  id: string;
  mode: "solo" | "group";
  customerName: string;
  status: string;
  rooms: BookingDetail[];
  rafts: Array<{ id: string; name: string; capacity: number }>;
}
type Tab = "group" | "solo" | "history";

export default function BookingPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [tab, setTab] = useState<Tab>("group");
  const [openSolo, setOpenSolo] = useState(false);
  const [openGroup, setOpenGroup] = useState(false);
  const [bookings, setBookings] = useState<BookingResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = tab === "history" ? "history=true" : `date=${date}`;
      const response = await fetch(`/api/bookings?${query}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as
        BookingResult[] | { message: string };
      if (!response.ok || !Array.isArray(data))
        throw new Error(
          "message" in data ? data.message : "โหลดข้อมูลไม่สำเร็จ",
        );
      setBookings(data);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "โหลดข้อมูลไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  }, [date, tab]);
  useEffect(() => {
    void loadBookings();
  }, [loadBookings, refresh]);
  const visible =
    tab === "history"
      ? bookings
      : bookings.filter((booking) => booking.mode === tab);
  const created = () => setRefresh((value) => value + 1);
  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-indigo-600">งานประจำวัน</p>
          <h1 className="text-2xl font-semibold">
            {tab === "history" ? "ประวัติการจอง" : "รายการจอง"}
          </h1>
        </div>
        {tab !== "history" && (
          <button
            type="button"
            onClick={() =>
              tab === "group" ? setOpenGroup(true) : setOpenSolo(true)
            }
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white"
          >
            <Plus size={18} />
            เพิ่มการจอง
          </button>
        )}
      </div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-slate-200/70 p-1">
          <button
            onClick={() => setTab("group")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm ${tab === "group" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}
          >
            <Users size={17} />
            แบบกลุ่ม
          </button>
          <button
            onClick={() => setTab("solo")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm ${tab === "solo" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}
          >
            <UserRound size={17} />
            แบบเดี่ยว
          </button>
          <button
            onClick={() => setTab("history")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm ${tab === "history" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}
          >
            <History size={17} />
            ประวัติ
          </button>
        </div>
        {tab !== "history" && <DateSelector date={date} setDate={setDate} />}
      </div>
      {loading ? (
        <p className="rounded-2xl bg-white p-8 text-center text-slate-500">
          กำลังโหลดรายการจอง...
        </p>
      ) : error ? (
        <p className="rounded-2xl bg-red-50 p-4 text-red-700">{error}</p>
      ) : (
        <div className="space-y-3">
          {visible.map((booking, index) => {
            const resources =
              [
                ...booking.rooms.map((room) => room.name),
                ...booking.rafts.map((raft) => raft.name),
              ].join(", ") || "ไม่มีห้องหรือแพ";
            return booking.mode === "group" ? (
              <RoomGroupItem
                key={booking.id}
                id={booking.id}
                customerName={`${booking.customerName} · ${resources}`}
                status={booking.status}
                roomInGroupList={booking.rooms}
                showStatus
              />
            ) : (
              <RoomItem
                key={booking.id}
                id={booking.id}
                name={`${booking.customerName} · ${resources}`}
                status={booking.status}
                image={
                  booking.rooms[0]?.image ??
                  `/images/room/room${(index % 4) + 1}.jpg`
                }
                showStatus
              />
            );
          })}
          {visible.length === 0 && (
            <p className="rounded-2xl bg-white p-8 text-center text-slate-500">
              {tab === "history"
                ? "ยังไม่มีประวัติการเช็กเอาต์หรือยกเลิก"
                : "ไม่มีรายการจองในวันที่เลือก"}
            </p>
          )}
        </div>
      )}
      <AddSoloBookingDialog
        open={openSolo}
        setOpen={setOpenSolo}
        onCreated={created}
      />
      <AddGroupBookingDialog
        open={openGroup}
        setOpen={setOpenGroup}
        onCreated={created}
      />
    </div>
  );
}
