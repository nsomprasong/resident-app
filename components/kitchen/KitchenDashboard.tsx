"use client";

import {
  AlertTriangle,
  ChefHat,
  Clock3,
  PackageCheck,
  Search,
  Timer,
  Truck,
  UtensilsCrossed,
} from "lucide-react";
import type { ReactNode } from "react";

export type KitchenOrderStatus =
  | "PENDING"
  | "PREPARING"
  | "READY"
  | "DELIVERED"
  | "CANCELLED";

export type KitchenOrder = {
  id: string;
  number: string;
  status: KitchenOrderStatus;
  room: { number: string } | null;
  booking: { reference: string; customerName: string } | null;
  note: string | null;
  createdAt: string;
  items: Array<{
    id: string;
    productName: string;
    productType: string;
    isMinibar: boolean;
    quantity: number;
    note: string | null;
  }>;
};

export const statusLabels: Record<KitchenOrderStatus, string> = {
  PENDING: "รอรับออเดอร์",
  PREPARING: "กำลังเตรียม",
  READY: "พร้อมส่ง",
  DELIVERED: "ส่งแล้ว",
  CANCELLED: "ยกเลิก",
};

export const nextActions: Partial<
  Record<KitchenOrderStatus, { label: string; status: KitchenOrderStatus }>
> = {
  PENDING: { label: "เริ่มทำ", status: "PREPARING" },
  PREPARING: { label: "พร้อมส่ง", status: "READY" },
  READY: { label: "ส่งแล้ว", status: "DELIVERED" },
};

const DELAYED_MINUTES = 30;

function bangkokDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function bangkokHour(date: Date) {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Bangkok",
      hour: "numeric",
      hour12: false,
    }).format(date),
  );
}

function shiftBangkokDay(dateKey: string, deltaDays: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + deltaDays);
  return utc.toISOString().slice(0, 10);
}

function minutesBetween(fromIso: string, to = new Date()) {
  return Math.max(0, Math.round((to.getTime() - new Date(fromIso).getTime()) / 60000));
}

export function groupByStatus(orders: KitchenOrder[]) {
  return {
    PENDING: orders.filter((order) => order.status === "PENDING"),
    PREPARING: orders.filter((order) => order.status === "PREPARING"),
    READY: orders.filter((order) => order.status === "READY"),
  };
}

export function filterKitchenOrders(
  orders: KitchenOrder[],
  query: string,
  productType: "ALL" | "MENU" | "MINIBAR",
) {
  const normalized = query.trim().toLowerCase();
  return orders.filter((order) => {
    const matchesType =
      productType === "ALL" ||
      (productType === "MINIBAR"
        ? order.items.some((item) => item.isMinibar)
        : order.items.some((item) => !item.isMinibar));
    if (!matchesType) return false;
    if (!normalized) return true;
    const haystack = [
      order.number,
      order.room?.number ?? "",
      order.booking?.customerName ?? "",
      order.booking?.reference ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalized);
  });
}

export type KitchenMetrics = {
  todayCount: number;
  todayDelta: number;
  completedCount: number;
  completedDelta: number;
  averagePrepMinutes: number | null;
  delayedCount: number;
  hourlyCounts: number[];
  popularItems: Array<{ name: string; quantity: number }>;
};

