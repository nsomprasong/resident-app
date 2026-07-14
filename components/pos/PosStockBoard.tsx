"use client";

import { useCallback, useEffect, useState } from "react";

import { PermissionGate } from "@/components/auth/PermissionGate";
import { useEmployeePermissions } from "@/components/auth/EmployeePermissionsProvider";
import { formatThaiDateTime } from "@/lib/format/date";

type Product = {
  id: string;
  name: string;
  sku: string;
  quantityOnHand: string | number;
  unit: string;
};
type Movement = {
  id: string;
  type: string;
  quantityDelta: string | number;
  quantityBefore: string | number;
  quantityAfter: string | number;
  documentNumber: string | null;
  reason: string | null;
  occurredAt: string;
};

async function api<T>(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    throw new Error(
      ((await response.json().catch(() => null)) as { message?: string } | null)
        ?.message ?? "บันทึกไม่สำเร็จ",
    );
  }
  return response.json() as Promise<T>;
}

export function PosStockBoard() {
  const { canAny } = useEmployeePermissions();
  const canMutate = canAny([
    "pos.stock.receive",
    "pos.stock.adjust",
    "pos.stock.count",
  ]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [ledger, setLedger] = useState<Movement[]>([]);
  const [message, setMessage] = useState("");

  const loadProducts = useCallback(async () => {
    try {
      const items = await api<Product[]>("/api/pos/products");
      setProducts(items);
      if (!productId && items[0]) setProductId(items[0].id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "โหลดสินค้าไม่สำเร็จ");
    }
  }, [productId]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  async function save(path: "receive" | "adjust") {
    try {
      await api(`/api/pos/stock/${path}`, {
        method: "POST",
        body: JSON.stringify({ productId, quantity, reason }),
      });
      setQuantity("");
      setReason("");
      void loadProducts();
      if (productId) void loadLedger();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "บันทึกสต๊อกไม่สำเร็จ");
    }
  }

  async function count() {
    try {
      await api("/api/pos/stock/count", {
        method: "POST",
        body: JSON.stringify({
          note: reason,
          items: [{ productId, countedQuantity: quantity }],
        }),
      });
      setQuantity("");
      setReason("");
      void loadProducts();
      if (productId) void loadLedger();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ตรวจนับไม่สำเร็จ");
    }
  }

  async function loadLedger() {
    if (!productId) return;
    try {
      setLedger(
        await api<Movement[]>(`/api/pos/stock/ledger?productId=${productId}`),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "โหลดประวัติไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      {message ? (
        <p className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
          {message}
        </p>
      ) : null}
      {canMutate ? (
        <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="font-semibold">รับเข้า / ปรับสต๊อก / ตรวจนับ</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <select
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 sm:col-span-2"
            >
              <option value="">เลือกสินค้า</option>
              {products.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · คงเหลือ {item.quantityOnHand}
                </option>
              ))}
            </select>
            <input
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              inputMode="decimal"
              placeholder="จำนวน (+/- สำหรับปรับ)"
              className="rounded-xl border border-border bg-background px-3 py-2"
            />
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="เหตุผล/เลขเอกสาร"
              className="rounded-xl border border-border bg-background px-3 py-2"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <PermissionGate permission="pos.stock.receive">
              <button
                type="button"
                onClick={() => void save("receive")}
                className="rounded-xl bg-primary px-4 py-2 text-primary-foreground"
              >
                รับสินค้าเข้า
              </button>
            </PermissionGate>
            <PermissionGate permission="pos.stock.adjust">
              <button
                type="button"
                onClick={() => void save("adjust")}
                className="rounded-xl border border-border px-4 py-2"
              >
                ปรับยอด
              </button>
            </PermissionGate>
            <PermissionGate permission="pos.stock.count">
              <button
                type="button"
                onClick={() => void count()}
                className="rounded-xl border border-border px-4 py-2"
              >
                ตรวจนับจริง
              </button>
            </PermissionGate>
            <button
              type="button"
              onClick={() => void loadLedger()}
              className="rounded-xl border border-border px-4 py-2"
            >
              ดู Ledger
            </button>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="font-semibold">ดูสต๊อก</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            ไม่มีสิทธิ์รับเข้า/ปรับ/ตรวจนับ — เลือกสินค้าเพื่อดูประวัติได้
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              className="min-w-64 rounded-xl border border-border bg-background px-3 py-2"
            >
              <option value="">เลือกสินค้า</option>
              {products.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · คงเหลือ {item.quantityOnHand}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadLedger()}
              className="rounded-xl border border-border px-4 py-2"
            >
              ดู Ledger
            </button>
          </div>
        </section>
      )}
      <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="font-semibold">ประวัติสต๊อก</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th>เวลา</th>
                <th>ประเภท</th>
                <th>เปลี่ยน</th>
                <th>ก่อน/หลัง</th>
                <th>อ้างอิง</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="py-3">
                    {formatThaiDateTime(item.occurredAt)}
                  </td>
                  <td>{item.type}</td>
                  <td>{item.quantityDelta}</td>
                  <td>
                    {item.quantityBefore} / {item.quantityAfter}
                  </td>
                  <td>{item.documentNumber ?? item.reason ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
