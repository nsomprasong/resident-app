"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import { PermissionGate } from "@/components/auth/PermissionGate";
import { useEmployeePermissions } from "@/components/auth/EmployeePermissionsProvider";

const paymentMethodLabels = [
  ["CASH", "เงินสด"],
  ["PROMPTPAY", "PromptPay"],
  ["TRANSFER", "โอนเงิน"],
  ["ROOM_CHARGE", "ลงห้องพัก"],
  ["TOUR_CHARGE", "ลงกรุ๊ปทัวร์"],
] as const;

type PaymentTotals = Partial<
  Record<(typeof paymentMethodLabels)[number][0], string | number>
>;

type CashMovement = {
  id: string;
  type: "IN" | "OUT" | string;
  amount: string | number;
  reason: string;
  createdAt: string;
};

type Shift = {
  id: string;
  status: string;
  openingFloat: string | number;
  expectedCash: string | number | null;
  expectedCashPreview?: string | number | null;
  cashVariance: string | number | null;
  openedAt: string;
  openedBy?: { name: string } | null;
  closedBy?: { name: string } | null;
  billCount?: number;
  netSales?: string | number;
  paymentTotals?: PaymentTotals;
  cashMovements?: CashMovement[];
};

function amount(value: string | number | null | undefined) {
  return Number(value ?? 0) || 0;
}

function baht(value: string | number | null | undefined) {
  return amount(value).toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 2,
  });
}

async function api<T>(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    throw new Error(
      ((await response.json().catch(() => null)) as { message?: string } | null)
        ?.message ?? "ดำเนินการไม่สำเร็จ",
    );
  }
  return response.json() as Promise<T>;
}

