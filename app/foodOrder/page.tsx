"use client";

import { UserRound, Users, Utensils } from "lucide-react";
import { useEffect, useState } from "react";

import DateSelector from "@/components/ui/DateSelector";
import OrderGroupItem from "@/components/ui/OrderGroupItem";
import OrderItem from "@/components/ui/OrderItem";
import { PageHeader } from "@/components/ui/PageHeader";

interface BookingCustomer {
  id: string;
  mode: "solo" | "group";
  customerName: string;
  status: string;
  rooms: Array<{ name: string; image: string }>;
}

export default function FoodOrderPage() {
  const [tab, setTab] = useState<"group" | "solo">("group");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [bookings, setBookings] = useState<BookingCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/bookings?date=${date}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as
          | BookingCustomer[]
          | { message: string };
        if (!response.ok || !Array.isArray(data)) {
          throw new Error(
            "message" in data ? data.message : "โหลดลูกค้าไม่สำเร็จ",
          );
        }
        setBookings(data);
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : "โหลดลูกค้าไม่สำเร็จ",
        );
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [date]);

  const visible = bookings.filter((booking) => booking.mode === tab);
  const roomLabel = (booking: BookingCustomer) =>
    booking.rooms.map((room) => room.name).join(", ") || "ยังไม่มีห้อง";

  return (
    <div className="min-h-screen bg-muted p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          icon={<Utensils size={24} />}
          eyebrow="งานประจำวัน"
          title="สั่งอาหาร"
          description="เลือกลูกค้าที่เข้าพักในวันที่กำหนด แล้วจึงเลือกรายการอาหาร"
          actions={
            <DateSelector
              date={date}
              setDate={setDate}
              className="w-full lg:w-auto"
            />
          }
          toolbar={
            <div className="inline-flex rounded-xl bg-border/70 p-1">
              <button
                type="button"
                onClick={() => setTab("group")}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm ${
                  tab === "group"
                    ? "bg-surface text-primary shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                <Users size={17} />
                แบบกลุ่ม
              </button>
              <button
                type="button"
                onClick={() => setTab("solo")}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm ${
                  tab === "solo"
                    ? "bg-surface text-primary shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                <UserRound size={17} />
                แบบเดี่ยว
              </button>
            </div>
          }
        />

        {loading ? (
          <p className="rounded-2xl bg-surface p-8 text-center text-muted-foreground">
            กำลังโหลดรายชื่อลูกค้า...
          </p>
        ) : error ? (
          <p className="rounded-2xl bg-destructive/10 p-4 text-destructive">
            {error}
          </p>
        ) : (
          <div className="space-y-3">
            {visible.map((booking, index) =>
              booking.mode === "group" ? (
                <OrderGroupItem
                  key={booking.id}
                  id={booking.id}
                  customerName={booking.customerName}
                  subtitle={`${roomLabel(booking)} · ${booking.status}`}
                />
              ) : (
                <OrderItem
                  key={booking.id}
                  id={booking.id}
                  name={booking.customerName}
                  subtitle={`${roomLabel(booking)} · ${booking.status}`}
                  image={
                    booking.rooms[0]?.image ??
                    `/images/room/room${(index % 4) + 1}.jpg`
                  }
                />
              ),
            )}
            {visible.length === 0 ? (
              <p className="rounded-2xl bg-surface p-8 text-center text-muted-foreground">
                ไม่มีลูกค้าในวันที่เลือก
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
