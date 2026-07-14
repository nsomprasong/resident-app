"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const paymentLabels: Record<string, string> = {
  CASH: "เงินสด",
  PROMPTPAY: "PromptPay",
  TRANSFER: "โอนเงิน",
  ROOM_CHARGE: "ลงห้องพัก",
  TOUR_CHARGE: "ลงกรุ๊ปทัวร์",
};

type CashVarianceRow = {
  shiftId: string;
  closedAt: string | null;
  openedByName: string | null;
  expectedCash: string | number;
  closingCashCounted: string | number;
  cashVariance: string | number;
  status: string;
};

type Report = {
  billCount: number;
  grossSales: string | number;
  refunds: string | number;
  netSales: string | number;
  cost: string | number;
  grossProfit: string | number;
  paymentTotals: Record<string, string | number>;
  cashOver: string | number;
  cashShort: string | number;
  cashVarianceNet: string | number;
  cashVarianceShiftCount: number;
  cashVariances: CashVarianceRow[];
  lowStock: Array<{ name: string; quantityOnHand: string | number }>;
};

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function money(value: string | number) {
  return Number(value).toLocaleString("th-TH", {
    style: "currency",
    currency: "THB",
  });
}

function varianceLabel(value: string | number) {
  const amount = Number(value);
  if (amount > 0) return `เกิน ${money(amount)}`;
  if (amount < 0) return `ขาด ${money(Math.abs(amount))}`;
  return "ตรงยอด";
}

async function getReport(from: string, to: string) {
  const response = await fetch(
    `/api/pos/reports?from=${encodeURIComponent(`${from}T00:00:00.000Z`)}&to=${encodeURIComponent(`${to}T23:59:59.999Z`)}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error("โหลดรายงานไม่สำเร็จ");
  return response.json() as Promise<Report>;
}

export function PosReportsBoard() {
  const [from, setFrom] = useState(() => dateInput(new Date()));
  const [to, setTo] = useState(() => dateInput(new Date()));
  const [report, setReport] = useState<Report | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setReport(await getReport(from, to));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "โหลดรายงานไม่สำเร็จ");
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  function exportCsv() {
    if (!report) return;
    const rows = [
      ["รายการ", "จำนวนเงิน"],
      ["จำนวนบิล", String(report.billCount)],
      ["ยอดขายสุทธิ", String(report.netSales)],
      ["ต้นทุน", String(report.cost)],
      ["กำไรขั้นต้น", String(report.grossProfit)],
      ["เงินเกินรวม", String(report.cashOver)],
      ["เงินขาดรวม", String(report.cashShort)],
      ["เงินขาด/เกินสุทธิ", String(report.cashVarianceNet)],
      ...Object.entries(report.paymentTotals).map(([key, value]) => [
        paymentLabels[key] ?? key,
        String(value),
      ]),
      [],
      ["กะที่ปิด", "ผู้เปิด", "ควรมี", "นับจริง", "ขาด/เกิน", "สถานะ"],
      ...report.cashVariances.map((item) => [
        item.closedAt
          ? new Date(item.closedAt).toLocaleString("th-TH")
          : item.shiftId,
        item.openedByName ?? "-",
        String(item.expectedCash),
        String(item.closingCashCounted),
        String(item.cashVariance),
        item.status,
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }),
    );
    link.download = `pos-report-${from}-${to}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="space-y-4">
      {message ? (
        <p className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
          {message}
        </p>
      ) : null}

      <section className="flex flex-wrap items-end gap-3 rounded-[1.75rem] border border-border bg-surface p-5 shadow-sm">
        <label className="text-sm font-medium">
          ตั้งแต่
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="mt-1.5 block rounded-2xl border border-border bg-background px-3 py-2.5"
          />
        </label>
        <label className="text-sm font-medium">
          ถึง
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="mt-1.5 block rounded-2xl border border-border bg-background px-3 py-2.5"
          />
        </label>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm"
        >
          ส่งออก CSV
        </button>
        <Link
          href="/dashboard"
          className="rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted"
        >
          ดูบัญชี/แดชบอร์ด
        </Link>
      </section>

      {report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "ยอดขายสุทธิ", value: money(report.netSales) },
              {
                label: "จำนวนบิล",
                value: report.billCount.toLocaleString("th-TH"),
              },
              { label: "ต้นทุน", value: money(report.cost) },
              { label: "กำไรขั้นต้น", value: money(report.grossProfit) },
            ].map((item) => (
              <section
                key={item.label}
                className="rounded-[1.5rem] border border-border bg-gradient-to-br from-surface to-muted/50 p-5 shadow-sm"
              >
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">
                  {item.value}
                </p>
              </section>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                label: "เงินเกิน",
                value: money(report.cashOver),
                hint: "นับได้มากกว่าที่ควรมี",
              },
              {
                label: "เงินขาด",
                value: money(report.cashShort),
                hint: "นับได้น้อยกว่าที่ควรมี",
              },
              {
                label: "ขาด/เกินสุทธิ",
                value: money(report.cashVarianceNet),
                hint: `${report.cashVarianceShiftCount} กะที่ปิดในช่วงนี้`,
              },
            ].map((item) => (
              <section
                key={item.label}
                className="rounded-2xl border border-border bg-surface p-4 shadow-sm"
              >
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold">{item.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
              </section>
            ))}
          </div>

          <section className="rounded-3xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="font-semibold">ยอดชำระตามช่องทาง</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {Object.entries(report.paymentTotals).map(([key, value]) => (
                <div key={key} className="rounded-2xl bg-muted p-3">
                  <p className="text-xs text-muted-foreground">
                    {paymentLabels[key] ?? key}
                  </p>
                  <p className="mt-1 font-semibold">{money(value)}</p>
                </div>
              ))}
            </div>

            <h2 className="mt-6 font-semibold">รายละเอียดเงินขาด/เกินรายกะ</h2>
            {report.cashVariances.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                ไม่มีกะที่ปิดในช่วงเวลานี้
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-2">ปิดกะเมื่อ</th>
                      <th>ผู้เปิด</th>
                      <th>ควรมี</th>
                      <th>นับจริง</th>
                      <th>ผลต่าง</th>
                      <th>สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.cashVariances.map((item) => (
                      <tr key={item.shiftId} className="border-t border-border">
                        <td className="py-3">
                          {item.closedAt
                            ? new Date(item.closedAt).toLocaleString("th-TH")
                            : "-"}
                        </td>
                        <td>{item.openedByName ?? "-"}</td>
                        <td>{money(item.expectedCash)}</td>
                        <td>{money(item.closingCashCounted)}</td>
                        <td
                          className={
                            Number(item.cashVariance) < 0
                              ? "text-destructive"
                              : Number(item.cashVariance) > 0
                                ? "text-primary"
                                : undefined
                          }
                        >
                          {varianceLabel(item.cashVariance)}
                        </td>
                        <td>{item.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h2 className="mt-6 font-semibold">สินค้าใกล้หมด</h2>
            <ul className="mt-2 text-sm">
              {report.lowStock.length === 0 ? (
                <li className="text-muted-foreground">ไม่มีสินค้าใกล้หมด</li>
              ) : (
                report.lowStock.map((item) => (
                  <li key={item.name}>
                    {item.name} · เหลือ {item.quantityOnHand}
                  </li>
                ))
              )}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