export function deriveKitchenMetrics(
  queueOrders: KitchenOrder[],
  deliveredOrders: KitchenOrder[],
  now = new Date(),
): KitchenMetrics {
  const todayKey = bangkokDateKey(now);
  const yesterdayKey = shiftBangkokDay(todayKey, -1);
  const all = [...queueOrders, ...deliveredOrders];

  const createdOn = (key: string) =>
    all.filter((order) => bangkokDateKey(new Date(order.createdAt)) === key);

  const todayOrders = createdOn(todayKey);
  const yesterdayOrders = createdOn(yesterdayKey);

  const completedToday = deliveredOrders.filter(
    (order) => bangkokDateKey(new Date(order.createdAt)) === todayKey,
  );
  const completedYesterday = deliveredOrders.filter(
    (order) => bangkokDateKey(new Date(order.createdAt)) === yesterdayKey,
  );

  const activeAges = queueOrders.map((order) => minutesBetween(order.createdAt, now));
  const averagePrepMinutes =
    activeAges.length > 0
      ? Math.round(activeAges.reduce((sum, value) => sum + value, 0) / activeAges.length)
      : null;

  const delayed = queueOrders.filter(
    (order) => minutesBetween(order.createdAt, now) >= DELAYED_MINUTES,
  );

  const hourlyCounts = Array.from({ length: 24 }, () => 0);
  for (const order of todayOrders) {
    const hour = bangkokHour(new Date(order.createdAt));
    if (hour >= 0 && hour < 24) hourlyCounts[hour] += 1;
  }

  const popularMap = new Map<string, number>();
  for (const order of todayOrders) {
    for (const item of order.items) {
      popularMap.set(
        item.productName,
        (popularMap.get(item.productName) ?? 0) + item.quantity,
      );
    }
  }
  const popularItems = [...popularMap.entries()]
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  return {
    todayCount: todayOrders.length,
    todayDelta: todayOrders.length - yesterdayOrders.length,
    completedCount: completedToday.length,
    completedDelta: completedToday.length - completedYesterday.length,
    averagePrepMinutes,
    delayedCount: delayed.length,
    hourlyCounts,
    popularItems,
  };
}

export function formatDelta(delta: number, unit = "รายการ") {
  if (delta === 0) return `เท่ากับเมื่อวาน`;
  if (delta > 0) return `+${delta} ${unit} จากเมื่อวาน`;
  return `${delta} ${unit} จากเมื่อวาน`;
}