function PaymentBreakdown({
  totals,
  billCount,
  netSales,
}: {
  totals?: PaymentTotals;
  billCount?: number;
  netSales?: string | number;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/70 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium">สรุปยอดขายตามประเภทชำระ</span>
        <span className="text-muted-foreground">
          {billCount ?? 0} บิล · ยอดขาย {baht(netSales)}
        </span>
      </div>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {paymentMethodLabels.map(([method, label]) => (
          <div
            key={method}
            className="flex items-center justify-between rounded-xl border border-border/70 px-3 py-2 text-sm"
          >
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium">{baht(totals?.[method])}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function PosShiftsBoard() {
  const { can } = useEmployeePermissions();
  const canClose = can("pos.shift.close");
  const canApprove = can("pos.shift.approve");
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [current, setCurrent] = useState<Shift | null>(null);
  const [movementAmount, setMovementAmount] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [items, open] = await Promise.all([
        api<Shift[]>("/api/pos/shifts"),
        api<Shift | null>("/api/pos/shifts/current"),
      ]);
      setShifts(Array.isArray(items) ? items : []);
      setCurrent(open ?? null);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "โหลดกะไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cashSales = amount(current?.paymentTotals?.CASH);
  const cashMovements = useMemo(
    () =>
      [...(current?.cashMovements ?? [])].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      ),
    [current?.cashMovements],
  );
  const cashInTotal = cashMovements
    .filter((item) => item.type === "IN")
    .reduce((sum, item) => sum + amount(item.amount), 0);
  const cashOutTotal = cashMovements
    .filter((item) => item.type === "OUT")
    .reduce((sum, item) => sum + amount(item.amount), 0);

  async function saveCashMovement(type: "IN" | "OUT") {
    if (!current) return;
    const value = amount(movementAmount);
    if (value <= 0) {
      setMessage("กรุณาระบุจำนวนเงินที่มากกว่า 0");
      return;
    }
    if (!movementReason.trim()) {
      setMessage(
        type === "IN"
          ? "กรุณาระบุเหตุผล เช่น เติมเงินทอน"
          : "กรุณาระบุเหตุผล เช่น ส่งเงินเข้าเซฟ",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await api(`/api/pos/shifts/${current.id}/cash`, {
        method: "POST",
        body: JSON.stringify({
          type,
          amount: String(value),
          reason: movementReason.trim(),
        }),
      });
      setMovementAmount("");
      setMovementReason("");
      setMessage(
        type === "IN"
          ? `บันทึกเติมเงินเข้าลิ้นชัก ${baht(value)} แล้ว`
          : `บันทึกนำเงินออกจากลิ้นชัก ${baht(value)} แล้ว`,
      );
      void load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function closeShift() {
    if (!current) return;
    if (countedCash.trim() === "" || Number.isNaN(Number(countedCash))) {
      setMessage("กรุณานับเงินสดในลิ้นชักแล้วใส่จำนวนจริงก่อนปิดกะ");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await api(`/api/pos/shifts/${current.id}/close`, {
        method: "POST",
        body: JSON.stringify({
          closingCashCounted: countedCash,
          note: closeNote.trim() || undefined,
        }),
      });
      setCountedCash("");
      setCloseNote("");
      setMessage("ปิดกะเรียบร้อย");
      void load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ปิดกะไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  async function approveShift(shiftId: string) {
    setBusy(true);
    setMessage("");
    try {
      await api(`/api/pos/shifts/${shiftId}/approve`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setMessage("อนุมัติกะแล้ว");
      void load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "อนุมัติไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {message ? (
        <p className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm">
          {message}
        </p>
      ) : null}

      {current ? (
        <section className="space-y-4 rounded-3xl border border-primary/30 bg-primary/5 p-5">
          <div>
            <h2 className="font-semibold">กะที่กำลังเปิด</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              เปิดโดย {current.openedBy?.name ?? "-"} ·{" "}
              {new Date(current.openedAt).toLocaleString("th-TH")}
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-background p-4">
            <h3 className="text-sm font-medium">เงินสดในลิ้นชัก (คำนวณอัตโนมัติ)</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">เงินทอนตั้งต้นตอนเปิดกะ</dt>
                <dd>{baht(current.openingFloat)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">+ รับเงินสดจากการขาย</dt>
                <dd>{baht(cashSales)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">+ เติมเงินเข้าลิ้นชัก</dt>
                <dd>{baht(cashInTotal)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">− นำเงินออกจากลิ้นชัก</dt>
                <dd>{baht(cashOutTotal)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-border pt-2 text-base font-semibold">
                <dt>ควรมีเงินสดตอนนี้</dt>
                <dd>{baht(current.expectedCashPreview)}</dd>
              </div>
            </dl>
          </div>

          <PaymentBreakdown
            totals={current.paymentTotals}
            billCount={current.billCount}
            netSales={current.netSales}
          />

          <div className="rounded-2xl border border-border bg-background p-4">
            <h3 className="font-medium">1) ปรับเงินลิ้นชักระหว่างกะ</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              ใช้เมื่อมีการเติมเงินทอนเข้าลิ้นชัก หรือนำเงินออกไปเซฟ/ฝาก —{" "}
              <span className="font-medium text-foreground">ไม่ใช่การปิดกะ</span>
            </p>
            {canClose ? (
              <>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="text-sm">
                จำนวนเงิน
                <input
                  value={movementAmount}
                  onChange={(event) => setMovementAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder="เช่น 500"
                  className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2"
                />
              </label>
              <label className="text-sm">
                เหตุผล (จำเป็น)
                <input
                  value={movementReason}
                  onChange={(event) => setMovementReason(event.target.value)}
                  placeholder="เช่น เติมเงินทอน / ส่งเข้าเซฟ"
                  className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2"
                />
              </label>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveCashMovement("IN")}
                className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-medium disabled:opacity-50"
              >
                เติมเงินเข้าลิ้นชัก
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveCashMovement("OUT")}
                className="rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-medium disabled:opacity-50"
              >
                นำเงินออกจากลิ้นชัก
              </button>
            </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                ไม่มีสิทธิ์ปรับเงินลิ้นชัก
              </p>
            )}
            {cashMovements.length > 0 ? (
              <ul className="mt-4 space-y-2 border-t border-border pt-3">
                <li className="text-xs font-medium text-muted-foreground">
                  รายการปรับเงินล่าสุด
                </li>
                {cashMovements.slice(0, 5).map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span>
                      <span
                        className={
                          item.type === "IN" ? "text-primary" : "text-destructive"
                        }
                      >
                        {item.type === "IN" ? "เข้า" : "ออก"}
                      </span>{" "}
                      {item.reason}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString("th-TH")}
                      </span>
                    </span>
                    <span className="font-medium">{baht(item.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                ยังไม่มีรายการเติม/นำเงินออกในกะนี้
              </p>
            )}
          </div>

          <PermissionGate permission="pos.shift.close">
            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
              <h3 className="font-medium">2) ปิดกะเมื่อเลิกขาย</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                นับเงินสดจริงในลิ้นชัก แล้วใส่จำนวนด้านล่าง ระบบจะเทียบกับยอดที่ควรมี{" "}
                <span className="font-medium text-foreground">
                  {baht(current.expectedCashPreview)}
                </span>
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="text-sm">
                  เงินสดที่นับได้จริง
                  <input
                    value={countedCash}
                    onChange={(event) => setCountedCash(event.target.value)}
                    inputMode="decimal"
                    placeholder="นับจากลิ้นชักแล้วใส่ที่นี่"
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  หมายเหตุปิดกะ (ไม่บังคับ)
                  <input
                    value={closeNote}
                    onChange={(event) => setCloseNote(event.target.value)}
                    placeholder="เช่น เงินขาดเพราะทอนผิด"
                    className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2"
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void closeShift()}
                className="mt-3 w-full rounded-xl bg-primary px-4 py-2.5 font-medium text-primary-foreground disabled:opacity-50"
              >
                ปิดกะขาย
              </button>
            </div>
          </PermissionGate>
        </section>
      ) : null}

      <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
        <h2 className="font-semibold">ประวัติกะขาย</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th>เปิดเมื่อ</th>
                <th>ผู้เปิด</th>
                <th>สถานะ</th>
                <th>เงินตั้งต้น</th>
                <th>ยอดขาย</th>
                <th>ผลต่าง</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shifts.map((item) => (
                <Fragment key={item.id}>
                  <tr className="border-t border-border">
                    <td className="py-3">
                      {new Date(item.openedAt).toLocaleString("th-TH")}
                    </td>
                    <td>{item.openedBy?.name ?? "-"}</td>
                    <td>{item.status}</td>
                    <td>{baht(item.openingFloat)}</td>
                    <td>{baht(item.netSales)}</td>
                    <td>
                      {item.cashVariance === null
                        ? "-"
                        : baht(item.cashVariance)}
                    </td>
                    <td className="space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedId((currentId) =>
                            currentId === item.id ? null : item.id,
                          )
                        }
                        className="rounded-lg border border-border px-2 py-1"
                      >
                        {expandedId === item.id
                          ? "ซ่อนประเภทชำระ"
                          : "ดูประเภทชำระ"}
                      </button>
                      {item.status === "CLOSED" && canApprove ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void approveShift(item.id)}
                          className="rounded-lg border border-border px-2 py-1 disabled:opacity-50"
                        >
                          อนุมัติ
                        </button>
                      ) : null}
                    </td>
                  </tr>
                  {expandedId === item.id ? (
                    <tr className="border-t border-border/60">
                      <td colSpan={7} className="pb-4 pt-1">
                        <PaymentBreakdown
                          totals={item.paymentTotals}
                          billCount={item.billCount}
                          netSales={item.netSales}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
