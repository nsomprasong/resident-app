import { Download, FileText, Hotel, ReceiptText, Wallet } from "lucide-react";
import type { ReactNode } from "react";

import { BookingStatus, PaymentStatus } from "@/generated/prisma/client";
import {
  activeBookingConflictStatuses,
  availableRaftStatuses,
  availableRoomStatuses,
} from "@/lib/bookings/availability";
import { calculateNetRevenue, calculateRate } from "@/lib/dashboard/metrics";
import { calculateBookingFinancialSummary } from "@/lib/payments/financial-summary";
import { prisma } from "@/lib/prisma";
import { endOfUtcMonth, startOfUtcMonth } from "@/lib/reports/reporting";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function ReportPage() {
  const monthStart = startOfUtcMonth(new Date());
  const monthEnd = endOfUtcMonth(new Date());
  const today = new Date();

  const [
    payments,
    rooms,
    rafts,
    activeRoomBookings,
    activeRaftBookings,
    receiptBookings,
    bookingStatusCounts,
  ] = await Promise.all([
    prisma.payment.findMany({
      where: {
        status: { in: [PaymentStatus.PAID, PaymentStatus.REFUNDED] },
        paidAt: { gte: monthStart, lt: monthEnd },
      },
      select: { amount: true, status: true },
    }),
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
    prisma.booking.findMany({
      where: {
        status: { in: [BookingStatus.CHECKED_OUT, BookingStatus.CANCELLED] },
        payments: { some: { status: { in: [PaymentStatus.PAID, PaymentStatus.REFUNDED] } } },
      },
      include: {
        guest: true,
        tourGroup: true,
        charges: true,
        payments: { where: { status: { in: [PaymentStatus.PAID, PaymentStatus.REFUNDED] } } },
        orders: {
          where: { status: { not: "CANCELLED" } },
          include: { items: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    prisma.booking.groupBy({
      by: ["status"],
      _count: { status: true },
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
  const netRevenue = calculateNetRevenue(payments);
  const paidTotal = payments.reduce(
    (sum, payment) =>
      payment.status === PaymentStatus.PAID ? sum + Number(payment.amount) : sum,
    0,
  );
  const refundedTotal = payments.reduce(
    (sum, payment) =>
      payment.status === PaymentStatus.REFUNDED
        ? sum + Number(payment.amount)
        : sum,
    0,
  );
  const roomOccupancyRate = calculateRate(unavailableRooms, rooms.length);
  const raftOccupancyRate = calculateRate(unavailableRafts, rafts.length);
  const statusCountMap = new Map(
    bookingStatusCounts.map((item) => [item.status, item._count.status]),
  );

  return (
    <div className="min-h-screen bg-muted p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Reports</p>
            <h1 className="mt-1 text-3xl font-semibold text-foreground">
              รายงานกิจการ
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              รายได้ Occupancy ใบเสร็จ และ export ข้อมูลรายรับเดือนปัจจุบัน
            </p>
          </div>
          <a
            href="/api/reports/export"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Download size={16} />
            Export CSV
          </a>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="รายได้สุทธิเดือนนี้"
            value={formatCurrency(netRevenue)}
            helper={`รับ ${formatCurrency(paidTotal)} · คืน ${formatCurrency(refundedTotal)}`}
            icon={<Wallet size={22} />}
          />
          <StatCard
            title="Occupancy ห้อง"
            value={`${roomOccupancyRate}%`}
            helper={`${unavailableRooms}/${rooms.length} ห้องไม่ว่างหรือปิดใช้งาน`}
            icon={<Hotel size={22} />}
          />
          <StatCard
            title="Occupancy แพ"
            value={`${raftOccupancyRate}%`}
            helper={`${unavailableRafts}/${rafts.length} แพไม่ว่างหรือปิดใช้งาน`}
            icon={<Hotel size={22} />}
          />
          <StatCard
            title="รายการรอออกใบเสร็จ"
            value={receiptBookings.length.toLocaleString("th-TH")}
            helper="เช็กเอาต์หรือยกเลิกและมี payment"
            icon={<ReceiptText size={22} />}
          />
        </div>

        <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="text-primary" size={22} />
            <h2 className="text-lg font-semibold text-foreground">
              Booking Status Summary
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-5">
            {Object.values(BookingStatus).map((status) => (
              <div key={status} className="rounded-2xl bg-background p-3">
                <p className="text-xs text-muted-foreground">{status}</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {(statusCountMap.get(status) ?? 0).toLocaleString("th-TH")}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              Receipt Summary
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              ใช้ยอดจาก financial summary เดียวกับหน้ารายละเอียดการจอง
            </p>
          </div>
          <div className="space-y-3">
            {receiptBookings.length ? (
              receiptBookings.map((booking) => {
                const summary = calculateBookingFinancialSummary({
                  charges: booking.charges,
                  orders: booking.orders,
                  payments: booking.payments,
                });
                const customerName =
                  booking.tourGroup?.name ??
                  [booking.guest?.firstName, booking.guest?.lastName]
                    .filter(Boolean)
                    .join(" ");

                return (
                  <div
                    key={booking.id}
                    className="grid gap-3 rounded-2xl border border-border p-4 text-sm sm:grid-cols-5 sm:items-center"
                  >
                    <div className="sm:col-span-2">
                      <p className="font-medium text-foreground">
                        {booking.reference}
                      </p>
                      <p className="text-muted-foreground">{customerName || "-"}</p>
                    </div>
                    <Metric label="ยอดรวม" value={formatCurrency(summary.grandTotal)} />
                    <Metric label="รับสุทธิ" value={formatCurrency(summary.netPaidTotal)} />
                    <Metric label="ค้างชำระ" value={formatCurrency(summary.outstandingTotal)} />
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl bg-background p-4 text-sm text-muted-foreground">
                ยังไม่มีรายการสำหรับใบเสร็จ
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
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
          <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{helper}</p>
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </span>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  );
}