export function StatCard({
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
    <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
          <p className="mt-1 text-sm text-muted-foreground">{helper}</p>
        </div>
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${toneClass}`}>
          {icon}
        </span>
      </div>
    </section>
  );
}

export function KitchenSummaryCards({ metrics }: { metrics: KitchenMetrics }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        title="ออเดอร์วันนี้"
        value={metrics.todayCount.toLocaleString("th-TH")}
        helper={
          metrics.todayCount === 0 && metrics.todayDelta === 0
            ? "ยังไม่มีออเดอร์วันนี้"
            : formatDelta(metrics.todayDelta)
        }
        icon={<UtensilsCrossed size={22} />}
        tone="primary"
      />
      <StatCard
        title="เสร็จแล้ว"
        value={metrics.completedCount.toLocaleString("th-TH")}
        helper={
          metrics.completedCount === 0
            ? "ยังไม่มีออเดอร์ที่ส่งแล้ววันนี้"
            : formatDelta(metrics.completedDelta)
        }
        icon={<PackageCheck size={22} />}
        tone="success"
      />
      <StatCard
        title="เวลาทำเฉลี่ย"
        value={
          metrics.averagePrepMinutes === null
            ? "0"
            : `${metrics.averagePrepMinutes.toLocaleString("th-TH")} น.`
        }
        helper={
          metrics.averagePrepMinutes === null
            ? "ยังไม่มีคิวให้คำนวณ"
            : "เฉลี่ยจากออเดอร์ในคิวปัจจุบัน"
        }
        icon={<Timer size={22} />}
        tone="info"
      />
      <StatCard
        title="ออเดอร์ล่าช้า"
        value={metrics.delayedCount.toLocaleString("th-TH")}
        helper={
          metrics.delayedCount === 0
            ? `ไม่มีคิวเกิน ${DELAYED_MINUTES} นาที`
            : `ค้างในคิวนานกว่า ${DELAYED_MINUTES} นาที`
        }
        icon={<AlertTriangle size={22} />}
        tone="warning"
      />
    </div>
  );
}

const columnTone: Record<
  "PENDING" | "PREPARING" | "READY",
  { badge: string; icon: string; accent: string }
> = {
  PENDING: {
    badge: "bg-warning/10 text-warning",
    icon: "bg-warning/10 text-warning",
    accent: "border-warning/20",
  },
  PREPARING: {
    badge: "bg-info/10 text-info",
    icon: "bg-info/10 text-info",
    accent: "border-info/20",
  },
  READY: {
    badge: "bg-success/10 text-success",
    icon: "bg-success/10 text-success",
    accent: "border-success/20",
  },
};

export function OrderCard({
  order,
  updating,
  onUpdate,
}: {
  order: KitchenOrder;
  updating: boolean;
  onUpdate: (orderId: string, status: KitchenOrderStatus) => Promise<void>;
}) {
  const nextAction = nextActions[order.status];
  const ageMinutes = minutesBetween(order.createdAt);
  const delayed = ageMinutes >= DELAYED_MINUTES;

  return (
    <article className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{order.number}</p>
          <p className="truncate text-sm text-muted-foreground">
            {order.room
              ? `ห้อง ${order.room.number}`
              : order.note?.includes("กรุ๊ป")
                ? "บิลกรุ๊ป"
                : "ไม่ระบุห้อง"}
            {order.booking?.customerName ? ` · ${order.booking.customerName}` : ""}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            delayed ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"
          }`}
        >
          {ageMinutes} น.
        </span>
      </div>

      <ul className="mt-3 space-y-2">
        {order.items.map((item) => (
          <li key={item.id} className="rounded-xl bg-background p-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="min-w-0 truncate text-foreground">{item.productName}</span>
              <span className="shrink-0 font-medium text-foreground">x{item.quantity}</span>
            </div>
            {item.note ? (
              <p className="mt-1 text-xs text-muted-foreground">{item.note}</p>
            ) : null}
          </li>
        ))}
      </ul>

      {order.note ? (
        <p className="mt-3 rounded-xl bg-primary/10 px-3 py-2 text-xs text-primary">
          หมายเหตุ: {order.note}
        </p>
      ) : null}

      <div className="mt-4 flex gap-2">
        {nextAction ? (
          <button
            type="button"
            disabled={updating}
            onClick={() => void onUpdate(order.id, nextAction.status)}
            className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <PackageCheck size={16} />
            {updating ? "กำลังอัปเดต..." : nextAction.label}
          </button>
        ) : null}
        {order.status !== "DELIVERED" && order.status !== "CANCELLED" ? (
          <button
            type="button"
            disabled={updating}
            onClick={() => void onUpdate(order.id, "CANCELLED")}
            className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
          >
            ยกเลิก
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function OrderColumn({
  status,
  orders,
  updatingId,
  onUpdate,
  loading,
}: {
  status: "PENDING" | "PREPARING" | "READY";
  orders: KitchenOrder[];
  updatingId: string | null;
  onUpdate: (orderId: string, status: KitchenOrderStatus) => Promise<void>;
  loading: boolean;
}) {
  const tone = columnTone[status];
  const icon =
    status === "PENDING" ? (
      <Clock3 size={18} />
    ) : status === "PREPARING" ? (
      <ChefHat size={18} />
    ) : (
      <Truck size={18} />
    );

  return (
    <section
      className={`flex min-h-[28rem] flex-col rounded-3xl border bg-surface p-4 shadow-sm ${tone.accent}`}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`grid h-9 w-9 place-items-center rounded-xl ${tone.icon}`}>
            {icon}
          </span>
          <h2 className="truncate font-semibold text-foreground">
            {statusLabels[status]}
          </h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${tone.badge}`}>
          {orders.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        {loading ? (
          <div className="flex flex-1 flex-col justify-center rounded-2xl border border-dashed border-border bg-background p-6 text-center">
            <p className="text-sm text-muted-foreground">กำลังโหลดคิว...</p>
          </div>
        ) : orders.length ? (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              updating={updatingId === order.id}
              onUpdate={onUpdate}
            />
          ))
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background px-4 py-10 text-center">
            <span className={`mb-3 grid h-12 w-12 place-items-center rounded-2xl ${tone.icon}`}>
              {icon}
            </span>
            <p className="font-medium text-foreground">ยังไม่มีออเดอร์</p>
            <p className="mt-1 max-w-[14rem] text-sm text-muted-foreground">
              คอลัมน์นี้พร้อมรับงานเมื่อมีรายการเข้าสู่สถานะ
              {statusLabels[status]}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function hourlyBarClass(count: number, max: number) {
  if (count <= 0) return "h-1 bg-border";
  const ratio = count / Math.max(max, 1);
  if (ratio <= 0.2) return "h-8 bg-primary/80";
  if (ratio <= 0.4) return "h-16 bg-primary/80";
  if (ratio <= 0.6) return "h-24 bg-primary/80";
  if (ratio <= 0.8) return "h-32 bg-primary/80";
  return "h-40 bg-primary/80";
}

export function KitchenOverviewPanel({ metrics }: { metrics: KitchenMetrics }) {
  const maxHourly = Math.max(...metrics.hourlyCounts, 0);
  const hasHourlyData = metrics.hourlyCounts.some((count) => count > 0);

  return (
    <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-foreground">ภาพรวมการทำงานวันนี้</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          สรุปจากออเดอร์ที่มีอยู่ในระบบ ไม่ใช้ข้อมูลจำลอง
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-sm font-medium text-foreground">จำนวนออเดอร์ตามช่วงเวลา</p>
          {hasHourlyData ? (
            <div className="mt-4 flex h-44 items-end gap-1 overflow-x-auto pb-1">
              {metrics.hourlyCounts.map((count, hour) => (
                <div
                  key={hour}
                  className="flex min-w-[1.1rem] flex-1 flex-col items-center justify-end gap-1"
                  title={`${hour.toString().padStart(2, "0")}:00 · ${count} ออเดอร์`}
                >
                  <div className={`w-full rounded-t-md ${hourlyBarClass(count, maxHourly)}`} />
                  {hour % 3 === 0 ? (
                    <span className="text-[10px] text-muted-foreground">
                      {hour.toString().padStart(2, "0")}
                    </span>
                  ) : (
                    <span className="text-[10px] text-transparent">00</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 flex h-44 flex-col items-center justify-center rounded-xl border border-dashed border-border px-4 text-center">
              <Search size={22} className="text-muted-foreground" />
              <p className="mt-2 text-sm font-medium text-foreground">ยังไม่มีข้อมูลรายชั่วโมง</p>
              <p className="mt-1 text-sm text-muted-foreground">
                เมื่อมีออเดอร์วันนี้ กราฟจะแสดงจำนวนตามช่วงเวลาอัตโนมัติ
              </p>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-sm font-medium text-foreground">เมนูที่ถูกสั่งบ่อยวันนี้</p>
          {metrics.popularItems.length ? (
            <ul className="mt-4 space-y-2">
              {metrics.popularItems.map((item, index) => (
                <li
                  key={item.name}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                      {index + 1}
                    </span>
                    <span className="truncate text-sm text-foreground">{item.name}</span>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-muted-foreground">
                    x{item.quantity}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 flex h-44 flex-col items-center justify-center rounded-xl border border-dashed border-border px-4 text-center">
              <UtensilsCrossed size={22} className="text-muted-foreground" />
              <p className="mt-2 text-sm font-medium text-foreground">ยังไม่มีเมนูยอดนิยม</p>
              <p className="mt-1 text-sm text-muted-foreground">
                รายการจะอัปเดตเมื่อมีออเดอร์อาหารหรือมินิบาร์วันนี้
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
