"use client";

import Image from "next/image";
import {
  CalendarDays,
  CircleUserRound,
  ClipboardCheck,
  DoorOpen,
  LogIn,
  LogOut,
  Pencil,
  ReceiptText,
  ShipWheel,
  Utensils,
  XCircle,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import AddBookingFoodDialog from "@/components/ui/AddBookingFoodDialog";
import BackButton from "@/components/ui/BackButton";
import BillItem from "@/components/ui/BillItem";
import type { ManagedFoodItem } from "@/components/ui/BookingFoodManager";
import ManageBookingResourcesDialog from "@/components/ui/ManageBookingResourcesDialog";
import PayButton from "@/components/ui/PayButton";
import PricingToggle from "@/components/ui/PricingToggle";
import Status from "@/components/ui/Status";
import { formatThaiDateRange } from "@/lib/format/date";

interface Item {
  id: string;
  type: string;
  title: string;
  price: number;
}

interface Detail {
  id: string;
  reference: string;
  statusLabel: string;
  status: string;
  mode: "group" | "solo";
  jobClosed: boolean;
  customerName: string;
  contactName?: string;
  phone: string;
  checkIn: string;
  checkOut: string;
  rooms: Array<{
    id: string;
    number: string;
    zone: string;
    roomType: string;
    rate: number;
    isExtra: boolean;
    inspectionStatus?: string | null;
  }>;
  rafts: Array<{
    id: string;
    name: string;
    capacity: number;
    rate: number;
    isExtra: boolean;
  }>;
  charges: Item[];
  orders: ManagedFoodItem[];
  payments: Item[];
  totals: { grand: number; paid: number; outstanding: number };
  allowedStatuses: string[];
  housekeepingReady: boolean;
}

const actionLabels: Record<string, string> = {
  CHECKED_IN: "เช็กอิน",
  CHECKED_OUT: "เช็กเอาต์",
  CANCELLED: "ยกเลิกการจอง",
};

const actionIcons: Record<string, typeof LogIn> = {
  CHECKED_IN: LogIn,
  CHECKED_OUT: LogOut,
  CANCELLED: XCircle,
};

export default function BookingDetailPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [pricingBusy, setPricingBusy] = useState<string | null>(null);
  const [openManageResources, setOpenManageResources] = useState(false);
  const [openManageFood, setOpenManageFood] = useState(false);

  const canManageItems = !["CHECKED_OUT", "CANCELLED"].includes(
    data?.status ?? "",
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as Detail & { message?: string };
      if (!response.ok) throw new Error(result.message);
      setData(result);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "โหลดข้อมูลไม่สำเร็จ",
      );
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateStatus = async (status: string) => {
    if (
      status === "CHECKED_OUT" &&
      !window.confirm(
        "ยืนยันเช็กเอาต์? ห้องทั้งหมดจะถูกส่งให้แม่บ้านและเปลี่ยนเป็นสถานะรอตรวจห้อง",
      )
    ) {
      return;
    }
    setUpdating(true);
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "เปลี่ยนสถานะไม่สำเร็จ",
      );
    } finally {
      setUpdating(false);
    }
  };

  const confirmPayment = async (
    amount: number,
    method: string,
    channelId: string,
  ) => {
    const response = await fetch(`/api/bookings/${bookingId}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, method, channelId }),
    });
    const result = (await response.json()) as { message?: string };
    if (!response.ok) throw new Error(result.message);
    await load();
  };

  const confirmRefund = async (
    amount: number,
    _method: string,
    channelId: string,
  ) => {
    const response = await fetch(`/api/bookings/${bookingId}/refunds`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, channelId }),
    });
    const result = (await response.json()) as { message?: string };
    if (!response.ok) throw new Error(result.message);
    await load();
  };

  const closeJob = async () => {
    if (!window.confirm("ยืนยันปิดงาน? รายการนี้จะถูกนำออกจากหน้าแม่บ้าน")) {
      return;
    }
    setUpdating(true);
    setError("");
    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closeJob: true }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "ปิดงานไม่สำเร็จ");
    } finally {
      setUpdating(false);
    }
  };

  const syncResources = async (
    rooms: Array<{ id: string; isExtra: boolean }>,
    rafts: Array<{ id: string; isExtra: boolean }>,
    busyKey: string,
  ) => {
    setPricingBusy(busyKey);
    setError("");
    try {
      const response = await fetch(`/api/bookings/${bookingId}/resources`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rooms, rafts }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "อัปเดตการคิดเงินไม่สำเร็จ",
      );
    } finally {
      setPricingBusy(null);
    }
  };

  const setRoomExtra = async (roomId: string, isExtra: boolean) => {
    if (!data) return;
    await syncResources(
      data.rooms.map((room) => ({
        id: room.id,
        isExtra: room.id === roomId ? isExtra : room.isExtra,
      })),
      data.rafts.map((raft) => ({ id: raft.id, isExtra: raft.isExtra })),
      `room:${roomId}`,
    );
  };

  const setRaftExtra = async (raftId: string, isExtra: boolean) => {
    if (!data) return;
    await syncResources(
      data.rooms.map((room) => ({ id: room.id, isExtra: room.isExtra })),
      data.rafts.map((raft) => ({
        id: raft.id,
        isExtra: raft.id === raftId ? isExtra : raft.isExtra,
      })),
      `raft:${raftId}`,
    );
  };

  const setFoodExtra = async (itemId: string, isExtra: boolean) => {
    setPricingBusy(`food:${itemId}`);
    setError("");
    try {
      const response = await fetch(`/api/order-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isExtra }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "อัปเดตการคิดเงินอาหารไม่สำเร็จ",
      );
    } finally {
      setPricingBusy(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">
        กำลังโหลด...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8">
        <BackButton route="/booking" />
        <p className="mt-5 text-destructive">{error}</p>
      </div>
    );
  }

  const isGroup = data.mode === "group";
  const food = data.orders.filter((item) => !item.isMinibar);
  const minibar = data.orders.filter((item) => item.isMinibar);
  const primaryStatuses = data.allowedStatuses.filter(
    (status) => status !== "CANCELLED",
  );
  const canCancel = data.allowedStatuses.includes("CANCELLED");

  const billItems = [
    ...data.charges.map((item) => ({
      id: item.id,
      title: item.title,
      price: item.price,
    })),
    ...food.map((item) => ({
      id: item.id,
      title: `${item.productName} x ${item.quantity}`,
      price: item.price,
    })),
    ...minibar.map((item) => ({
      id: item.id,
      title: `${item.productName} x ${item.quantity}`,
      price: item.price,
    })),
  ].filter((item) => item.price !== 0);

  return (
    <>
      <div className="min-h-screen bg-muted pb-8">
        <div className="relative h-56 overflow-hidden">
          <Image
            fill
            src="/images/room/room1.jpg"
            alt="การจอง"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-foreground/45" />
          <BackButton
            classProps="absolute left-4 top-4 z-10"
            route="/booking"
          />
          <div className="absolute bottom-5 left-5 text-surface">
            <p className="text-sm text-surface/70">{data.reference}</p>
            <h1 className="text-2xl font-semibold">{data.customerName}</h1>
          </div>
        </div>

        <div className="relative z-10 mx-auto -mt-3 max-w-3xl space-y-3 px-4">
          <section className="rounded-2xl bg-surface p-5 shadow-sm">
            <div className="flex justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/15 text-primary">
                  <CircleUserRound />
                </span>
                <div>
                  <h2 className="font-semibold">{data.customerName}</h2>
                  <p className="text-sm text-muted-foreground">{data.phone}</p>
                </div>
              </div>
              <Status status={data.statusLabel} />
            </div>

            <p className="mt-4 flex items-center gap-2 border-t border-border pt-4 text-sm">
              <CalendarDays size={17} />
              {formatThaiDateRange(data.checkIn, data.checkOut)}
            </p>

            <div className="mt-4 space-y-4 border-t border-border pt-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    <DoorOpen size={16} />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      ห้องพัก
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {data.rooms.length} ห้อง
                    </p>
                  </div>
                </div>
                {data.rooms.length === 0 ? (
                  <p className="rounded-xl bg-background px-3 py-2.5 text-sm text-muted-foreground">
                    ยังไม่มีห้องพัก
                  </p>
                ) : (
                  data.rooms.map((room) => (
                    <div
                      key={room.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          ห้อง {room.number}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {room.zone} · {room.roomType} · ฿
                          {room.rate.toLocaleString()}/คืน
                          {data.status === "CHECKED_OUT"
                            ? room.inspectionStatus === "COMPLETED"
                              ? " · ตรวจสอบเสร็จแล้ว"
                              : " · รอตรวจสอบห้อง"
                            : ""}
                        </p>
                      </div>
                      {isGroup && canManageItems ? (
                        <PricingToggle
                          value={room.isExtra}
                          disabled={pricingBusy === `room:${room.id}`}
                          onChange={(isExtra) =>
                            void setRoomExtra(room.id, isExtra)
                          }
                        />
                      ) : isGroup ? (
                        <span
                          className={`text-xs ${room.isExtra ? "text-warning" : "text-success"}`}
                        >
                          {room.isExtra ? "คิดเพิ่ม" : "รวมในเหมา"}
                        </span>
                      ) : null}
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    <ShipWheel size={16} />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      แพ
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {data.rafts.length} แพ
                    </p>
                  </div>
                </div>
                {data.rafts.length === 0 ? (
                  <p className="rounded-xl bg-background px-3 py-2.5 text-sm text-muted-foreground">
                    ยังไม่มีแพ
                  </p>
                ) : (
                  data.rafts.map((raft) => (
                    <div
                      key={raft.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {raft.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {raft.capacity} คน · ฿{raft.rate.toLocaleString()}/คืน
                        </p>
                      </div>
                      {isGroup && canManageItems ? (
                        <PricingToggle
                          value={raft.isExtra}
                          disabled={pricingBusy === `raft:${raft.id}`}
                          onChange={(isExtra) =>
                            void setRaftExtra(raft.id, isExtra)
                          }
                        />
                      ) : isGroup ? (
                        <span
                          className={`text-xs ${raft.isExtra ? "text-warning" : "text-success"}`}
                        >
                          {raft.isExtra ? "คิดเพิ่ม" : "รวมในเหมา"}
                        </span>
                      ) : null}
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Utensils size={16} />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      อาหาร
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {food.length} รายการ
                    </p>
                  </div>
                </div>
                {food.length === 0 ? (
                  <p className="rounded-xl bg-background px-3 py-2.5 text-sm text-muted-foreground">
                    ยังไม่มีรายการอาหาร
                  </p>
                ) : (
                  food.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {item.productName} x {item.quantity}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ฿{item.unitPrice.toLocaleString()} / ชิ้น
                          {isGroup
                            ? item.chargeTo === "room" && item.roomNumber
                              ? ` · สั่งห้อง ${item.roomNumber}`
                              : " · สั่งลงบิลกรุ๊ป"
                            : ""}
                          {!item.editable
                            ? " · ครัวรับแล้ว แก้ราคาเหมาไม่ได้"
                            : ""}
                        </p>
                      </div>
                      {isGroup && canManageItems && item.editable ? (
                        <PricingToggle
                          value={item.isExtra}
                          disabled={pricingBusy === `food:${item.id}`}
                          onChange={(isExtra) =>
                            void setFoodExtra(item.id, isExtra)
                          }
                        />
                      ) : isGroup ? (
                        <span
                          className={`text-xs ${item.isExtra ? "text-warning" : "text-success"}`}
                        >
                          {item.isExtra ? "คิดเพิ่ม" : "รวมในเหมา"}
                        </span>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <div className="flex flex-wrap gap-2">
                {canManageItems ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setOpenManageResources(true)}
                      className="inline-flex items-center gap-2 rounded-xl border border-secondary/30 px-4 py-2 text-sm text-secondary"
                    >
                      <Pencil size={17} />
                      จัดการห้องและแพ
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenManageFood(true)}
                      className="inline-flex items-center gap-2 rounded-xl border border-secondary/30 px-4 py-2 text-sm text-secondary"
                    >
                      <Utensils size={17} />
                      จัดการรายการอาหาร
                    </button>
                  </>
                ) : null}
                {primaryStatuses.map((status) => {
                  const Icon = actionIcons[status];
                  return (
                    <button
                      key={status}
                      type="button"
                      disabled={updating}
                      onClick={() => updateStatus(status)}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground"
                    >
                      {Icon ? <Icon size={17} /> : null}
                      {actionLabels[status] ?? status}
                    </button>
                  );
                })}
                {data.status === "CHECKED_OUT" && !data.jobClosed ? (
                  <button
                    type="button"
                    disabled={updating || !data.housekeepingReady}
                    onClick={closeJob}
                    className="inline-flex items-center gap-2 rounded-xl bg-success px-4 py-2 text-sm text-success-foreground disabled:bg-muted-foreground/40"
                  >
                    <ClipboardCheck size={17} />
                    {data.housekeepingReady ? "ปิดงาน" : "รอตรวจครบทุกห้อง"}
                  </button>
                ) : null}
                {data.jobClosed ? (
                  <span className="inline-flex items-center gap-2 rounded-xl bg-success/10 px-4 py-2 text-sm text-success">
                    <ClipboardCheck size={17} />
                    ปิดงานแล้ว
                  </span>
                ) : null}
              </div>

              {canCancel ? (
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => updateStatus("CANCELLED")}
                  className="ml-auto inline-flex items-center gap-2 rounded-xl border border-destructive/30 px-4 py-2 text-sm text-destructive"
                >
                  <XCircle size={17} />
                  ยกเลิกการจอง
                </button>
              ) : null}
            </div>

            {error ? (
              <p className="mt-3 text-sm text-destructive">{error}</p>
            ) : null}
          </section>

          <BillItem
            title="สรุปค่าใช้จ่ายทั้งหมด"
            icon={<ReceiptText size={22} />}
            items={billItems}
            isEdit={false}
            defaultOpen
            showLinesTotal={false}
            headerAmount={data.totals.grand}
            footer={
              <div className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">ราคารวม</span>
                    <span className="font-semibold text-foreground">
                      ฿{data.totals.grand.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">ชำระแล้ว</span>
                    <span className="font-semibold text-success">
                      ฿{data.totals.paid.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">คงเหลือ</span>
                    <span className="font-semibold text-warning">
                      ฿{data.totals.outstanding.toLocaleString()}
                    </span>
                  </div>
                </div>
                {data.status === "CANCELLED"
                  ? data.totals.paid > 0 && (
                      <PayButton
                        amount={data.totals.paid}
                        mode="refund"
                        onConfirm={confirmRefund}
                      />
                    )
                  : data.totals.outstanding > 0 && (
                      <PayButton
                        amount={data.totals.outstanding}
                        onConfirm={confirmPayment}
                      />
                    )}
              </div>
            }
          />
        </div>
      </div>

      <ManageBookingResourcesDialog
        open={openManageResources}
        setOpen={setOpenManageResources}
        bookingId={bookingId}
        checkIn={data.checkIn}
        checkOut={data.checkOut}
        mode={data.mode}
        initialRooms={data.rooms.map((room) => ({
          id: room.id,
          label: room.number,
          rate: room.rate,
          isExtra: room.isExtra,
        }))}
        initialRafts={data.rafts.map((raft) => ({
          id: raft.id,
          label: raft.name,
          rate: raft.rate,
          isExtra: raft.isExtra,
        }))}
        onSaved={() => void load()}
      />
      <AddBookingFoodDialog
        open={openManageFood}
        setOpen={setOpenManageFood}
        bookingId={bookingId}
        mode={data.mode}
        rooms={data.rooms.map((room) => ({
          id: room.id,
          number: room.number,
        }))}
        onAdded={() => void load()}
      />
    </>
  );
}
