"use client";

import { useCallback, useEffect, useState } from "react";

type Shift = {
  id: string;
  status: string;
  openingFloat: string | number;
  expectedCash: string | number | null;
  cashVariance: string | number | null;
  openedAt: string;
  openedBy?: { name: string } | null;
  closedBy?: { name: string } | null;
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
        ?.message ?? "ดำเนินการไม่สำเร็จ",
    );
  }
  return response.json() as Promise<T>;
}

export function PosShiftsBoard() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [current, setCurrent] = useState<Shift | null>(null);
  const [cash, setCash] = useState("0");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");

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

  async function action(path: string, body: Record<string, string>) {
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      setCash("0");
      setReason("");
      void load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
    }
  }

  return (
    <div className="space-y-4">
      {message ? (
        <p className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
          {message}
        </p>
      ) : null}

      {current ? (
        <section className="rounded-3xl border border-primary/30 bg-primary/5 p-5">
          <h2 className="font-semibold">กะที่กำลังเปิด</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            เปิดโดย {current.openedBy?.name ?? "-"} · เงินทอน{" "}
            {Number(current.openingFloat).toLocaleString("th-TH")} บาท
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input
              value={cash}
              onChange={(event) => setCash(event.target.value)}
              inputMode="decimal"
              placeholder="จำนวนเงิน"
              className="rounded-xl border border-border bg-background px-3 py-2"
            />
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="เหตุผล"
              className="rounded-xl border border-border bg-background px-3 py-2"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  void action(`/api/pos/shifts/${current.id}/cash`, {
                    type: "IN",
                    amount: cash,
                    reason,
                  })
                }
                className="rounded-xl border border-border px-3 py-2"
              >
                เงินเข้า
              </button>
              <button
                type="button"
                onClick={() =>
                  void action(`/api/pos/shifts/${current.id}/cash`, {
                    type: "OUT",
                    amount: cash,
                    reason,
                  })
                }
                className="rounded-xl border border-border px-3 py-2"
              >
                เงินออก
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              void action(`/api/pos/shifts/${current.id}/close`, {
                closingCashCounted: cash,
                note: reason,
              })
            }
            className="mt-3 rounded-xl bg-primary px-4 py-2 text-primary-foreground"
          >
            ปิดกะ (เงินนับจริง)
          </button>
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
                <th>ผลต่าง</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shifts.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="py-3">
                    {new Date(item.openedAt).toLocaleString("th-TH")}
                  </td>
                  <td>{item.openedBy?.name ?? "-"}</td>
                  <td>{item.status}</td>
                  <td>{Number(item.openingFloat).toLocaleString("th-TH")}</td>
                  <td>
                    {item.cashVariance === null
                      ? "-"
                      : Number(item.cashVariance).toLocaleString("th-TH")}
                  </td>
                  <td>
                    {item.status === "CLOSED" ? (
                      <button
                        type="button"
                        onClick={() =>
                          void action(`/api/pos/shifts/${item.id}/approve`, {})
                        }
                        className="rounded-lg border border-border px-2 py-1"
                      >
                        อนุมัติ
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
