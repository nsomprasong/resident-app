"use client";

import Image from "next/image";
import { DoorOpen, Save, Trash2, UsersRound } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import BackButton from "@/components/ui/BackButton";
import { useBasketList } from "@/hooks/useBasketList";

type BookingRoom = {
  id: string;
  number: string;
};

type BookingInfo = {
  customerName: string;
  mode: "solo" | "group";
  rooms: BookingRoom[];
};

export default function BasketPage() {
  const { roomId: bookingId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const { basketList, removeFromBasket, setBasketList } = useBasketList();
  const total = basketList.reduce((sum, item) => sum + item.price, 0);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  /** null = group bill; room id = charge to that room */
  const [chargeRoomId, setChargeRoomId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`/api/bookings/${bookingId}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as {
          customerName: string;
          mode: "solo" | "group";
          rooms: BookingRoom[];
        };
        setBooking({
          customerName: data.customerName,
          mode: data.mode,
          rooms: data.rooms,
        });
        if (data.mode === "solo") {
          setChargeRoomId(data.rooms[0]?.id ?? null);
        } else {
          setChargeRoomId(null);
        }
      } catch {
        /* keep fallback */
      }
    };
    void load();
  }, [bookingId]);

  const confirm = async () => {
    if (!basketList.length) return;
    if (booking?.mode === "group" && chargeRoomId === undefined) {
      setError("กรุณาเลือกห้องหรือบิลกรุ๊ป");
      return;
    }
    if (
      booking?.mode === "group" &&
      chargeRoomId &&
      !booking.rooms.some((room) => room.id === chargeRoomId)
    ) {
      setError("ห้องที่เลือกไม่ถูกต้อง");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          roomId: chargeRoomId,
          items: basketList.map((item) => ({
            productId: item.productId,
            note: item.reason,
            isExtra: true,
          })),
        }),
      });
      const data = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(data.message);
      setBasketList([]);
      router.push("/foodOrder");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "บันทึกออเดอร์ไม่สำเร็จ",
      );
    } finally {
      setSaving(false);
    }
  };

  const customer = booking?.customerName ?? "ลูกค้า";
  const isGroup = booking?.mode === "group";

  return (
    <div className="min-h-screen bg-muted">
      <header className="flex h-16 items-center gap-3 bg-primary px-4 text-primary-foreground shadow">
        <BackButton route={`/foodOrder/${bookingId}/food`} />
        <div>
          <p className="text-xs text-primary-foreground/70">{customer}</p>
          <h1 className="font-semibold">ตะกร้ารายการอาหาร</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-3 p-4 sm:p-6">
        {isGroup ? (
          <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground">
              สั่งให้ใคร / ลงบิลไหน
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              เลือกได้ว่าสั่งลงบิลกรุ๊ป หรือแยกตามห้อง เพื่อแจงรายละเอียดตอนตรวจบิล
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setChargeRoomId(null)}
                className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                  chargeRoomId === null
                    ? "border-success/40 bg-success/10 text-success"
                    : "border-border bg-background text-foreground hover:border-primary/40"
                }`}
              >
                <UsersRound size={20} className="shrink-0" />
                <span>
                  <span className="block text-sm font-medium">ลงบิลกรุ๊ป</span>
                  <span className="block text-xs opacity-80">
                    รวมในบิลกลุ่มทัวร์
                  </span>
                </span>
              </button>
              {booking?.rooms.map((room) => (
                <button
                  type="button"
                  key={room.id}
                  onClick={() => setChargeRoomId(room.id)}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                    chargeRoomId === room.id
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-border bg-background text-foreground hover:border-primary/40"
                  }`}
                >
                  <DoorOpen size={20} className="shrink-0" />
                  <span>
                    <span className="block text-sm font-medium">
                      ห้อง {room.number}
                    </span>
                    <span className="block text-xs opacity-80">
                      สั่งแยกห้องนี้
                    </span>
                  </span>
                </button>
              ))}
            </div>
            {booking && booking.rooms.length === 0 ? (
              <p className="mt-3 text-sm text-warning">
                การจองนี้ยังไม่มีห้อง — จะลงบิลกรุ๊ปเท่านั้น
              </p>
            ) : null}
          </section>
        ) : null}

        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
          <div className="border-b border-border p-4">
            <h2 className="font-medium">สรุปคำสั่งซื้อ</h2>
            <p className="text-sm text-muted-foreground">
              {basketList.length} รายการ
              {isGroup
                ? chargeRoomId
                  ? ` · ห้อง ${booking?.rooms.find((room) => room.id === chargeRoomId)?.number ?? ""}`
                  : " · บิลกรุ๊ป"
                : ""}
            </p>
          </div>

          {basketList.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              ยังไม่มีรายการในตะกร้า
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {basketList.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Image
                      src={item.image}
                      alt={item.alt}
                      width={56}
                      height={56}
                      className="h-14 w-14 rounded-xl object-cover"
                    />
                    <div className="min-w-0">
                      <p className="font-medium">{item.title}</p>
                      {item.reason ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {item.reason}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm">฿{item.price}</span>
                    <button
                      type="button"
                      aria-label={`ลบ ${item.title}`}
                      onClick={() => removeFromBasket(item.id)}
                      className="rounded-lg p-2 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-border bg-background p-4">
            <div className="mb-4 flex justify-between text-lg font-semibold">
              <span>ราคารวม</span>
              <span>฿{total.toLocaleString()}</span>
            </div>
            {error ? (
              <p className="mb-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              disabled={!basketList.length || saving}
              onClick={() => void confirm()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted-foreground/40"
            >
              <Save size={18} />
              {saving ? "กำลังบันทึกออเดอร์..." : "ยืนยันรายการอาหาร"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
