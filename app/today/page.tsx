import TodayOpsBoard, {
  type TodayOpsCardData,
} from "@/components/dashboard/TodayOpsBoard";
import TodayOpsDateNav from "@/components/dashboard/TodayOpsDateNav";
import { PageHeader } from "@/components/ui/PageHeader";
import { activeBookingConflictStatuses } from "@/lib/bookings/availability";
import {
  addDaysToOpsDateKey,
  bangkokDateOnly,
  bangkokDayBounds,
  bangkokTodayKey,
  resolveOpsDateKey,
  summarizeTodayOps,
} from "@/lib/dashboard/today-ops";
import { formatThaiDate } from "@/lib/format/date";
import { prisma } from "@/lib/prisma";
import { CalendarCheck2 } from "lucide-react";

export const dynamic = "force-dynamic";

function formatNumber(value: number) {
  return new Intl.NumberFormat("th-TH").format(value);
}

function customerName(booking: {
  tourGroup: { name: string } | null;
  guest: { firstName: string; lastName: string } | null;
}) {
  if (booking.tourGroup?.name) return booking.tourGroup.name;
  const guestName = [booking.guest?.firstName, booking.guest?.lastName]
    .filter(Boolean)
    .join(" ");
  return guestName || "ลูกค้า";
}

function dateKeyUtc(value: Date) {
  return value.toISOString().slice(0, 10);
}

type TodayOpsPageProps = {
  searchParams: Promise<{ date?: string }>;
};

