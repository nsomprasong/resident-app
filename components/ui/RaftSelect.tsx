"use client";

import { CircleCheck, ShipWheel } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import PricingToggle from "./PricingToggle";

interface Raft {
  id: string;
  number: string;
  name: string;
  capacity: number;
  basePrice: number;
  booked: boolean;
}

export type SelectedRaft = {
  id: string;
  isExtra: boolean;
};

export default function RaftSelect({
  selectedRaftIds,
  onChange,
  selectedRafts,
  onRaftsChange,
  checkIn,
  checkOut,
  excludeBookingId,
  allowPackagePricing = false,
  defaultIsExtra = true,
}: {
  /** Legacy id-only selection (solo / add resources) */
  selectedRaftIds?: string[];
  onChange?: (ids: string[]) => void;
  /** Structured selection with package/extra flag */
  selectedRafts?: SelectedRaft[];
  onRaftsChange?: (rafts: SelectedRaft[]) => void;
  checkIn: string;
  checkOut: string;
  excludeBookingId?: string;
  allowPackagePricing?: boolean;
  defaultIsExtra?: boolean;
}) {
  const [rafts, setRafts] = useState<Raft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const usingStructured = Boolean(onRaftsChange);
  const selectedIds = usingStructured
    ? (selectedRafts ?? []).map((item) => item.id)
    : (selectedRaftIds ?? []);
  const extraById = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const item of selectedRafts ?? []) {
      map.set(item.id, item.isExtra);
    }
    return map;
  }, [selectedRafts]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          checkIn,
          checkOut,
        });
        if (excludeBookingId) params.set("excludeBookingId", excludeBookingId);
        const response = await fetch(`/api/rafts?${params.toString()}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as Raft[] | { message: string };
        if (!response.ok || !Array.isArray(data)) {
          throw new Error(
            "message" in data ? data.message : "โหลดแพไม่สำเร็จ",
          );
        }
        setRafts(data);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "โหลดแพไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [checkIn, checkOut, excludeBookingId]);

  const nights = useMemo(() => {
    const start = new Date(`${checkIn}T00:00:00.000Z`).getTime();
    const end = new Date(`${checkOut}T00:00:00.000Z`).getTime();
    return Math.max(1, Math.round((end - start) / 86_400_000));
  }, [checkIn, checkOut]);

  const selectedRaftRecords = rafts.filter((raft) =>
    selectedIds.includes(raft.id),
  );

  const chargedRafts = selectedRaftRecords.filter((raft) => {
    if (!allowPackagePricing) return true;
    return extraById.get(raft.id) ?? defaultIsExtra;
  });
  const raftTotal =
    chargedRafts.reduce((sum, raft) => sum + raft.basePrice, 0) * nights;
  const includedCount = allowPackagePricing
    ? selectedRaftRecords.length - chargedRafts.length
    : 0;

  const setSelection = (nextIds: string[]) => {
    if (usingStructured) {
      const previous = new Map(
        (selectedRafts ?? []).map((item) => [item.id, item.isExtra]),
      );
      onRaftsChange?.(
        nextIds.map((id) => ({
          id,
          isExtra: previous.get(id) ?? defaultIsExtra,
        })),
      );
      return;
    }
    onChange?.(nextIds);
  };

  const toggle = (id: string) =>
    setSelection(
      selectedIds.includes(id)
        ? selectedIds.filter((raftId) => raftId !== id)
        : [...selectedIds, id],
    );

  const setExtra = (id: string, isExtra: boolean) => {
    if (!usingStructured) return;
    onRaftsChange?.(
      (selectedRafts ?? []).map((item) =>
        item.id === id ? { ...item, isExtra } : item,
      ),
    );
  };

  return (
    <section className="rounded-2xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <ShipWheel size={18} />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-foreground">แพ</h3>
          <p className="text-xs text-muted-foreground">
            {allowPackagePricing
              ? "เลือกแพว่าง แล้วกำหนดว่ารวมในเหมาหรือคิดเพิ่ม"
              : "เลือกแพว่างตามช่วงวันที่จอง"}
          </p>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">กำลังตรวจสอบแพว่าง...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-border bg-background p-2">
            {rafts.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                ไม่พบแพในช่วงวันที่เลือก
              </p>
            ) : (
              rafts.map((raft) => {
                const selected = selectedIds.includes(raft.id);
                const blocked = raft.booked && !selected;
                const isExtra = extraById.get(raft.id) ?? defaultIsExtra;
                return (
                  <div
                    key={raft.id}
                    className={`rounded-xl border p-3 ${
                      blocked
                        ? "border-destructive/30 bg-destructive/10"
                        : selected
                          ? "border-success/40 bg-success/10"
                          : "border-border bg-surface"
                    }`}
                  >
                    <button
                      type="button"
                      disabled={blocked}
                      onClick={() => toggle(raft.id)}
                      className={`flex w-full items-center justify-between gap-3 text-left ${
                        blocked
                          ? "cursor-not-allowed text-destructive"
                          : selected
                            ? "text-success"
                            : "text-foreground hover:text-primary"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        {selected ? (
                          <CircleCheck size={22} className="shrink-0" />
                        ) : (
                          <ShipWheel size={22} className="shrink-0" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {raft.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {raft.capacity} คน · ฿
                            {raft.basePrice.toLocaleString()}/คืน
                          </span>
                        </span>
                      </span>
                      <span className="shrink-0 text-xs">
                        {blocked ? "ไม่ว่าง" : selected ? "เลือกแล้ว" : "ว่าง"}
                      </span>
                    </button>
                    {allowPackagePricing && selected ? (
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2">
                        <p className="text-xs text-muted-foreground">การคิดเงิน</p>
                        <PricingToggle
                          value={isExtra}
                          onChange={(next) => setExtra(raft.id, next)}
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        )}

        <div className="rounded-xl bg-background px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground">
              เลือกแล้ว{" "}
              <span className="font-medium text-foreground">
                {selectedIds.length}
              </span>{" "}
              แพ
              {allowPackagePricing && selectedIds.length > 0 ? (
                <span className="ml-2 text-xs">
                  (รวมในเหมา {includedCount} · คิดเพิ่ม {chargedRafts.length})
                </span>
              ) : selectedRaftRecords.length > 0 ? (
                <span className="ml-2 text-xs">
                  ({selectedRaftRecords.map((raft) => raft.name).join(", ")})
                </span>
              ) : null}
            </p>
            <p className="font-medium text-foreground">
              {allowPackagePricing ? "คิดเพิ่ม ฿" : "รวมแพ ฿"}
              {raftTotal.toLocaleString()}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({nights} คืน)
              </span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
