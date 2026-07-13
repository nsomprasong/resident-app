"use client";

import type { ReactNode } from "react";
import {
  BedDouble,
  CalendarDays,
  History,
  LogIn,
  LogOut,
  Plus,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import AddGroupBookingDialog from "@/components/ui/AddGroupBookingDialog";
import AddSoloBookingDialog from "@/components/ui/AddSoloBookingDialog";
import DateSelector from "@/components/ui/DateSelector";
import { formatThaiDate } from "@/lib/format/date";
import { PageHeader } from "@/components/ui/PageHeader";
import RoomGroupItem from "@/components/ui/RoomGroupItem";
import RoomItem from "@/components/ui/RoomItem";
import type { BookingDetail } from "@/interface/BookingDetailModel";

interface BookingResult {
  id: string;
  reference?: string;
  mode: "solo" | "group";
  customerName: string;
  status: string;
  rooms: BookingDetail[];
  rafts: Array<{ id: string; name: string; capacity: number }>;
}

type Tab = "group" | "solo" | "history";

type RoomAvailability = {
  status: string;
  booked: boolean;
};

function todayBangkokKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function nextDayKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
}

function SummaryCard({
  title,
  value,
  helper,
  icon,
  tone = "primary",
}: {
  title: string;
  value: string;
  helper: string;
  icon: ReactNode;
  tone?: "primary" | "success" | "warning" | "info";
}) {
  const toneClass =
    tone === "success"
      ? "bg-success/10 text-success"
      : tone === "warning"
        ? "bg-warning/10 text-warning"
        : tone === "info"
          ? "bg-info/10 text-info"
          : "bg-primary/10 text-primary";

  return (
    <section className="rounded-3xl border border-border bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
            {value}
          </p>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{helper}</p>
        </div>
        <span
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${toneClass}`}
        >
          {icon}
        </span>
      </div>
    </section>
  );
}

export default function BookingPage() {
  const [date, setDate] = useState(todayBangkokKey);
  const [tab, setTab] = useState<Tab>("group");
  const [query, setQuery] = useState("");
  const [openSolo, setOpenSolo] = useState(false);
  const [openGroup, setOpenGroup] = useState(false);
  const [bookings, setBookings] = useState<BookingResult[]>([]);
  const [todayBookings, setTodayBookings] = useState<BookingResult[]>([]);
  const [availableRooms, setAvailableRooms] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const todayKey = todayBangkokKey();
  const isHistory = tab === "history";

  const openCreate = () => {
    if (tab === "solo") setOpenSolo(true);
    else setOpenGroup(true);
  };

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const queryString = isHistory ? "history=true" : `date=${date}`;
      const roomsCheckOut = nextDayKey(date);
      const [listResponse, todayResponse, roomsResponse] = await Promise.all([
        fetch(`/api/bookings?${queryString}`, { cache: "no-store" }),
        date === todayKey
          ? Promise.resolve(null)
          : fetch(`/api/bookings?date=${todayKey}`, { cache: "no-store" }),
        fetch(
          `/api/rooms?checkIn=${encodeURIComponent(date)}&checkOut=${encodeURIComponent(roomsCheckOut)}`,
          { cache: "no-store" },
        ),
      ]);

      const data = (await listResponse.json()) as
        | BookingResult[]
        | { message: string };
      if (!listResponse.ok || !Array.isArray(data)) {
        throw new Error(
          "message" in data ? data.message : "โหลดข้อมูลไม่สำเร็จ",
        );
      }
      setBookings(data);

      if (date === todayKey) {
        setTodayBookings(data);
      } else if (todayResponse) {
        const todayData = (await todayResponse.json()) as
          | BookingResult[]
          | { message: string };
        setTodayBookings(Array.isArray(todayData) ? todayData : []);
      } else {
        setTodayBookings([]);
      }

      if (roomsResponse.ok) {
        const rooms = (await roomsResponse.json()) as RoomAvailability[];
        setAvailableRooms(
          Array.isArray(rooms)
            ? rooms.filter((room) => room.status === "AVAILABLE" && !room.booked)
                .length
            : 0,
        );
      } else {
        setAvailableRooms(0);
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "โหลดข้อมูลไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  }, [date, isHistory, todayKey]);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings, refresh]);

  const visible = useMemo(() => {
    const byTab = isHistory
      ? bookings
      : bookings.filter((booking) => booking.mode === tab);
    const normalized = query.trim().toLowerCase();
    if (!normalized) return byTab;
    return byTab.filter((booking) => {
      const roomText = booking.rooms.map((room) => room.name).join(" ");
      const raftText = booking.rafts.map((raft) => raft.name).join(" ");
      const haystack = [
        booking.customerName,
        booking.reference ?? "",
        booking.id,
        roomText,
        raftText,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [bookings, isHistory, query, tab]);

  const checkedInToday = useMemo(
    () => todayBookings.filter((booking) => booking.status === "เช็กอิน").length,
    [todayBookings],
  );

  const totalForDate = bookings.length;
  const created = () => setRefresh((value) => value + 1);

  return (
    <div className="min-h-screen bg-muted p-4 pb-28 sm:p-8 sm:pb-28">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          icon={<BedDouble size={22} />}
          eyebrow="งานประจำวัน"
          title={isHistory ? "ประวัติการจอง" : "รายการจอง"}
          description={
            isHistory
              ? "ดูรายการที่เช็กเอาต์หรือยกเลิกแล้ว"
              : "จัดการรายการจอง ห้องพัก และประวัติการเข้าพัก"
          }
          actions={
            <>
              {!isHistory ? (
                <DateSelector
                  date={date}
                  setDate={setDate}
                  className="w-full lg:w-auto"
                />
              ) : null}
              {isHistory ? (
                <button
                  type="button"
                  onClick={() => setTab("group")}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-surface-muted sm:w-auto"
                >
                  กลับไปรายการจอง
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setTab("history")}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-surface-muted sm:w-auto"
                >
                  <History size={17} />
                  ประวัติการจอง
                </button>
              )}
            </>
          }
          toolbar={
            isHistory ? (
              <label className="relative block w-full min-w-0">
                <span className="sr-only">
                  ค้นหาชื่อผู้เข้าพัก เลขห้อง หรือเลขที่การจอง
                </span>
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ค้นหาชื่อ / ห้อง / เลขจอง"
                  className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-foreground outline-none ring-ring/30 placeholder:text-muted-foreground focus:border-primary focus:ring-2"
                />
              </label>
            ) : (
              <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="inline-flex w-full max-w-full rounded-xl bg-muted p-1 lg:w-auto">
                  <button
                    type="button"
                    onClick={() => setTab("group")}
                    className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition sm:px-4 lg:flex-none ${
                      tab === "group"
                        ? "bg-surface font-medium text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Users size={17} className="shrink-0" />
                    <span className="truncate">แบบกลุ่ม</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("solo")}
                    className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition sm:px-4 lg:flex-none ${
                      tab === "solo"
                        ? "bg-surface font-medium text-primary shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <UserRound size={17} className="shrink-0" />
                    <span className="truncate">แบบเดี่ยว</span>
                  </button>
                </div>

                <label className="relative min-w-0 w-full lg:max-w-sm lg:flex-1">
                  <span className="sr-only">
                    ค้นหาชื่อผู้เข้าพัก เลขห้อง หรือเลขที่การจอง
                  </span>
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="ค้นหาชื่อ / ห้อง / เลขจอง"
                    className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-foreground outline-none ring-ring/30 placeholder:text-muted-foreground focus:border-primary focus:ring-2"
                  />
                </label>
              </div>
            )
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="รายการจองทั้งหมด"
            value={totalForDate.toLocaleString("th-TH")}
            helper={
              isHistory
                ? "ประวัติเช็กเอาต์และยกเลิก"
                : `ในวันที่ ${formatThaiDate(date)}`
            }
            icon={<CalendarDays size={20} />}
            tone="primary"
          />
          <SummaryCard
            title="เช็กอินวันนี้"
            value={checkedInToday.toLocaleString("th-TH")}
            helper={
              checkedInToday === 0
                ? "ยังไม่มีผู้เข้าพักที่เช็กอินวันนี้"
                : "สถานะเช็กอินของวันนี้"
            }
            icon={<LogIn size={20} />}
            tone="info"
          />
          <SummaryCard
            title="เช็กเอาต์วันนี้"
            value="0"
            helper="ยังไม่มีวันที่เช็กเอาต์ในรายการปัจจุบัน"
            icon={<LogOut size={20} />}
            tone="warning"
          />
          <SummaryCard
            title="ห้องที่ยังว่าง"
            value={availableRooms.toLocaleString("th-TH")}
            helper={`พร้อมใช้สำหรับวันที่ ${formatThaiDate(date)}`}
            icon={<BedDouble size={20} />}
            tone="success"
          />
        </div>

        {loading ? (
          <p className="rounded-3xl border border-border bg-surface p-8 text-center text-muted-foreground shadow-sm">
            กำลังโหลดรายการจอง...
          </p>
        ) : error ? (
          <p
            className="rounded-3xl border border-destructive/20 bg-destructive/10 p-4 text-destructive"
            role="alert"
          >
            {error}
          </p>
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

            {visible.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-surface px-6 py-12 text-center shadow-sm">
                <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                  {isHistory ? <History size={26} /> : <CalendarDays size={26} />}
                </span>
                <h2 className="text-lg font-semibold text-foreground">
                  ยังไม่มีรายการจอง
                </h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  {isHistory
                    ? "ยังไม่มีประวัติการเช็กเอาต์หรือยกเลิก"
                    : query.trim()
                      ? "ไม่พบรายการจองที่ตรงกับคำค้นหา"
                      : "ไม่พบรายการจองสำหรับวันที่เลือก"}
                </p>
                {!isHistory && date !== todayKey ? (
                  <button
                    type="button"
                    onClick={() => setDate(todayKey)}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-muted"
                  >
                    <CalendarDays size={16} />
                    ไปวันที่วันนี้
                  </button>
                ) : null}
              </div>
            ) : null}
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

      {!isHistory ? (
        <button
          type="button"
          onClick={openCreate}
          aria-label="เพิ่มการจอง"
          title="เพิ่มการจอง"
          className="fixed right-[max(1.5rem,env(safe-area-inset-right))] bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-40 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-foreground/20 transition hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-xl active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 sm:size-16"
        >
          <Plus size={28} strokeWidth={2.5} />
        </button>
      ) : null}
    </div>
  );
}
