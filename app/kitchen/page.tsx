"use client";

import { CookingPot, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  deriveKitchenMetrics,
  filterKitchenOrders,
  groupByStatus,
  KitchenOverviewPanel,
  KitchenSummaryCards,
  OrderColumn,
  type KitchenOrder,
  type KitchenOrderStatus,
} from "@/components/kitchen/KitchenDashboard";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatThaiDateTime } from "@/lib/format/date";

type ProductTypeFilter = "ALL" | "MENU" | "MINIBAR";

export default function KitchenPage() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [deliveredOrders, setDeliveredOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [productType, setProductType] = useState<ProductTypeFilter>("ALL");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [queueResponse, deliveredResponse] = await Promise.all([
        fetch("/api/orders", { cache: "no-store" }),
        fetch("/api/orders?status=DELIVERED", { cache: "no-store" }),
      ]);

      if (!queueResponse.ok) throw new Error("LOAD_FAILED");

      const queueData = (await queueResponse.json()) as KitchenOrder[];
      setOrders(queueData);

      if (deliveredResponse.ok) {
        const deliveredData = (await deliveredResponse.json()) as KitchenOrder[];
        setDeliveredOrders(deliveredData);
      } else {
        setDeliveredOrders([]);
      }

      setLastUpdatedAt(new Date());
    } catch {
      setError("โหลดรายการครัวไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const updateStatus = async (orderId: string, status: KitchenOrderStatus) => {
    setUpdatingId(orderId);
    setError("");
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) throw new Error("UPDATE_FAILED");
      await loadOrders();
    } catch {
      setError("อัปเดตสถานะออเดอร์ไม่สำเร็จ");
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrders = useMemo(
    () => filterKitchenOrders(orders, query, productType),
    [orders, productType, query],
  );
  const grouped = useMemo(() => groupByStatus(filteredOrders), [filteredOrders]);
  const metrics = useMemo(
    () =>
      deriveKitchenMetrics(
        orders,
        deliveredOrders,
        lastUpdatedAt ?? new Date(),
      ),
    [deliveredOrders, lastUpdatedAt, orders],
  );

  const updatedLabel = lastUpdatedAt
    ? formatThaiDateTime(lastUpdatedAt)
    : "ยังไม่ได้อัปเดต";

  return (
    <div className="min-h-screen bg-muted p-4 sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader
          icon={<CookingPot size={22} />}
          eyebrow="Kitchen Workflow"
          title="คิวออเดอร์ครัว"
          description="ติดตามออเดอร์ที่รอทำ กำลังเตรียม และพร้อมส่ง"
          meta={<>อัปเดตล่าสุด {updatedLabel}</>}
          actions={
            <button
              type="button"
              onClick={() => void loadOrders()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin" : undefined}
              />
              รีเฟรช
            </button>
          }
          toolbar={
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <label className="relative min-w-0 flex-1 lg:max-w-sm">
                <span className="sr-only">ค้นหาเลขออเดอร์หรือเลขห้อง</span>
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ค้นหาเลขออเดอร์ / ห้อง"
                  className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-foreground outline-none ring-ring/30 placeholder:text-muted-foreground focus:border-primary focus:ring-2"
                />
              </label>

              <label className="min-w-0 sm:w-40">
                <span className="sr-only">กรองประเภท</span>
                <select
                  value={productType}
                  onChange={(event) =>
                    setProductType(event.target.value as ProductTypeFilter)
                  }
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none ring-ring/30 focus:border-primary focus:ring-2"
                >
                  <option value="ALL">ทุกประเภท</option>
                  <option value="MENU">เมนูทั่วไป</option>
                  <option value="MINIBAR">มินิบาร์</option>
                </select>
              </label>
            </div>
          }
        />

        {error ? (
          <div
            className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <KitchenSummaryCards metrics={metrics} />

        <div className="grid gap-4 lg:grid-cols-3">
          <OrderColumn
            status="PENDING"
            orders={grouped.PENDING}
            updatingId={updatingId}
            onUpdate={updateStatus}
            loading={loading}
          />
          <OrderColumn
            status="PREPARING"
            orders={grouped.PREPARING}
            updatingId={updatingId}
            onUpdate={updateStatus}
            loading={loading}
          />
          <OrderColumn
            status="READY"
            orders={grouped.READY}
            updatingId={updatingId}
            onUpdate={updateStatus}
            loading={loading}
          />
        </div>

        {!loading && filteredOrders.length === 0 && orders.length > 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted-foreground">
            ไม่พบออเดอร์ที่ตรงกับคำค้นหาหรือตัวกรอง
          </div>
        ) : null}

        <KitchenOverviewPanel metrics={metrics} />
      </div>
    </div>
  );
}
