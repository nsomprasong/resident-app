"use client";

import {
  BedDouble,
  CalendarDays,
  ClipboardCheck,
  DoorOpen,
  LogIn,
  LogOut,
  Package,
  Pencil,
  PlusCircle,
  Receipt,
  ReceiptText,
  ShipWheel,
  Users,
  Utensils,
  XCircle,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { PermissionGate } from "@/components/auth/PermissionGate";
import { useEmployeePermissions } from "@/components/auth/EmployeePermissionsProvider";
import AddBookingChargesDialog from "@/components/ui/AddBookingChargesDialog";
import AddBookingFoodDialog from "@/components/ui/AddBookingFoodDialog";
import BackButton from "@/components/ui/BackButton";
import BillItem from "@/components/ui/BillItem";
import type { ManagedFoodItem } from "@/components/ui/BookingFoodManager";
import EditBookingInspectionDialog, {
  type EditableInspectionItem,
} from "@/components/ui/EditBookingInspectionDialog";
import EditGroupPackageDialog from "@/components/ui/EditGroupPackageDialog";
import ManageBookingResourcesDialog from "@/components/ui/ManageBookingResourcesDialog";
import PayButton from "@/components/ui/PayButton";
import { PageHeader } from "@/components/ui/PageHeader";
import Status from "@/components/ui/Status";
import { BookingPromptPaySection } from "@/components/ui/BookingPromptPaySection";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { formatThaiDateRange } from "@/lib/format/date";

type InspectionItemType =
  | "MINIBAR"
  | "DAMAGE"
  | "STAIN"
  | "MISSING"
  | "OTHER";

interface InspectionChargeItem {
  id: string;
  catalogId?: string | null;
  type: InspectionItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  imageUrl?: string | null;
}

interface Item {
  id: string;
  type: string;
  title: string;
  price: number;
  inspectionId?: string | null;
  inspectionNotes?: string | null;
  inspectionRoom?: string | null;
  inspectionItems?: InspectionChargeItem[] | null;
}

interface Detail {
  id: string;
  reference: string;
  statusLabel: string;
  status: string;
  mode: "group" | "solo";
  tourGroupId?: string | null;
  guestCount?: number | null;
  pricePerPerson?: number | null;
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
    inspectionCompletedAt?: string | null;
    inspectionCompletedByName?: string | null;
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

export default function BookingDetailPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { can } = useEmployeePermissions();
  const canLifecycle = can("booking.lifecycle");
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [pricingBusy, setPricingBusy] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [openManageResources, setOpenManageResources] = useState(false);
  const [openManageFood, setOpenManageFood] = useState(false);
  const [openManageCharges, setOpenManageCharges] = useState(false);
  const [openEditPackage, setOpenEditPackage] = useState(false);
  const [editInspection, setEditInspection] = useState<{
    inspectionId: string;
    roomLabel: string;
    notes: string | null;
    items: EditableInspectionItem[];
  } | null>(null);

  const canManageItems = !["CHECKED_OUT", "CANCELLED"].includes(
    data?.status ?? "",
  );
  const canEditInspection =
    can("inspection.write") && Boolean(data) && !data?.jobClosed;
  const canResourcePricing = can("resource.manage");
  const canOrderPricing = can("order.write");
  const canBulkPricing = canResourcePricing || canOrderPricing;

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
      !(await confirm({
        title: "ยืนยันเช็กเอาต์?",
        description:
          "ห้องทั้งหมดจะถูกส่งให้แม่บ้านและเปลี่ยนเป็นสถานะรอตรวจห้อง",
        confirmLabel: "เช็กเอาต์",
        tone: "warning",
      }))
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
    if (
      !(await confirm({
        title: "ยืนยันปิดงาน?",
        description: "รายการนี้จะถูกนำออกจากหน้าแม่บ้าน",
        confirmLabel: "ปิดงาน",
        tone: "warning",
      }))
    ) {
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

  const toggleSelected = (key: string) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const applyPricing = async (payload: {
    rooms?: Array<{ id: string; isExtra: boolean }>;
    rafts?: Array<{ id: string; isExtra: boolean }>;
    orderItems?: Array<{ id: string; isExtra: boolean }>;
  }) => {
    if (!data) return;
    const previous = data;
    setPricingBusy(true);
    setError("");

    setData((current) => {
      if (!current) return current;
      const roomMap = new Map(
        (payload.rooms ?? []).map((item) => [item.id, item.isExtra]),
      );
      const raftMap = new Map(
        (payload.rafts ?? []).map((item) => [item.id, item.isExtra]),
      );
      const foodMap = new Map(
        (payload.orderItems ?? []).map((item) => [item.id, item.isExtra]),
      );
      return {
        ...current,
        rooms: current.rooms.map((room) =>
          roomMap.has(room.id)
            ? { ...room, isExtra: roomMap.get(room.id)! }
            : room,
        ),
        rafts: current.rafts.map((raft) =>
          raftMap.has(raft.id)
            ? { ...raft, isExtra: raftMap.get(raft.id)! }
            : raft,
        ),
        orders: current.orders.map((item) => {
          if (!foodMap.has(item.id)) return item;
          const isExtra = foodMap.get(item.id)!;
          return {
            ...item,
            isExtra,
            price: isExtra ? item.unitPrice * item.quantity : 0,
          };
        }),
      };
    });

    try {
      const response = await fetch(`/api/bookings/${bookingId}/pricing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        message?: string;
        charges?: Item[];
        totals?: Detail["totals"];
        orderItems?: Array<{ id: string; isExtra: boolean; price: number }>;
      };
      if (!response.ok) throw new Error(result.message);

      setData((current) => {
        if (!current) return current;
        const foodMap = new Map(
          (result.orderItems ?? []).map((item) => [item.id, item]),
        );
        return {
          ...current,
          charges: result.charges ?? current.charges,
          totals: result.totals ?? current.totals,
          orders: current.orders.map((item) => {
            const updated = foodMap.get(item.id);
            if (!updated) return item;
            return {
              ...item,
              isExtra: updated.isExtra,
              price: updated.price,
            };
          }),
        };
      });
      const clearedKeys = [
        ...(payload.rooms ?? []).map((item) => `room:${item.id}`),
        ...(payload.rafts ?? []).map((item) => `raft:${item.id}`),
        ...(payload.orderItems ?? []).map((item) => `food:${item.id}`),
      ];
      if (clearedKeys.length) {
        setSelectedKeys((current) => {
          const next = new Set(current);
          for (const key of clearedKeys) next.delete(key);
          return next;
        });
      }
    } catch (reason) {
      setData(previous);
      setError(
        reason instanceof Error ? reason.message : "อัปเดตการคิดเงินไม่สำเร็จ",
      );
    } finally {
      setPricingBusy(false);
    }
  };

  const applySelectedRoomPricing = async (isExtra: boolean) => {
    if (!data) return;
    const rooms = data.rooms
      .filter((room) => selectedKeys.has(`room:${room.id}`))
      .map((room) => ({ id: room.id, isExtra }));
    if (!rooms.length) return;
    await applyPricing({ rooms });
  };

  const applySelectedRaftPricing = async (isExtra: boolean) => {
    if (!data) return;
    const rafts = data.rafts
      .filter((raft) => selectedKeys.has(`raft:${raft.id}`))
      .map((raft) => ({ id: raft.id, isExtra }));
    if (!rafts.length) return;
    await applyPricing({ rafts });
  };

  const applySelectedFoodPricing = async (isExtra: boolean) => {
    if (!data) return;
    const orderItems = data.orders
      .filter(
        (item) =>
          !item.isMinibar &&
          item.editable &&
          selectedKeys.has(`food:${item.id}`),
      )
      .map((item) => ({ id: item.id, isExtra }));
    if (!orderItems.length) return;
    await applyPricing({ orderItems });
  };

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-muted p-4 sm:p-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-muted-foreground">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-muted p-4 sm:p-8">
        <div className="mx-auto max-w-6xl space-y-4">
          <BackButton route="/booking" />
          <p className="text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  const isGroup = data.mode === "group";
  const food = data.orders.filter((item) => !item.isMinibar);
  const minibar = data.orders.filter((item) => item.isMinibar);
  const canCancel = data.allowedStatuses.includes("CANCELLED");
  const canCheckIn = data.allowedStatuses.includes("CHECKED_IN");
  const canCheckOut = data.allowedStatuses.includes("CHECKED_OUT");
  const canCloseJob =
    data.status === "CHECKED_OUT" && !data.jobClosed;
  const showPricingSelect = isGroup && canManageItems && canBulkPricing;
  const selectedRoomCount = data.rooms.filter((room) =>
    selectedKeys.has(`room:${room.id}`),
  ).length;
  const selectedRaftCount = data.rafts.filter((raft) =>
    selectedKeys.has(`raft:${raft.id}`),
  ).length;
  const selectedFoodCount = food.filter(
    (item) => item.editable && selectedKeys.has(`food:${item.id}`),
  ).length;

  const billItems = [
    ...data.charges.flatMap((item) => {
      if (item.inspectionItems?.length && item.inspectionId) {
        const roomLabel = item.inspectionRoom
          ? `ห้อง ${item.inspectionRoom}`
          : "ตรวจห้อง";
        const openEditor = canEditInspection
          ? () =>
              setEditInspection({
                inspectionId: item.inspectionId!,
                roomLabel,
                notes: item.inspectionNotes ?? null,
                items: item.inspectionItems!.map((line) => ({
                  catalogId: line.catalogId,
                  type: line.type,
                  description: line.description,
                  quantity: line.quantity,
                  unitPrice: line.unitPrice,
                  imageUrl: line.imageUrl,
                })),
              })
          : undefined;
        return item.inspectionItems.map((line) => ({
          id: line.id,
          title: `${roomLabel}: ${line.description} × ${line.quantity}`,
          price: line.quantity * line.unitPrice,
          imageUrl: line.imageUrl ?? null,
          onEdit: openEditor,
        }));
      }
      return [
        {
          id: item.id,
          title: item.title,
          price: item.price,
          imageUrl: null as string | null,
          onEdit: undefined,
        },
      ];
    }),
    ...food.map((item) => ({
      id: item.id,
      title: `${item.productName} x ${item.quantity}`,
      price: item.price,
      imageUrl: null as string | null,
      onEdit: undefined,
    })),
    ...minibar.map((item) => ({
      id: item.id,
      title: `${item.productName} x ${item.quantity}`,
      price: item.price,
      imageUrl: null as string | null,
      onEdit: undefined,
    })),
  ].filter((item) => item.price !== 0);

  return (
    <>
      {confirmDialog}
      <div className="min-h-screen bg-muted p-4 pb-8 sm:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <BackButton route="/booking" />
          <PageHeader
            icon={<BedDouble size={24} />}
            eyebrow="งานประจำวัน"
            title={data.customerName}
            description={`${data.reference} · ${formatThaiDateRange(data.checkIn, data.checkOut)}`}
            meta={
              <span>
                {data.phone}
                {data.contactName ? ` · ${data.contactName}` : ""}
              </span>
            }
            actions={
              <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
                {canLifecycle && canCheckIn ? (
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => updateStatus("CHECKED_IN")}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
                  >
                    <LogIn size={17} />
                    เช็กอิน
                  </button>
                ) : null}
                {canLifecycle && canCheckOut ? (
                  <button
                    type="button"
                    disabled={updating}
                    onClick={() => updateStatus("CHECKED_OUT")}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                  >
                    <LogOut size={17} />
                    เช็กเอาต์
                  </button>
                ) : null}
                {canLifecycle && canCloseJob ? (
                  <button
                    type="button"
                    disabled={updating || !data.housekeepingReady}
                    onClick={closeJob}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-muted-foreground/40 disabled:hover:bg-muted-foreground/40"
                  >
                    <ClipboardCheck size={17} />
                    {data.housekeepingReady ? "ปิดงาน" : "รอตรวจครบทุกห้อง"}
                  </button>
                ) : null}
                {data.jobClosed ? (
                  <span className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600/10 px-4 py-2 text-sm font-medium text-emerald-700">
                    <ClipboardCheck size={17} />
                    ปิดงานแล้ว
                  </span>
                ) : null}
                <Status status={data.statusLabel} />
              </div>
            }
          />

          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary">
                <ReceiptText size={22} />
              </span>
              <div>
                <h2 className="font-semibold text-foreground">สรุปรายละเอียด</h2>
                <p className="text-sm text-muted-foreground">
                  ห้องพัก แพ อาหาร และรายการคิดเงิน
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-start justify-between gap-3 border-t border-border pt-4">
              <div className="space-y-3">
                <p className="flex items-center gap-2 text-sm">
                  <CalendarDays size={17} />
                  {formatThaiDateRange(data.checkIn, data.checkOut)}
                </p>
                {isGroup ? (
                  <p className="flex items-center gap-2 text-sm text-foreground">
                    <Users size={17} className="text-primary" />
                    {data.guestCount ?? 0} คน · ราคาต่อหัว ฿
                    {(data.pricePerPerson ?? 0).toLocaleString()} · เหมารวม ฿
                    {(
                      (data.guestCount ?? 0) * (data.pricePerPerson ?? 0)
                    ).toLocaleString()}
                  </p>
                ) : null}
              </div>
              {canManageItems ? (
                <PermissionGate permission="booking.write">
                  <button
                    type="button"
                    onClick={() => setOpenEditPackage(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-secondary/30 px-3 py-1.5 text-sm text-secondary"
                  >
                    <Pencil size={15} />
                    แก้ไข
                  </button>
                </PermissionGate>
              ) : null}
            </div>

            <div className="mt-4 space-y-4 border-t border-border pt-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
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
                        {selectedRoomCount > 0
                          ? ` · เลือก ${selectedRoomCount}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  {showPricingSelect && canResourcePricing ? (
                    <div className="inline-flex rounded-xl bg-muted p-1 text-xs">
                      <button
                        type="button"
                        disabled={pricingBusy || selectedRoomCount === 0}
                        onClick={() => void applySelectedRoomPricing(false)}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-muted-foreground transition hover:bg-surface hover:text-foreground disabled:opacity-40"
                      >
                        <Package size={14} />
                        รวมในเหมา
                      </button>
                      <button
                        type="button"
                        disabled={pricingBusy || selectedRoomCount === 0}
                        onClick={() => void applySelectedRoomPricing(true)}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-muted-foreground transition hover:bg-surface hover:text-foreground disabled:opacity-40"
                      >
                        <PlusCircle size={14} />
                        คิดเพิ่ม
                      </button>
                    </div>
                  ) : null}
                </div>
                {data.rooms.length === 0 ? (
                  <p className="rounded-xl bg-background px-3 py-2.5 text-sm text-muted-foreground">
                    ยังไม่มีห้องพัก
                  </p>
                ) : (
                  data.rooms.map((room) => {
                    const selectKey = `room:${room.id}`;
                    return (
                      <div
                        key={room.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background px-3 py-2.5"
                      >
                        <div className="flex min-w-0 items-start gap-2">
                          {showPricingSelect && canResourcePricing ? (
                            <input
                              type="checkbox"
                              checked={selectedKeys.has(selectKey)}
                              onChange={() => toggleSelected(selectKey)}
                              disabled={pricingBusy}
                              className="mt-1"
                              aria-label={`เลือกห้อง ${room.number}`}
                            />
                          ) : null}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              ห้อง {room.number}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {room.zone} · {room.roomType} · ฿
                              {room.rate.toLocaleString()}/คืน
                              {data.status === "CHECKED_OUT"
                                ? room.inspectionStatus === "COMPLETED"
                                  ? ` · ตรวจสอบเสร็จแล้ว${
                                      room.inspectionCompletedByName
                                        ? ` โดย ${room.inspectionCompletedByName}`
                                        : ""
                                    }`
                                  : " · รอตรวจสอบห้อง"
                                : ""}
                            </p>
                          </div>
                        </div>
                        {isGroup ? (
                          <span
                            className={`text-xs ${room.isExtra ? "text-warning" : "text-success"}`}
                          >
                            {room.isExtra ? "คิดเพิ่ม" : "รวมในเหมา"}
                          </span>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
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
                        {selectedRaftCount > 0
                          ? ` · เลือก ${selectedRaftCount}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  {showPricingSelect && canResourcePricing ? (
                    <div className="inline-flex rounded-xl bg-muted p-1 text-xs">
                      <button
                        type="button"
                        disabled={pricingBusy || selectedRaftCount === 0}
                        onClick={() => void applySelectedRaftPricing(false)}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-muted-foreground transition hover:bg-surface hover:text-foreground disabled:opacity-40"
                      >
                        <Package size={14} />
                        รวมในเหมา
                      </button>
                      <button
                        type="button"
                        disabled={pricingBusy || selectedRaftCount === 0}
                        onClick={() => void applySelectedRaftPricing(true)}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-muted-foreground transition hover:bg-surface hover:text-foreground disabled:opacity-40"
                      >
                        <PlusCircle size={14} />
                        คิดเพิ่ม
                      </button>
                    </div>
                  ) : null}
                </div>
                {data.rafts.length === 0 ? (
                  <p className="rounded-xl bg-background px-3 py-2.5 text-sm text-muted-foreground">
                    ยังไม่มีแพ
                  </p>
                ) : (
                  data.rafts.map((raft) => {
                    const selectKey = `raft:${raft.id}`;
                    return (
                      <div
                        key={raft.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background px-3 py-2.5"
                      >
                        <div className="flex min-w-0 items-start gap-2">
                          {showPricingSelect && canResourcePricing ? (
                            <input
                              type="checkbox"
                              checked={selectedKeys.has(selectKey)}
                              onChange={() => toggleSelected(selectKey)}
                              disabled={pricingBusy}
                              className="mt-1"
                              aria-label={`เลือกแพ ${raft.name}`}
                            />
                          ) : null}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">
                              {raft.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {raft.capacity} คน · ฿
                              {raft.rate.toLocaleString()}/คืน
                            </p>
                          </div>
                        </div>
                        {isGroup ? (
                          <span
                            className={`text-xs ${raft.isExtra ? "text-warning" : "text-success"}`}
                          >
                            {raft.isExtra ? "คิดเพิ่ม" : "รวมในเหมา"}
                          </span>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="space-y-2 border-t border-border pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
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
                        {selectedFoodCount > 0
                          ? ` · เลือก ${selectedFoodCount}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  {showPricingSelect && canOrderPricing ? (
                    <div className="inline-flex rounded-xl bg-muted p-1 text-xs">
                      <button
                        type="button"
                        disabled={pricingBusy || selectedFoodCount === 0}
                        onClick={() => void applySelectedFoodPricing(false)}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-muted-foreground transition hover:bg-surface hover:text-foreground disabled:opacity-40"
                      >
                        <Package size={14} />
                        รวมในเหมา
                      </button>
                      <button
                        type="button"
                        disabled={pricingBusy || selectedFoodCount === 0}
                        onClick={() => void applySelectedFoodPricing(true)}
                        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-muted-foreground transition hover:bg-surface hover:text-foreground disabled:opacity-40"
                      >
                        <PlusCircle size={14} />
                        คิดเพิ่ม
                      </button>
                    </div>
                  ) : null}
                </div>
                {food.length === 0 ? (
                  <p className="rounded-xl bg-background px-3 py-2.5 text-sm text-muted-foreground">
                    ยังไม่มีรายการอาหาร
                  </p>
                ) : (
                  food.map((item) => {
                    const selectKey = `food:${item.id}`;
                    const canSelectFood =
                      showPricingSelect && canOrderPricing && item.editable;
                    return (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background px-3 py-2.5"
                      >
                        <div className="flex min-w-0 items-start gap-2">
                          {canSelectFood ? (
                            <input
                              type="checkbox"
                              checked={selectedKeys.has(selectKey)}
                              onChange={() => toggleSelected(selectKey)}
                              disabled={pricingBusy}
                              className="mt-1"
                              aria-label={`เลือกรายการ ${item.productName}`}
                            />
                          ) : null}
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
                        </div>
                        {isGroup ? (
                          <span
                            className={`text-xs ${item.isExtra ? "text-warning" : "text-success"}`}
                          >
                            {item.isExtra ? "คิดเพิ่ม" : "รวมในเหมา"}
                          </span>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <div className="flex flex-wrap gap-2">
                {canManageItems ? (
                  <>
                    <PermissionGate permission="resource.manage">
                      <button
                        type="button"
                        onClick={() => setOpenManageResources(true)}
                        className="inline-flex items-center gap-2 rounded-xl border border-secondary/30 px-4 py-2 text-sm text-secondary"
                      >
                        <Pencil size={17} />
                        จัดการห้องและแพ
                      </button>
                    </PermissionGate>
                    <PermissionGate permission="order.write">
                      <button
                        type="button"
                        onClick={() => setOpenManageFood(true)}
                        className="inline-flex items-center gap-2 rounded-xl border border-secondary/30 px-4 py-2 text-sm text-secondary"
                      >
                        <Utensils size={17} />
                        จัดการรายการอาหาร
                      </button>
                    </PermissionGate>
                    <PermissionGate permission="booking.write">
                      <button
                        type="button"
                        onClick={() => setOpenManageCharges(true)}
                        className="inline-flex items-center gap-2 rounded-xl border border-secondary/30 px-4 py-2 text-sm text-secondary"
                      >
                        <Receipt size={17} />
                        เพิ่มค่าใช้จ่าย
                      </button>
                    </PermissionGate>
                  </>
                ) : null}
              </div>

              {canCancel && canLifecycle ? (
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

          {data.status !== "CANCELLED" ? (
            <BookingPromptPaySection
              bookingId={data.id}
              bookingReference={data.reference}
              outstanding={data.totals.outstanding}
              onChanged={() => void load()}
            />
          ) : null}
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
        tourGroupId={data.tourGroupId ?? null}
        rooms={data.rooms.map((room) => ({
          id: room.id,
          number: room.number,
        }))}
        onAdded={() => void load()}
      />
      <AddBookingChargesDialog
        open={openManageCharges}
        setOpen={setOpenManageCharges}
        bookingId={data.id}
        onAdded={() => void load()}
      />
      <EditGroupPackageDialog
        open={openEditPackage}
        setOpen={setOpenEditPackage}
        bookingId={bookingId}
        mode={data.mode}
        initialCheckIn={data.checkIn}
        initialCheckOut={data.checkOut}
        initialGuestCount={data.guestCount ?? 1}
        initialPricePerPerson={data.pricePerPerson ?? 0}
        initialRooms={data.rooms.map((room) => ({
          id: room.id,
          isExtra: room.isExtra,
        }))}
        initialRafts={data.rafts.map((raft) => ({
          id: raft.id,
          isExtra: raft.isExtra,
        }))}
        onSaved={() => void load()}
      />
      {editInspection ? (
        <EditBookingInspectionDialog
          open
          onClose={() => setEditInspection(null)}
          inspectionId={editInspection.inspectionId}
          roomLabel={editInspection.roomLabel}
          initialNotes={editInspection.notes}
          initialItems={editInspection.items}
          onSaved={() => void load()}
        />
      ) : null}
    </>
  );
}
