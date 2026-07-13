import {
  BedDouble,
  ClipboardCheck,
  CreditCard,
  Home,
  ShipWheel,
} from "lucide-react";
import type { ReactNode } from "react";

import { BookingStatus, PaymentStatus } from "@/generated/prisma/client";
import {
  activeBookingConflictStatuses,
  availableRaftStatuses,
  availableRoomStatuses,
} from "@/lib/bookings/availability";
import { calculateNetRevenue, calculateRate } from "@/lib/dashboard/metrics";
import { prisma } from "@/lib/prisma";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(value);
}

function parseBangkokDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function todayBangkok() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return parseBangkokDate(`${get("year")}-${get("month")}-${get("day")}`);
}

function startOfBangkokMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function StatCard({
  title,
  value,
  helper,
  icon,
}: {
  title: string;
  value: string;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{helper}</p>
        </div>
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </span>
      </div>
    </section>
  );
}

export default async function DashboardPage() {
  const today = todayBangkok();
  const monthStart = startOfBangkokMonth(today);

  const [
    rooms,
    rafts,
    activeRoomBookings,
    activeRaftBookings,
    todayBookings,
    openInspections,
    monthlyPayments,
  ] = await Promise.all([
    prisma.room.findMany({ select: { id: true, status: true } }),
    prisma.raft.findMany({ select: { id: true, status: true } }),
    prisma.bookingRoom.findMany({
      where: {
        booking: {
          status: { in: activeBookingConflictStatuses },
          checkIn: { lte: today },
          checkOut: { gt: today },
        },
      },
      select: { roomId: true },
    }),
    prisma.bookingRaft.findMany({
      where: {
        booking: {
          status: { in: activeBookingConflictStatuses },
          checkIn: { lte: today },
          checkOut: { gt: today },
        },
      },
      select: { raftId: true },
    }),
    prisma.booking.count({
      where: {
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        checkIn: today,
      },
    }),
    prisma.roomInspection.findMany({
      where: {
        bookingRoom: {
          booking: { status: BookingStatus.CHECKED_OUT, closedAt: null },
        },
      },
      select: { status: true },
    }),
    prisma.payment.findMany({
      where: {
        status: { in: [PaymentStatus.PAID, PaymentStatus.REFUNDED] },
        paidAt: { gte: monthStart },
      },
      select: { amount: true, status: true },
    }),
  ]);

  const occupiedRoomIds = new Set(activeRoomBookings.map((item) => item.roomId));
  const occupiedRaftIds = new Set(activeRaftBookings.map((item) => item.raftId));
  const unavailableRooms = rooms.filter(
    (room) =>
      !availableRoomStatuses.includes(room.status) || occupiedRoomIds.has(room.id),
  ).length;
  const unavailableRafts = rafts.filter(
    (raft) =>
      !availableRaftStatuses.includes(raft.status) || occupiedRaftIds.has(raft.id),
  ).length;
  const roomOccupancyRate = calculateRate(unavailableRooms, rooms.length);
  const raftOccupancyRate = calculateRate(unavailableRafts, rafts.length);
  const pendingInspections = openInspections.filter(
    (inspection) => inspection.status !== "COMPLETED",
  ).length;
  const completedInspections = openInspections.length - pendingInspections;
  const netRevenue = calculateNetRevenue(monthlyPayments);

  return (
    <div className="min-h-screen bg-muted p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <p className="text-sm font-medium text-primary">Manager Dashboard</p>
          <h1 className="mt-1 text-3xl font-semibold text-foreground">
            ภาพรวมกิจการวันนี้
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            รวมสถานะการเข้าพัก รายได้สุทธิเดือนนี้ และงานแม่บ้านที่ยังเปิดอยู่
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Occupancy ห้องพัก"
            value={`${roomOccupancyRate}%`}
            helper={`${unavailableRooms}/${rooms.length} ห้องไม่ว่างหรือปิดใช้งาน`}
            icon={<BedDouble size={24} />}
          />
          <StatCard
            title="Occupancy แพ"
            value={`${raftOccupancyRate}%`}
            helper={`${unavailableRafts}/${rafts.length} แพไม่ว่างหรือปิดใช้งาน`}
            icon={<ShipWheel size={24} />}
          />
          <StatCard
            title="รายได้สุทธิเดือนนี้"
            value={formatCurrency(netRevenue)}
            helper="รับชำระหักรายการคืนเงิน"
            icon={<CreditCard size={24} />}
          />
          <StatCard
            title="จองเข้าใหม่วันนี้"
            value={todayBookings.toLocaleString("th-TH")}
            helper="รายการรอดำเนินการหรือยืนยันแล้ว"
            icon={<Home size={24} />}
          />
        </div>

        <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Housekeeping Overview
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                งานตรวจห้องของรายการที่เช็กเอาต์แล้วและยังไม่ปิดงาน
              </p>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-success/10 text-success">
              <ClipboardCheck size={24} />
            </span>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-background p-4">
              <p className="text-sm text-muted-foreground">งานทั้งหมด</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {openInspections.length.toLocaleString("th-TH")}
              </p>
            </div>
            <div className="rounded-2xl bg-warning/10 p-4">
              <p className="text-sm text-warning">รอตรวจ/กำลังตรวจ</p>
              <p className="mt-2 text-2xl font-semibold text-warning">
                {pendingInspections.toLocaleString("th-TH")}
              </p>
            </div>
            <div className="rounded-2xl bg-success/10 p-4">
              <p className="text-sm text-success">ตรวจเสร็จแล้ว</p>
              <p className="mt-2 text-2xl font-semibold text-success">
                {completedInspections.toLocaleString("th-TH")}
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}