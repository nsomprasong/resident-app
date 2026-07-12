"use client";
import Image from "next/image";
import {
  CalendarDays,
  CircleUserRound,
  ClipboardCheck,
  DoorOpen,
  Plus,
  ReceiptText,
  Refrigerator,
  ShipWheel,
  Utensils,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import AddBookingResourcesDialog from "@/components/ui/AddBookingResourcesDialog";
import BackButton from "@/components/ui/BackButton";
import BillItem from "@/components/ui/BillItem";
import PayButton from "@/components/ui/PayButton";
import Status from "@/components/ui/Status";

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
    inspectionStatus?: string | null;
  }>;
  rafts: Array<{ id: string; name: string; capacity: number; rate: number }>;
  charges: Item[];
  orders: Item[];
  payments: Item[];
  totals: { grand: number; paid: number; outstanding: number };
  allowedStatuses: string[];
  housekeepingReady: boolean;
}
const actionLabels: Record<string, string> = {
  CONFIRMED: "ยืนยันการจอง",
  CHECKED_IN: "เช็กอิน",
  CHECKED_OUT: "เช็กเอาต์",
  CANCELLED: "ยกเลิกการจอง",
};

export default function BookingDetailPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [openAdd, setOpenAdd] = useState(false);
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
    )
      return;
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
    if (!window.confirm("ยืนยันปิดงาน? รายการนี้จะถูกนำออกจากหน้าแม่บ้าน"))
      return;
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
  if (loading && !data)
    return (
      <div className="grid min-h-screen place-items-center text-slate-500">
        กำลังโหลด...
      </div>
    );
  if (!data)
    return (
      <div className="p-8">
        <BackButton route="/booking" />
        <p className="mt-5 text-red-600">{error}</p>
      </div>
    );
  const food = data.orders.filter((item) => item.type === "FOOD");
  const minibar = data.orders.filter((item) => item.type === "MINIBAR");
  return (
    <>
      <div className="min-h-screen bg-slate-100 pb-8">
        <div className="relative h-56 overflow-hidden">
          <Image
            fill
            src="/images/room/room1.jpg"
            alt="การจอง"
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-slate-950/45" />
          <BackButton
            classProps="absolute left-4 top-4 z-10"
            route="/booking"
          />
          <div className="absolute bottom-5 left-5 text-white">
            <p className="text-sm text-white/70">{data.reference}</p>
            <h1 className="text-2xl font-semibold">{data.customerName}</h1>
          </div>
        </div>
        <div className="relative z-10 mx-auto -mt-3 max-w-3xl space-y-3 px-4">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-indigo-100 text-indigo-600">
                  <CircleUserRound />
                </span>
                <div>
                  <h2 className="font-semibold">{data.customerName}</h2>
                  <p className="text-sm text-slate-500">{data.phone}</p>
                </div>
              </div>
              <Status status={data.statusLabel} />
            </div>
            <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <p className="flex items-center gap-2 text-sm">
                <CalendarDays size={17} />
                {data.checkIn} ถึง {data.checkOut}
              </p>
              <div className="flex items-start gap-2 text-sm">
                <DoorOpen size={17} className="mt-1 shrink-0" />
                <div className="flex flex-wrap gap-2">
                  {data.rooms.length ? (
                    data.rooms.map((room) => (
                      <span
                        key={room.id}
                        className="rounded-full bg-slate-100 px-2.5 py-1"
                      >
                        ห้อง {room.number}
                        {data.status === "CHECKED_OUT" && (
                          <span
                            className={
                              room.inspectionStatus === "COMPLETED"
                                ? "text-emerald-700"
                                : "text-amber-700"
                            }
                          >
                            {" "}
                            ·{" "}
                            {room.inspectionStatus === "COMPLETED"
                              ? "ตรวจสอบเสร็จแล้ว"
                              : "รอตรวจสอบห้อง"}
                          </span>
                        )}
                      </span>
                    ))
                  ) : (
                    <span>ยังไม่มีห้อง</span>
                  )}
                </div>
              </div>
              <p className="flex items-center gap-2 text-sm sm:col-span-2">
                <ShipWheel size={17} />
                {data.rafts.length
                  ? data.rafts.map((raft) => raft.name).join(", ")
                  : "ยังไม่มีแพ"}
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {!["CHECKED_OUT", "CANCELLED"].includes(data.status) && (
                <button
                  onClick={() => setOpenAdd(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 px-4 py-2 text-sm text-indigo-700"
                >
                  <Plus size={17} />
                  เพิ่มห้องหรือแพ
                </button>
              )}
              {data.allowedStatuses.map((status) => (
                <button
                  key={status}
                  disabled={updating}
                  onClick={() => updateStatus(status)}
                  className={`rounded-xl px-4 py-2 text-sm ${status === "CANCELLED" ? "border border-red-200 text-red-600" : "bg-indigo-600 text-white"}`}
                >
                  {actionLabels[status]}
                </button>
              ))}
              {data.status === "CHECKED_OUT" && !data.jobClosed && (
                <button
                  disabled={updating || !data.housekeepingReady}
                  onClick={closeJob}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm text-white disabled:bg-slate-300"
                >
                  <ClipboardCheck size={17} />
                  {data.housekeepingReady ? "ปิดงาน" : "รอตรวจครบทุกห้อง"}
                </button>
              )}
              {data.jobClosed && (
                <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                  <ClipboardCheck size={17} />
                  ปิดงานแล้ว
                </span>
              )}
            </div>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </section>
          <BillItem
            title="ค่าห้อง แพ และค่าใช้จ่าย"
            icon={<ReceiptText size={22} />}
            items={data.charges}
            isEdit={false}
          />
          {food.length > 0 && (
            <BillItem
              title="ค่าอาหาร"
              icon={<Utensils size={22} />}
              items={food}
              isEdit={false}
            />
          )}
          {minibar.length > 0 && (
            <BillItem
              title="ค่ามินิบาร์"
              icon={<Refrigerator size={22} />}
              items={minibar}
              isEdit={false}
            />
          )}
          {data.payments.length > 0 && (
            <BillItem
              title="ประวัติการรับเงิน"
              icon={<ReceiptText size={22} />}
              items={data.payments}
              isEdit={false}
            />
          )}
          <section className="rounded-2xl bg-slate-900 p-5 text-white">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-slate-400">ยอดรวม</p>
                <p className="text-xl">฿{data.totals.grand.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">ชำระแล้ว</p>
                <p className="text-xl text-emerald-400">
                  ฿{data.totals.paid.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">คงเหลือ</p>
                <p className="text-xl text-amber-400">
                  ฿{data.totals.outstanding.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
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
          </section>
        </div>
      </div>
      <AddBookingResourcesDialog
        open={openAdd}
        setOpen={setOpenAdd}
        bookingId={bookingId}
        checkIn={data.checkIn}
        checkOut={data.checkOut}
        onAdded={() => void load()}
      />
    </>
  );
}