export default async function TodayOpsPage({ searchParams }: TodayOpsPageProps) {
  const params = await searchParams;
  const actualTodayKey = bangkokTodayKey();
  const selectedKey = resolveOpsDateKey(params.date, actualTodayKey);
  const selectedDate = bangkokDateOnly(selectedKey);
  const nextKey = addDaysToOpsDateKey(selectedKey, 1);
  const { start, end } = bangkokDayBounds(selectedKey);
  const dayLabel = selectedKey === actualTodayKey ? "วันนี้" : "วันที่เลือก";

  const currentBookingWhere = {
    status: { in: activeBookingConflictStatuses },
    closedAt: null,
    checkIn: { lte: selectedDate },
    checkOut: { gt: selectedDate },
  };

  const bookings = await prisma.booking.findMany({
    where: currentBookingWhere,
    select: {
      id: true,
      reference: true,
      checkIn: true,
      checkOut: true,
      tourGroupId: true,
      guestCount: true,
      tourGroup: { select: { id: true, name: true } },
      guest: { select: { firstName: true, lastName: true } },
      rooms: {
        select: {
          id: true,
          room: { select: { number: true, zone: { select: { name: true } } } },
        },
      },
      rafts: {
        select: {
          id: true,
          raft: { select: { number: true, name: true } },
        },
      },
    },
    orderBy: [{ checkIn: "asc" }, { reference: "asc" }],
  });

  const currentBookingIds = bookings.map((booking) => booking.id);
  const orderItems =
    currentBookingIds.length === 0
      ? []
      : await prisma.orderItem.findMany({
          where: {
            order: {
              status: { not: "CANCELLED" },
              createdAt: { gte: start, lte: end },
              bookingId: { in: currentBookingIds },
            },
          },
          select: {
            id: true,
            quantity: true,
            productId: true,
            product: { select: { name: true, isMinibar: true } },
            order: {
              select: {
                number: true,
                room: { select: { number: true } },
                booking: {
                  select: {
                    reference: true,
                    tourGroup: { select: { name: true } },
                    guest: { select: { firstName: true, lastName: true } },
                  },
                },
              },
            },
          },
          orderBy: { order: { createdAt: "asc" } },
        });

  const summary = summarizeTodayOps({
    todayKey: selectedKey,
    bookings: bookings.map((booking) => ({
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      tourGroupId: booking.tourGroupId,
      guestCount: booking.guestCount,
      roomCount: booking.rooms.length,
      raftCount: booking.rafts.length,
    })),
    foodItems: orderItems.map((item) => ({
      quantity: item.quantity,
      isMinibar: item.product.isMinibar,
    })),
    foodProductIds: orderItems
      .filter((item) => !item.product.isMinibar)
      .map((item) => item.productId),
  });

  const checkInBookings = bookings.filter(
    (booking) => dateKeyUtc(booking.checkIn) === selectedKey,
  );

  const roomRows = checkInBookings.flatMap((booking) =>
    booking.rooms.map((item) => ({
      id: item.id,
      title: `ห้อง ${item.room.number}`,
      subtitle: `${customerName(booking)} · ${booking.reference}${
        item.room.zone?.name ? ` · ${item.room.zone.name}` : ""
      }`,
      meta: booking.guestCount
        ? `${formatNumber(booking.guestCount)} คน`
        : undefined,
    })),
  );

  const groupMap = new Map<
    string,
    { name: string; rooms: number; guests: number; references: string[] }
  >();
  for (const booking of bookings) {
    if (!booking.tourGroup) continue;
    const current = groupMap.get(booking.tourGroup.id) ?? {
      name: booking.tourGroup.name,
      rooms: 0,
      guests: 0,
      references: [],
    };
    current.rooms += booking.rooms.length;
    current.guests += booking.guestCount ?? 0;
    current.references.push(booking.reference);
    groupMap.set(booking.tourGroup.id, current);
  }
  const groupRows = [...groupMap.entries()].map(([id, group]) => ({
    id,
    title: group.name,
    subtitle: `${formatNumber(group.rooms)} ห้อง · ${group.references.join(", ")}`,
    meta: `${formatNumber(group.guests)} คน`,
  }));

  const raftRows = bookings.flatMap((booking) =>
    booking.rafts.map((item) => ({
      id: item.id,
      title: item.raft.name || `แพ ${item.raft.number}`,
      subtitle: `${customerName(booking)} · ${booking.reference}`,
      meta: booking.guestCount
        ? `${formatNumber(booking.guestCount)} คน`
        : undefined,
    })),
  );

  const guestRows = bookings.map((booking) => ({
    id: booking.id,
    title: customerName(booking),
    subtitle: `${booking.reference}${
      booking.rooms.length
        ? ` · ห้อง ${booking.rooms.map((item) => item.room.number).join(", ")}`
        : ""
    }`,
    meta: booking.guestCount
      ? `${formatNumber(booking.guestCount)} คน`
      : "ไม่ระบุ",
  }));

  const foodAgg = new Map<
    string,
    { name: string; quantity: number; notes: string[] }
  >();
  const minibarAgg = new Map<
    string,
    { name: string; quantity: number; notes: string[] }
  >();

  for (const item of orderItems) {
    const target = item.product.isMinibar ? minibarAgg : foodAgg;
    const guestLabel = [
      item.order.booking?.guest?.firstName,
      item.order.booking?.guest?.lastName,
    ]
      .filter(Boolean)
      .join(" ");
    const noteParts = [
      item.order.number,
      item.order.room ? `ห้อง ${item.order.room.number}` : null,
      item.order.booking?.tourGroup?.name ?? (guestLabel || null),
    ].filter(Boolean) as string[];
    const current = target.get(item.productId) ?? {
      name: item.product.name,
      quantity: 0,
      notes: [],
    };
    current.quantity += item.quantity;
    if (noteParts.length) current.notes.push(noteParts.join(" · "));
    target.set(item.productId, current);
  }

  const foodRows = [...foodAgg.entries()].map(([id, item]) => ({
    id,
    title: item.name,
    subtitle: item.notes.slice(0, 2).join(" | ") || `ออเดอร์${dayLabel}`,
    meta: `x${formatNumber(item.quantity)}`,
  }));
  const minibarRows = [...minibarAgg.entries()].map(([id, item]) => ({
    id,
    title: item.name,
    subtitle: item.notes.slice(0, 2).join(" | ") || `ออเดอร์${dayLabel}`,
    meta: `x${formatNumber(item.quantity)}`,
  }));

  const cards: TodayOpsCardData[] = [
    {
      key: "rooms",
      title: `ห้องเช็กอิน${dayLabel}`,
      value: formatNumber(summary.roomsCheckInToday),
      helper: `กำลังเข้าพักรวม ${formatNumber(summary.roomsInHouse)} ห้อง`,
      accent: "primary",
      rows: roomRows,
    },
    {
      key: "groups",
      title: `กรุ๊ปทัวร์${dayLabel}`,
      value: formatNumber(summary.tourGroupsToday),
      helper: `จากการจองเข้าพัก ${formatNumber(summary.inHouseBookingCount)} รายการ`,
      accent: "secondary",
      rows: groupRows,
    },
    {
      key: "rafts",
      title: `แพที่ใช้งาน${dayLabel}`,
      value: formatNumber(summary.raftsToday),
      helper: "นับจากแพที่ผูกกับการจองที่เข้าพักและยังไม่ปิดงาน",
      accent: "primary",
      rows: raftRows,
    },
    {
      key: "guests",
      title: `ลูกค้าทั้งหมด${dayLabel}`,
      value: formatNumber(summary.guestsToday),
      helper: "รวมจำนวนผู้เข้าพักจากการจองที่ยังเปิดอยู่",
      accent: "secondary",
      rows: guestRows,
    },
    {
      key: "food",
      title: `อาหารที่สั่ง${dayLabel}`,
      value: formatNumber(summary.foodPortionsToday),
      helper: `${formatNumber(summary.foodKindsToday)} รายการเมนู · จากกรุ๊ปที่ยังเปิดอยู่`,
      accent: "primary",
      rows: foodRows,
    },
    {
      key: "minibar",
      title: `มินิบาร์${dayLabel}`,
      value: formatNumber(summary.minibarPortionsToday),
      helper: "มินิบาร์ของกรุ๊ปที่เข้าพักและยังไม่ปิดงาน",
      accent: "secondary",
      rows: minibarRows,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
      <PageHeader
        icon={<CalendarCheck2 size={24} />}
        eyebrow="งานประจำวัน"
        title={formatThaiDate(selectedKey)}
        description="แสดงเฉพาะกรุ๊ป/การจองที่เข้าพักอยู่และยังไม่ปิดงาน — แตะการ์ดเพื่อดูรายละเอียด"
        actions={
          <>
            <TodayOpsDateNav
              selectedKey={selectedKey}
              todayKey={actualTodayKey}
              nextKey={nextKey}
            />
            <div className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm shadow-sm">
              <p className="text-muted-foreground">การจอง{dayLabel}</p>
              <p className="text-2xl font-semibold text-foreground">
                {formatNumber(summary.checkInBookingCount)}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  รายการเช็กอิน
                </span>
              </p>
            </div>
          </>
        }
      />

      <TodayOpsBoard cards={cards} />
    </div>
  );
}
